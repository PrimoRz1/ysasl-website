// YSASL — app/api/quitar-fondo/route.js
// API privada: Leonardo.Ai para fotos de jugadores (sin fondo).
// IMPORTANTE: se mantiene APAGADA hasta habilitarla expresamente en Vercel.
// Requiere la RPC de Supabase para presupuesto y cupos por temporada.
// Compatible con NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (Supabase actual)
// y NEXT_PUBLIC_SUPABASE_ANON_KEY (proyectos anteriores).
// Sin la RPC, FALLA CERRADA (no realiza llamadas pagadas).

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
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  )
}

function errorJson(mensaje, estado) {
  return Response.json({ error: mensaje }, {
    status: estado,
    headers: { 'Cache-Control': 'no-store' }
  })
}

// PILOTO: solo la ficha #28 de Primitivo Recendez en LA VALLARTA FC (#19).
// La autorización se comprueba en Supabase usando el token del usuario.
// No basta con enviar el nombre, el correo o el ID desde el navegador.
// Para abrir el servicio a toda la liga, restaurar la API general después
// de completar y revisar la prueba. Nunca quitar esta protección antes.
const FICHA_PILOTO = 28
const EQUIPO_PILOTO = 19

async function comprobarAccesoPiloto(request) {
  const cabecera = request.headers.get('authorization') || ''
  const coincidencia = /^Bearer\s+(\S+)$/i.exec(cabecera)
  if (!coincidencia) return { autenticado: false, autorizado: false }

  const token = coincidencia[1]
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const headers = { apikey: anon, Authorization: `Bearer ${token}` }

  try {
    const respuestaAuth = await fetch(`${base}/auth/v1/user`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    })
    if (!respuestaAuth.ok) return { autenticado: false, autorizado: false }
    const usuario = await respuestaAuth.json()
    if (!usuario?.id) return { autenticado: false, autorizado: false }

    // Solo la solicitud aprobada que está vinculada a la ficha real #28.
    const url = new URL(`${base}/rest/v1/solicitudes_jugadores`)
    url.searchParams.set('select', 'id')
    url.searchParams.set('usuario_id', `eq.${usuario.id}`)
    url.searchParams.set('jugador_id', `eq.${FICHA_PILOTO}`)
    url.searchParams.set('equipo_id', `eq.${EQUIPO_PILOTO}`)
    url.searchParams.set('estado', 'eq.aprobada')
    url.searchParams.set('limit', '1')

    const respuestaSolicitud = await fetch(url.toString(), {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    })
    if (!respuestaSolicitud.ok) {
      return { autenticado: true, autorizado: false, token }
    }
    const solicitudes = await respuestaSolicitud.json()
    return {
      autenticado: true,
      autorizado: Array.isArray(solicitudes) && solicitudes.length > 0,
      token
    }
  } catch {
    // Si falla cualquier verificación, no se cobra ni se procesa nada.
    return { autenticado: false, autorizado: false }
  }
}

export async function GET(request) {
  const acceso = configurado() ? await comprobarAccesoPiloto(request) : null
  return Response.json({ disponible: Boolean(acceso?.autorizado) }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}

export async function POST(request) {
  // INTERRUPTOR: apagado por defecto. Nunca llamar a Leonardo sin habilitación.
  if (!configurado()) {
    return errorJson('El quitafondos aún no está habilitado.', 503)
  }

  // Restricción obligatoria ANTES de reservar cupo o llamar a Leonardo.
  const acceso = await comprobarAccesoPiloto(request)
  if (!acceso.autenticado) return errorJson('Debes iniciar sesión.', 401)
  if (!acceso.autorizado) {
    return errorJson('Esta prueba está reservada a Primitivo Recendez.', 403)
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const headersSupabase = { apikey: anon, Authorization: `Bearer ${acceso.token}` }

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

  // Reserva atómica: valida jugador aprobado y temporada activa, máximo
  // dos procesamientos por jugador/temporada y 620 reservas globales.
  // SIN límite diario. Si falta la RPC, no se realiza ninguna llamada pagada.
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
