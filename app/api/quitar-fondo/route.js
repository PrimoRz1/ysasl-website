// YSASL — app/api/quitar-fondo/route.js
// API privada: Leonardo.Ai para fotos de jugadores (sin fondo).
// IMPORTANTE: se mantiene APAGADA hasta habilitarla expresamente en Vercel.
// También requiere una RPC de Supabase para el presupuesto y los cupos
// por temporada. Sin esa RPC, FALLA CERRADA (no realiza llamadas pagadas).

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_ORIGINAL = 2 * 1024 * 1024
const MAX_PNG = 5 * 1024 * 1024
const MIME_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp'])

function configurado() {
  return Boolean(
    process.env.YSASL_QUITAFONDO_HABILITADO === 'true' &&
    process.env.LEONARDO_API_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

function errorJson(mensaje, estado) {
  return Response.json({ error: mensaje }, {
    status: estado,
    headers: { 'Cache-Control': 'no-store' }
  })
}

export async function GET() {
  return Response.json({ disponible: configurado() }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}

export async function POST(request) {
  // INTERRUPTOR: apagado por defecto. Nunca llamar a Leonardo sin habilitación.
  if (!configurado()) {
    return errorJson('El quitafondos aún no está habilitado.', 503)
  }

  const cabecera = request.headers.get('authorization') || ''
  const coincidencia = /^Bearer\s+(\S+)$/i.exec(cabecera)
  if (!coincidencia) return errorJson('Debes iniciar sesión.', 401)

  const token = coincidencia[1]
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const headersSupabase = { apikey: anon, Authorization: `Bearer ${token}` }

  // Comprobar la sesión con Supabase Auth (no confiar solo en el navegador).
  try {
    const comprobacion = await fetch(`${base}/auth/v1/user`, {
      headers: headersSupabase,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    })
    if (!comprobacion.ok) return errorJson('Sesión inválida.', 401)
    const usuario = await comprobacion.json()
    if (!usuario?.id) return errorJson('Sesión inválida.', 401)
  } catch {
    return errorJson('No se pudo comprobar la sesión.', 503)
  }

  const largo = Number(request.headers.get('content-length') || 0)
  if (largo > MAX_ORIGINAL + 250000) {
    return errorJson('La fotografía debe pesar menos de 2 MB.', 413)
  }

  let archivo
  try {
    const formulario = await request.formData()
    archivo = formulario.get('archivo')
  } catch {
    return errorJson('No se pudo leer la fotografía.', 400)
  }
  if (!archivo || typeof archivo.arrayBuffer !== 'function' ||
      !MIME_PERMITIDOS.has(archivo.type) ||
      archivo.size < 1 || archivo.size > MAX_ORIGINAL) {
    return errorJson('Selecciona una imagen JPG, PNG o WebP de máximo 2 MB.', 400)
  }

  // Reserva atómica: valida jugador aprobado, temporada actual, máximo
  // una primera foto + un cambio por temporada, límite diario y presupuesto.
  // Esta RPC se instalará en un paso POSTERIOR. Hasta entonces NO se paga nada.
  let permitido = false
  try {
    const cuota = await fetch(`${base}/rest/v1/rpc/reservar_quitafondo_leonardo`, {
      method: 'POST',
      headers: { ...headersSupabase, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    })
    if (!cuota.ok) {
      return errorJson('Falta configurar el presupuesto y los cupos del quitafondos.', 503)
    }
    permitido = (await cuota.json()) === true
  } catch {
    return errorJson('No se pudo comprobar el presupuesto del quitafondos.', 503)
  }
  if (!permitido) {
    return errorJson('No tienes cupo disponible o se alcanzó el presupuesto de fotografías.', 429)
  }

  // Leonardo.Ai recibe JSON con la foto codificada en base64.
  // El archivo original permanece en Supabase Storage de YSASL.
  let fotoBase64
  try {
    fotoBase64 = Buffer.from(await archivo.arrayBuffer()).toString('base64')
  } catch {
    return errorJson('No se pudo preparar la fotografía.', 400)
  }

  let urlResultado
  try {
    const respuesta = await fetch('https://cloud.leonardo.ai/api/rest/v2/generationssync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LEONARDO_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model: 'remove-bg',
        public: false,
        ephemeral: true,
        parameters: {
          size: 'auto',
          type: 'person',
          format: 'png',
          channels: 'rgba',
          crop: false,
          guidances: {
            image_reference: [{ image: { type: 'BASE64', data: fotoBase64 } }]
          }
        }
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(45000)
    })

    if (respuesta.status === 402) {
      return errorJson('No hay crédito disponible para procesar fotografías.', 503)
    }
    if (respuesta.status === 429) {
      return errorJson('El servicio está ocupado. Intenta más tarde.', 429)
    }
    if (!respuesta.ok) {
      return errorJson('Leonardo no pudo procesar esta fotografía.', 502)
    }

    // Leonardo puede devolver errores dentro de un HTTP 200.
    const datos = await respuesta.json()
    if (Array.isArray(datos?.errors) && datos.errors.length) {
      return errorJson('Leonardo rechazó la fotografía o no pudo procesarla.', 502)
    }
    urlResultado = datos?.results?.[0]?.url
    if (!urlResultado || typeof urlResultado !== 'string') {
      return errorJson('Leonardo no devolvió una imagen procesada.', 502)
    }
  } catch {
    return errorJson('El procesamiento tardó demasiado o no respondió.', 502)
  }

  // La URL es temporal (ephemeral). Descargar el PNG ahora y devolverlo al
  // navegador, que lo guardará permanentemente en Supabase Storage.
  let url
  try {
    url = new URL(urlResultado)
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('URL inválida')
    }
  } catch {
    return errorJson('El enlace de la fotografía procesada no es válido.', 502)
  }

  try {
    const imagen = await fetch(url.toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000)
    })
    if (!imagen.ok) return errorJson('No se pudo descargar la fotografía procesada.', 502)
    const tamano = Number(imagen.headers.get('content-length') || 0)
    if (tamano > MAX_PNG) {
      return errorJson('La imagen procesada supera los 5 MB.', 502)
    }
    const contenido = Buffer.from(await imagen.arrayBuffer())
    // Verificar firma PNG: evita guardar HTML u otros contenidos por error.
    const firma = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    if (contenido.length < 8 || contenido.length > MAX_PNG ||
        !contenido.subarray(0, 8).equals(firma)) {
      return errorJson('Leonardo devolvió un archivo que no es PNG válido.', 502)
    }
    return new Response(contenido, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch {
    return errorJson('No se pudo obtener la fotografía sin fondo.', 502)
  }
}
