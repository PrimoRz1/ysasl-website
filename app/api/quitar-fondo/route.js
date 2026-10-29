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

// PILOTO TEMPORAL: solo el jugador real #28 de LA VALLARTA FC (#19).
// Quitar esta restricción únicamente después de terminar la prueba.
const PILOTO_JUGADOR_ID = 28
const PILOTO_EQUIPO_ID = 19

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

// AUTORIZACIÓN GENERAL: solo jugadores con solicitud aprobada,
// ficha ACTIVA y vinculada al equipo correspondiente, que también debe
// estar activo. Se valida con el token real en Supabase; nunca se confía
// en IDs o nombres enviados desde el navegador.
// La RPC de Supabase aplica por separado los cupos y la temporada activa.
async function comprobarAccesoJugador(request) {
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

    const urlSolicitudes = new URL(`${base}/rest/v1/solicitudes_jugadores`)
    urlSolicitudes.searchParams.set('select', 'jugador_id,equipo_id')
    urlSolicitudes.searchParams.set('usuario_id', `eq.${usuario.id}`)
    urlSolicitudes.searchParams.set('estado', 'eq.aprobada')
    urlSolicitudes.searchParams.set('jugador_id', 'not.is.null')
    urlSolicitudes.searchParams.set('limit', '100')

    const respuestaSolicitudes = await fetch(urlSolicitudes.toString(), {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    })
    if (!respuestaSolicitudes.ok) {
      return { autenticado: true, autorizado: false, token }
    }
    const solicitudes = await respuestaSolicitudes.json()
    if (!Array.isArray(solicitudes) || solicitudes.length === 0) {
      return { autenticado: true, autorizado: false, token }
    }

    // Evitar que una solicitud histórica de un jugador dado de baja
    // permita procesar fotografías. La ficha y el equipo deben seguir activos.
    for (const solicitud of solicitudes) {
      const jugadorId = Number(solicitud.jugador_id)
      const equipoId = Number(solicitud.equipo_id)
      if (!Number.isSafeInteger(jugadorId) || jugadorId < 1 ||
          !Number.isSafeInteger(equipoId) || equipoId < 1) continue

      // Evitar que otros jugadores puedan consumir créditos durante el piloto.
      if (jugadorId !== PILOTO_JUGADOR_ID || equipoId !== PILOTO_EQUIPO_ID) continue

      const urlJugador = new URL(`${base}/rest/v1/jugadores`)
      urlJugador.searchParams.set('select', 'id')
      urlJugador.searchParams.set('id', `eq.${jugadorId}`)
      urlJugador.searchParams.set('equipo_id', `eq.${equipoId}`)
      urlJugador.searchParams.set('activo', 'is.true')
      urlJugador.searchParams.set('limit', '1')

      const urlEquipo = new URL(`${base}/rest/v1/equipos`)
      urlEquipo.searchParams.set('select', 'id')
      urlEquipo.searchParams.set('id', `eq.${equipoId}`)
      urlEquipo.searchParams.set('activo', 'is.true')
      urlEquipo.searchParams.set('limit', '1')

      const [respuestaJugador, respuestaEquipo] = await Promise.all([
        fetch(urlJugador.toString(), {
          headers, cache: 'no-store', signal: AbortSignal.timeout(10000)
        }),
        fetch(urlEquipo.toString(), {
          headers, cache: 'no-store', signal: AbortSignal.timeout(10000)
        })
      ])
      if (!respuestaJugador.ok || !respuestaEquipo.ok) continue

      const [jugadores, equipos] = await Promise.all([
        respuestaJugador.json(), respuestaEquipo.json()
      ])
      if (Array.isArray(jugadores) && jugadores.length === 1 &&
          Array.isArray(equipos) && equipos.length === 1) {
        return { autenticado: true, autorizado: true, token }
      }
    }

    return { autenticado: true, autorizado: false, token }
  } catch {
    // Si falla cualquier comprobación, no se procesa ni se cobra nada.
    return { autenticado: false, autorizado: false }
  }
}

export async function GET(request) {
  const acceso = configurado() ? await comprobarAccesoJugador(request) : null
  return Response.json({ disponible: Boolean(acceso?.autorizado) }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}

export async function POST(request) {
  // INTERRUPTOR: apagado por defecto. Nunca llamar a Leonardo sin habilitación.
  if (!configurado()) {
    return errorJson('El quitafondos aún no está habilitado.', 503)
  }

  // Verificación obligatoria ANTES de reservar cupo o llamar a Leonardo.
  const acceso = await comprobarAccesoJugador(request)
  if (!acceso.autenticado) return errorJson('Debes iniciar sesión.', 401)
  if (!acceso.autorizado) {
    return errorJson('Solo jugadores aprobados y activos pueden utilizar el quitafondos.', 403)
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

  // Reserva atómica en Supabase: valida temporada activa y aplica los cupos
  // configurados en la RPC. Si falta la RPC, no hay llamada pagada.
  // Revisa que la versión SQL instalada sea la vigente (sin límite diario).
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

    // Diagnóstico seguro: NO registrar fotografías, base64, tokens, claves,
    // correos, URLs de imágenes ni el cuerpo completo de Leonardo.
    if (respuesta.status === 402) {
      console.warn('[YSASL Leonardo] Sin crédito', { httpStatus: 402 })
      return errorJson('No hay crédito disponible para procesar fotografías.', 503)
    }
    if (respuesta.status === 429) {
      console.warn('[YSASL Leonardo] Límite del proveedor', { httpStatus: 429 })
      return errorJson('El servicio está ocupado. Intenta más tarde.', 429)
    }
    if (!respuesta.ok) {
      console.warn('[YSASL Leonardo] Error HTTP', { httpStatus: respuesta.status })
      return errorJson('Leonardo no pudo procesar esta fotografía.', 502)
    }

    let datos
    try {
      datos = await respuesta.json()
    } catch {
      console.warn('[YSASL Leonardo] JSON inválido', {
        httpStatus: respuesta.status,
        contentType: respuesta.headers.get('content-type') || 'no indicado'
      })
      return errorJson('Leonardo respondió con un formato inesperado.', 502)
    }

    const resultados = Array.isArray(datos?.results) ? datos.results : []
    const errores = Array.isArray(datos?.errors) ? datos.errors : []
    const bloqueadas = Number.isInteger(datos?.blockedCount) ? datos.blockedCount : 0
    const diagnostico = {
      httpStatus: respuesta.status,
      generationId: typeof datos?.id === 'string' ? datos.id : null,
      resultsArray: Array.isArray(datos?.results),
      resultsCount: resultados.length,
      blockedCount: bloqueadas,
      errorsCount: errores.length,
      costAmount: typeof datos?.cost?.amount === 'string' ? datos.cost.amount : null,
      costUnit: typeof datos?.cost?.unit === 'string' ? datos.cost.unit : null
    }

    // Un HTTP 200 no garantiza que Leonardo haya entregado una imagen.
    if (errores.length) {
      console.warn('[YSASL Leonardo] Errores en respuesta 200', diagnostico)
      return errorJson('Leonardo rechazó la fotografía o no pudo procesarla.', 502)
    }
    urlResultado = resultados[0]?.url
    if (!urlResultado || typeof urlResultado !== 'string') {
      console.warn('[YSASL Leonardo] Sin imagen en respuesta 200', diagnostico)
      if (bloqueadas > 0) {
        return errorJson('Leonardo bloqueó el resultado de esta fotografía. Se conservó la original.', 502)
      }
      return errorJson('Leonardo respondió sin una imagen procesada. Se conservó la original.', 502)
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
