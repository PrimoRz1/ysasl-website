// app/api/quitar-fondo/route.js
// El servicio externo solo se invoca desde el servidor: nunca exponer la API key.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_ORIGINAL = 2 * 1024 * 1024
const MIME_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp'])

function configurado() {
  return Boolean(
    process.env.YSASL_QUITAFONDO_HABILITADO === 'true' &&
    process.env.REMOVE_BG_API_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

function respuestaError(mensaje, estado) {
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
  if (!configurado()) {
    return respuestaError('El quitafondos aún no está habilitado.', 503)
  }

  const cabecera = request.headers.get('authorization') || ''
  const coincidencia = /^Bearer\s+(\S+)$/i.exec(cabecera)
  if (!coincidencia) return respuestaError('Debes iniciar sesión.', 401)
  const token = coincidencia[1]
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const headersSupabase = { apikey: anon, Authorization: `Bearer ${token}` }

  // No basta con confiar en el navegador: validamos el JWT con Supabase Auth.
  try {
    const comprobacion = await fetch(`${base}/auth/v1/user`, {
      headers: headersSupabase,
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    })
    if (!comprobacion.ok) return respuestaError('Sesión inválida.', 401)
    const usuario = await comprobacion.json()
    if (!usuario?.id) return respuestaError('Sesión inválida.', 401)
  } catch {
    return respuestaError('No se pudo comprobar la sesión.', 503)
  }

  const largo = Number(request.headers.get('content-length') || 0)
  if (largo > MAX_ORIGINAL + 250000) {
    return respuestaError('La fotografía debe pesar menos de 2 MB.', 413)
  }

  let archivo
  try {
    const formulario = await request.formData()
    archivo = formulario.get('archivo')
  } catch {
    return respuestaError('No se pudo leer la fotografía.', 400)
  }
  if (!archivo || typeof archivo.arrayBuffer !== 'function' ||
      !MIME_PERMITIDOS.has(archivo.type) ||
      archivo.size < 1 || archivo.size > MAX_ORIGINAL) {
    return respuestaError('Selecciona una imagen JPG, PNG o WebP de máximo 2 MB.', 400)
  }

  // Esta RPC de Supabase valida que sea jugador aprobado y reserva un cupo
  // atómicamente (2 por jugador/día y 30 por toda la liga/día).
  // Sin instalar la RPC, la petición FALLA CERRADA y no gasta créditos.
  let permitido = false
  try {
    const cuota = await fetch(`${base}/rest/v1/rpc/consumir_cupo_quitar_fondo`, {
      method: 'POST',
      headers: { ...headersSupabase, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    })
    if (!cuota.ok) return respuestaError('Falta configurar el control de uso del quitafondos.', 503)
    permitido = (await cuota.json()) === true
  } catch {
    return respuestaError('No se pudo comprobar el cupo disponible.', 503)
  }
  if (!permitido) {
    return respuestaError('No tienes permiso o alcanzaste el límite diario de fotos sin fondo.', 429)
  }

  const envio = new FormData()
  envio.append('image_file', archivo, 'jugador.' + archivo.type.split('/')[1])
  envio.append('size', 'auto')
  envio.append('format', 'png')

  try {
    const externa = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: { 'X-Api-Key': process.env.REMOVE_BG_API_KEY },
      body: envio,
      cache: 'no-store',
      signal: AbortSignal.timeout(45000)
    })
    if (!externa.ok) {
      if (externa.status === 402) return respuestaError('No hay créditos disponibles para quitar fondos.', 503)
      if (externa.status === 429) return respuestaError('El servicio está ocupado. Intenta más tarde.', 429)
      return respuestaError('No se pudo quitar el fondo de esta fotografía.', 502)
    }
    const resultado = await externa.arrayBuffer()
    if (!resultado.byteLength || resultado.byteLength > 5 * 1024 * 1024) {
      return respuestaError('La imagen procesada supera el tamaño permitido.', 502)
    }
    return new Response(resultado, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    })
  } catch {
    return respuestaError('El servicio tardó demasiado o no respondió.', 502)
  }
}
