'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function obtenerEquipoInvitado(valor) {
  if (typeof valor !== 'number' && typeof valor !== 'string') return null
  if (typeof valor === 'string' && !/^\d+$/.test(valor)) return null
  const id = Number(valor)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}


const LIMITE_FOTO_ENTRADA = 15 * 1024 * 1024
const LIMITE_FOTO_SUBIDA = 2 * 1024 * 1024

async function optimizarFotografia(archivo) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
    throw new Error('Selecciona una imagen JPG, PNG o WebP.')
  }
  if (!archivo.size || archivo.size > LIMITE_FOTO_ENTRADA) {
    throw new Error('La fotografía debe pesar menos de 15 MB.')
  }
  if (archivo.size <= LIMITE_FOTO_SUBIDA) return archivo

  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  try {
    for (const maxDimension of [2000, 1600, 1200, 900, 700]) {
      const escala = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * escala))
      canvas.height = Math.max(1, Math.round(bitmap.height * escala))
      const contexto = canvas.getContext('2d')
      if (!contexto) throw new Error('No se pudo preparar la imagen.')
      contexto.fillStyle = '#ffffff'
      contexto.fillRect(0, 0, canvas.width, canvas.height)
      contexto.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const calidad of [0.88, 0.78, 0.65, 0.5]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', calidad))
        if (blob && blob.size <= LIMITE_FOTO_SUBIDA) {
          return new File([blob], archivo.name.replace(/\.[^.]+$/, '') + '-optimizada.jpg',
            { type: 'image/jpeg' })
        }
      }
    }
    throw new Error('No fue posible reducir esta fotografía a 2 MB. Intenta con otra imagen.')
  } finally {
    bitmap.close()
  }
}

export default function JugadorPage() {
  const router = useRouter()

  const [usuario, setUsuario] = useState(null)
  const [jugadorVinculado, setJugadorVinculado] = useState(null)
  const [fotoJugador, setFotoJugador] = useState('')
  const [fichaJugador, setFichaJugador] = useState(null)
  const [escudoEquipo, setEscudoEquipo] = useState('')
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [mensajeFoto, setMensajeFoto] = useState('')
  const [errorFoto, setErrorFoto] = useState('')
  const [fotoPendiente, setFotoPendiente] = useState(null)
  const [optimizandoFoto, setOptimizandoFoto] = useState(false)
  const [recortePendiente, setRecortePendiente] = useState(null)
  const [procesandoFoto, setProcesandoFoto] = useState(false)
  const [progresoFoto, setProgresoFoto] = useState('')
  const [vistaOriginal, setVistaOriginal] = useState('')
  const [vistaRecorte, setVistaRecorte] = useState('')

  useEffect(() => {
    if (!fotoPendiente) { setVistaOriginal(''); return }
    const url = URL.createObjectURL(fotoPendiente)
    setVistaOriginal(url)
    return () => URL.revokeObjectURL(url)
  }, [fotoPendiente])
  useEffect(() => {
    if (!recortePendiente) { setVistaRecorte(''); return }
    const url = URL.createObjectURL(recortePendiente)
    setVistaRecorte(url)
    return () => URL.revokeObjectURL(url)
  }, [recortePendiente])
  const [equipos, setEquipos] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [equipoId, setEquipoId] = useState('')
  const [equipoInvitadoNombre, setEquipoInvitadoNombre] = useState('')
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  // Perfil voluntario de jugador libre (no es parte de la plantilla).
  const [perfilLibre, setPerfilLibre] = useState(null)
  const [nombreLibre, setNombreLibre] = useState('')
  const [posicionLibre, setPosicionLibre] = useState('')
  const [historiaLibre, setHistoriaLibre] = useState('')
  const [cargandoLibre, setCargandoLibre] = useState(true)
  const [guardandoLibre, setGuardandoLibre] = useState(false)
  const [mensajeLibre, setMensajeLibre] = useState('')
  const [errorLibre, setErrorLibre] = useState('')

  // Invitaciones internas que los delegados envían a este jugador.
  const [invitaciones, setInvitaciones] = useState([])
  const [cargandoInvitaciones, setCargandoInvitaciones] = useState(true)
  const [procesandoInvitacion, setProcesandoInvitacion] = useState(null)
  const [mensajeInvitacion, setMensajeInvitacion] = useState('')
  const [errorInvitacion, setErrorInvitacion] = useState('')

  // Una solicitud aprobada con ficha vinculada significa que ya pertenece a la plantilla.
  const solicitudAprobada = solicitudes.find(s =>
    s.estado === 'aprobada' && s.jugador_id != null
  )
  const solicitudPendiente = solicitudes.find(s => s.estado === 'pendiente')
  const equipoPendiente = solicitudPendiente
    ? equipos.find(e => Number(e.id) === Number(solicitudPendiente.equipo_id))
    : null
  const equipoActual = solicitudAprobada
    ? equipos.find(e => Number(e.id) === Number(solicitudAprobada.equipo_id))
    : null
  const solicitudEnEquipoSeleccionado = solicitudes.find(s =>
    equipoId !== '' && Number(s.equipo_id) === Number(equipoId) &&
    ['pendiente', 'aprobada'].includes(s.estado)
  )

  useEffect(() => {
    let activo = true

    async function cargar() {
      try {
        const { data: auth, error: errorAuth } =
          await supabase.auth.getUser()

        if (!activo) return

        if (errorAuth || !auth.user) {
          // Conservar el equipo de la invitación si aún no inició sesión.
          const equipoEnlace = obtenerEquipoInvitado(
            new URLSearchParams(window.location.search).get('equipo')
          )
          router.replace(equipoEnlace
            ? `/login?equipo=${equipoEnlace}`
            : '/login')
          return
        }

        const user = auth.user

        const [respuestaEquipos, respuestaSolicitudes, respuestaLibre, respuestaInvitaciones] =
          await Promise.all([
            supabase
              .from('equipos')
              .select('id, nombre, escudo_url')
              .eq('activo', true)
              .order('nombre'),
            supabase
              .from('solicitudes_jugadores')
              .select('id, equipo_id, estado, jugador_id, created_at')
              .eq('usuario_id', user.id)
              .order('created_at', { ascending: false }),
            supabase
              .from('jugadores_libres')
              .select('usuario_id, nombre, posicion, historia, disponible')
              .eq('usuario_id', user.id)
              .maybeSingle(),
            supabase
              .from('invitaciones_jugadores')
              .select('id, equipo_id, estado, created_at')
              .eq('jugador_usuario_id', user.id)
              .eq('estado', 'pendiente')
              .order('created_at', { ascending: false })
          ])

        if (!activo) return

        setUsuario(user)
        setNombre(user.user_metadata?.nombre || '')

        if (respuestaInvitaciones.error) {
          setErrorInvitacion('No se pudieron cargar tus invitaciones: ' +
            respuestaInvitaciones.error.message)
        } else {
          setInvitaciones(respuestaInvitaciones.data || [])
        }

        // Los errores del directorio no bloquean las solicitudes normales.
        if (respuestaLibre.error) {
          setErrorLibre('No se pudo cargar el perfil de jugador libre: ' +
            respuestaLibre.error.message)
          setNombreLibre(user.user_metadata?.nombre || '')
        } else {
          const libre = respuestaLibre.data || null
          setPerfilLibre(libre)
          setNombreLibre(libre?.nombre || user.user_metadata?.nombre || '')
          setPosicionLibre(libre?.posicion || '')
          setHistoriaLibre(libre?.historia || '')
        }

        if (respuestaEquipos.error || respuestaSolicitudes.error) {
          setError(
            respuestaEquipos.error?.message ||
            respuestaSolicitudes.error?.message
          )
          return
        }

        const listaEquipos = respuestaEquipos.data || []
        const listaSolicitudes = respuestaSolicitudes.data || []

        setEquipos(listaEquipos)
        setSolicitudes(listaSolicitudes)

        // La fotografía oficial solo corresponde a un jugador aprobado.
        const aprobada = listaSolicitudes.find(s =>
          s.estado === 'aprobada' && s.jugador_id != null
        )
        if (aprobada) {
          const { data: ficha, error: errorFicha } = await supabase
            .from('jugadores')
            .select('id, nombre, numero, foto_url, foto_uniforme_url')
            .eq('id', aprobada.jugador_id)
            .maybeSingle()
          if (!activo) return
          if (errorFicha) {
            setErrorFoto('No se pudo cargar tu fotografía: ' + errorFicha.message)
          } else if (ficha) {
            setJugadorVinculado(ficha.id)
            setFichaJugador(ficha)
            setEscudoEquipo(listaEquipos.find(e => Number(e.id) === Number(aprobada.equipo_id))?.escudo_url || '')
            setFotoJugador(ficha.foto_url || '')
          }
        }

        // Invitación de equipo: reconocer tanto el enlace usado por una
        // cuenta EXISTENTE (?equipo=19) como el dato guardado al registrarse.
        // El enlace tiene prioridad, pero nunca concede ingreso por sí mismo.
        const equipoEnlace = obtenerEquipoInvitado(
          new URLSearchParams(window.location.search).get('equipo')
        )
        const invitacionId = equipoEnlace ?? obtenerEquipoInvitado(
          user.user_metadata?.equipo_invitacion
        )

        if (invitacionId === null) return

        const equipoInvitado = listaEquipos.find(
          equipo => Number(equipo.id) === invitacionId
        )

        if (!equipoInvitado) {
          setMensaje(
            'El equipo de tu invitación ya no está disponible. ' +
            'Puedes seleccionar otro equipo.'
          )
          return
        }

        // Ya tiene ficha aprobada: no crear solicitudes automáticas adicionales.
        if (aprobada) {
          const equipoPertenencia = listaEquipos.find(e =>
            Number(e.id) === Number(aprobada.equipo_id)
          )
          setMensaje('Ya perteneces a ' +
            (equipoPertenencia?.nombre || 'un equipo') +
            '. No necesitas solicitar ingreso nuevamente.')
          return
        }

        setEquipoId(String(invitacionId))
        setEquipoInvitadoNombre(equipoInvitado.nombre)

        // No volver a enviar automáticamente una invitación si ya hubo
        // una solicitud, incluso si fue rechazada.
        const solicitudAnterior = listaSolicitudes.find(
          s => Number(s.equipo_id) === invitacionId
        )

        if (solicitudAnterior) {
          if (solicitudAnterior.estado === 'rechazada') {
            setMensaje(
              'Tu solicitud anterior fue rechazada. ' +
              'Si deseas volver a solicitar ingreso, usa el formulario.'
            )
          } else {
            setMensaje(
              'Ya tienes una solicitud para ' + equipoInvitado.nombre +
              ' (estado: ' + solicitudAnterior.estado + ').'
            )
          }
          return
        }

        const nombreLimpio = String(user.user_metadata?.nombre || '').trim()

        if (nombreLimpio.length < 2 || nombreLimpio.length > 120) {
          setMensaje(
            'Recibimos tu invitación para ' + equipoInvitado.nombre +
            '. Completa tu nombre y envía la solicitud con el formulario.'
          )
          return
        }

        // Solo creamos una solicitud pendiente; NO agregamos al jugador
        // a la plantilla. El delegado decide si la aprueba.
        const { error: errorInsertar } = await supabase
          .from('solicitudes_jugadores')
          .insert({
            usuario_id: user.id,
            equipo_id: invitacionId,
            nombre: nombreLimpio,
            numero: null,
            estado: 'pendiente'
          })

        if (!activo) return

        if (errorInsertar) {
          if (errorInsertar.code === '23505') {
            setMensaje('Ya existe una solicitud para este equipo.')
          } else {
            setError(
              'No se pudo enviar automáticamente la invitación: ' +
              errorInsertar.message +
              '. Puedes intentar con el formulario.'
            )
          }
          return
        }

        const { data: solicitudesActualizadas, error: errorConsulta } =
          await supabase
            .from('solicitudes_jugadores')
            .select('id, equipo_id, estado, jugador_id, created_at')
            .eq('usuario_id', user.id)
            .order('created_at', { ascending: false })

        if (!activo) return

        if (errorConsulta) {
          setMensaje(
            'Tu solicitud se envió a ' + equipoInvitado.nombre +
            ', pero no se pudo actualizar la lista. Recarga la página.'
          )
        } else {
          setSolicitudes(solicitudesActualizadas || [])
          setMensaje(
            '¡Solicitud enviada automáticamente a ' +
            equipoInvitado.nombre + '! Espera la aprobación del delegado.'
          )
        }
      } catch (err) {
        if (activo) {
          setError(err.message || 'No se pudo cargar el panel.')
        }
      } finally {
        if (activo) {
          setCargando(false)
          setCargandoLibre(false)
          setCargandoInvitaciones(false)
        }
      }
    }

    cargar()

    return () => {
      activo = false
    }
  }, [router])

  async function solicitarIngreso(e) {
    e.preventDefault()
    if (guardando) return

    setError('')
    setMensaje('')

    if (solicitudAprobada) {
      setError('Ya perteneces a ' + (equipoActual?.nombre || 'un equipo') +
        '. No necesitas enviar otra solicitud.')
      return
    }

    const idSeleccionado = Number(equipoId)

    if (!usuario || !Number.isSafeInteger(idSeleccionado) ||
        idSeleccionado < 1) {
      setError('Selecciona un equipo.')
      return
    }

    const nombreLimpio = nombre.trim()

    if (nombreLimpio.length < 2 || nombreLimpio.length > 120) {
      setError('Escribe tu nombre completo.')
      return
    }

    const numeroLimpio = numero.trim()

    if (numeroLimpio !== '' && !/^\d+$/.test(numeroLimpio)) {
      setError('El número de camiseta debe ser un entero.')
      return
    }

    const numeroJugador = numeroLimpio === ''
      ? null
      : Number(numeroLimpio)

    if (numeroJugador !== null &&
        (!Number.isSafeInteger(numeroJugador) || numeroJugador > 999)) {
      setError('Escribe un número de camiseta válido.')
      return
    }

    const repetida = solicitudes.some(s =>
      Number(s.equipo_id) === idSeleccionado &&
      ['pendiente', 'aprobada'].includes(s.estado)
    )

    if (repetida) {
      setError('Ya tienes una solicitud pendiente o aprobada para este equipo.')
      return
    }

    setGuardando(true)

    try {
      // Confirmar que no fue aprobado para una plantilla desde otra sesión.
      const { data: aprobacionesActuales, error: errorAprobaciones } = await supabase
        .from('solicitudes_jugadores')
        .select('id, jugador_id')
        .eq('usuario_id', usuario.id)
        .eq('estado', 'aprobada')

      if (errorAprobaciones) throw errorAprobaciones
      if ((aprobacionesActuales || []).some(s => s.jugador_id != null)) {
        setError('Ya perteneces a un equipo. Actualiza la página para ver tu plantilla.')
        return
      }

      // Volvemos a revisar antes de insertar por si hubo cambios
      // desde que se cargó la página.
      const { data: existentes, error: errorExistentes } = await supabase
        .from('solicitudes_jugadores')
        .select('id')
        .eq('usuario_id', usuario.id)
        .eq('equipo_id', idSeleccionado)
        .in('estado', ['pendiente', 'aprobada'])
        .limit(1)

      if (errorExistentes) throw errorExistentes

      if (existentes && existentes.length > 0) {
        setError('Ya tienes una solicitud pendiente o aprobada para este equipo.')
        return
      }

      const { error: errorInsertar } = await supabase
        .from('solicitudes_jugadores')
        .insert({
          usuario_id: usuario.id,
          equipo_id: idSeleccionado,
          nombre: nombreLimpio,
          numero: numeroJugador,
          estado: 'pendiente'
        })

      if (errorInsertar) throw errorInsertar

      const { data, error: errorConsulta } = await supabase
        .from('solicitudes_jugadores')
        .select('id, equipo_id, estado, jugador_id, created_at')
        .eq('usuario_id', usuario.id)
        .order('created_at', { ascending: false })

      if (errorConsulta) {
        setMensaje(
          'Solicitud enviada, pero no se pudo actualizar la lista. ' +
          'Recarga la página.'
        )
      } else {
        setSolicitudes(data || [])
        setMensaje(
          'Solicitud enviada correctamente. ' +
          'Espera la aprobación del delegado.'
        )
      }

      setEquipoId('')
      setNumero('')
    } catch (err) {
      setError('No se pudo enviar: ' + (err.message || 'Error desconocido.'))
    } finally {
      setGuardando(false)
    }
  }

  async function responderInvitacion(id, aceptar) {
    if (procesandoInvitacion !== null || !usuario) return
    setProcesandoInvitacion(id)
    setMensajeInvitacion('')
    setErrorInvitacion('')
    try {
      const { data: respuesta, error: errorRPC } = await supabase.rpc(
        'responder_invitacion_jugador',
        { p_invitacion_id: id, p_aceptar: aceptar }
      )
      if (errorRPC) throw errorRPC
      setInvitaciones(actuales => actuales.filter(i => i.id !== id))
      setMensajeInvitacion(respuesta || (aceptar
        ? 'Invitación aceptada. Espera la aprobación del delegado.'
        : 'Invitación rechazada.'))

      if (aceptar) {
        const { data, error: errorConsulta } = await supabase
          .from('solicitudes_jugadores')
          .select('id, equipo_id, estado, jugador_id, created_at')
          .eq('usuario_id', usuario.id)
          .order('created_at', { ascending: false })
        if (errorConsulta) {
          setErrorInvitacion('Se aceptó la invitación, pero no se pudo actualizar la lista de solicitudes. Recarga la página.')
        } else {
          setSolicitudes(data || [])
        }
      }
    } catch (err) {
      setErrorInvitacion('No se pudo responder: ' + (err.message || 'Error desconocido.'))
    } finally {
      setProcesandoInvitacion(null)
    }
  }

  async function publicarJugadorLibre(e) {
    e.preventDefault()
    if (!usuario || guardandoLibre || cargandoLibre) return

    setMensajeLibre('')
    setErrorLibre('')

    const nombreLimpio = nombreLibre.trim()
    if (nombreLimpio.length < 2 || nombreLimpio.length > 120) {
      setErrorLibre('Escribe tu nombre completo (entre 2 y 120 caracteres).')
      return
    }

    const historiaLimpia = historiaLibre.trim()
    if (historiaLimpia.length > 500) {
      setErrorLibre('Tu historia debe tener 500 caracteres como máximo.')
      return
    }

    setGuardandoLibre(true)
    try {
      const perfil = {
        usuario_id: usuario.id,
        nombre: nombreLimpio,
        posicion: posicionLibre || null,
        historia: historiaLimpia || null,
        disponible: true
      }
      const { error: errorGuardar } = await supabase
        .from('jugadores_libres')
        .upsert(perfil, { onConflict: 'usuario_id' })

      if (errorGuardar) throw errorGuardar
      setPerfilLibre(perfil)
      setMensajeLibre(
        'Tu perfil de jugador libre está visible solo para delegados y administradores. '
        + 'No te incorpora automáticamente a ningún equipo.'
      )
    } catch (err) {
      setErrorLibre('No se pudo publicar el perfil: ' + err.message)
    } finally {
      setGuardandoLibre(false)
    }
  }

  async function dejarDeSerLibre() {
    if (!usuario || guardandoLibre || !perfilLibre?.disponible) return
    setMensajeLibre('')
    setErrorLibre('')
    setGuardandoLibre(true)
    try {
      const { data, error: errorGuardar } = await supabase
        .from('jugadores_libres')
        .update({ disponible: false })
        .eq('usuario_id', usuario.id)
        .select('usuario_id')

      if (errorGuardar) throw errorGuardar
      if (!data || data.length !== 1) {
        throw new Error('No se pudo confirmar el cambio de disponibilidad.')
      }
      setPerfilLibre(actual => ({ ...actual, disponible: false }))
      setMensajeLibre('Ya no apareces en el directorio de jugadores libres.')
    } catch (err) {
      setErrorLibre('No se pudo cambiar tu disponibilidad: ' + err.message)
    } finally {
      setGuardandoLibre(false)
    }
  }

  async function seleccionarMiFoto(e) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo || !usuario || !jugadorVinculado || subiendoFoto || optimizandoFoto) return

    setErrorFoto('')
    setMensajeFoto('')
    const tipos = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    }
    const extension = tipos[archivo.type]
    if (!extension) {
      setErrorFoto('Selecciona una imagen JPG, PNG o WebP.')
      return
    }
    setOptimizandoFoto(true)
    setProgresoFoto('Optimizando fotografía…')
    try {
      const optimizada = await optimizarFotografia(archivo)
      setFotoPendiente(optimizada)
      setRecortePendiente(null)
      setProgresoFoto(optimizada.size < archivo.size ? 'Fotografía optimizada y lista para revisar.' : '')
    } catch (err) {
      setErrorFoto(err.message || 'No se pudo procesar la fotografía.')
      setProgresoFoto('')
    } finally {
      setOptimizandoFoto(false)
    }
  }

  async function prepararRecorte() {
    if (!fotoPendiente || procesandoFoto || subiendoFoto || optimizandoFoto) return
    setProcesandoFoto(true)
    setErrorFoto('')
    setProgresoFoto('Preparando herramienta gratuita…')
    try {
      const { quitarFondoLocal } = await import(/* webpackIgnore: true */ '/modnet-browser.js')
      const png = await quitarFondoLocal(fotoPendiente, setProgresoFoto)
      setRecortePendiente(png)
      setProgresoFoto('Recorte listo. Revísalo antes de guardarlo.')
    } catch (err) {
      setErrorFoto('No se pudo quitar el fondo. Puedes conservar la original o intentar nuevamente. ' + (err.message || ''))
      setProgresoFoto('')
    } finally {
      setProcesandoFoto(false)
    }
  }

  async function subirMiFoto(usarRecorte) {
    const archivo = fotoPendiente
    if (!archivo || !usuario || !jugadorVinculado || subiendoFoto || procesandoFoto || optimizandoFoto) return
    if (usarRecorte && !recortePendiente) return
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[archivo.type]
    setErrorFoto('')
    setMensajeFoto('')
    setSubiendoFoto(true)
    const rutasNuevas = []
    try {
      const identificador = crypto.randomUUID()
      // Siempre conservar el archivo original, aunque se quite el fondo.
      const rutaOriginal = `${usuario.id}/${identificador}-original.${extension}`
      const { error: errorSubida } = await supabase.storage
        .from('fotos-jugadores')
        .upload(rutaOriginal, archivo, { contentType: archivo.type, upsert: false })
      if (errorSubida) throw errorSubida
      rutasNuevas.push(rutaOriginal)

      const { data: original } = supabase.storage
        .from('fotos-jugadores').getPublicUrl(rutaOriginal)
      if (!original?.publicUrl) throw new Error('No se pudo obtener la URL original.')

      let fotoPublica = original.publicUrl
      if (usarRecorte) {
        const ruta = `${usuario.id}/${identificador}-sin-fondo.png`
        const { error: errorPNG } = await supabase.storage.from('fotos-jugadores')
          .upload(ruta, recortePendiente, { contentType: 'image/png', upsert: false })
        if (errorPNG) throw errorPNG
        rutasNuevas.push(ruta)
        const { data: procesada } = supabase.storage.from('fotos-jugadores').getPublicUrl(ruta)
        if (!procesada?.publicUrl) throw new Error('No se obtuvo la URL del recorte.')
        fotoPublica = procesada.publicUrl
      }

      // Mantenemos la RPC oficial, que vincula la foto al jugador autorizado.
      const { error: errorVincular } = await supabase.rpc(
        'actualizar_mi_foto',
        { p_foto_url: fotoPublica }
      )
      if (errorVincular) throw errorVincular

      setFotoJugador(fotoPublica)
      setMensajeFoto(usarRecorte
        ? '¡Fotografía sin fondo actualizada! Conservamos la original.'
        : '¡Fotografía original actualizada!')
      setFotoPendiente(null)
      setRecortePendiente(null)
    } catch (err) {
      // Solo limpiamos los archivos de este intento si no se pudo vincular.
      if (rutasNuevas.length) {
        await supabase.storage.from('fotos-jugadores').remove(rutasNuevas)
      }
      setErrorFoto('No se pudo guardar tu fotografía: ' + (err.message || 'Error desconocido.'))
    } finally {
      setSubiendoFoto(false)
    }
  }

  async function cerrarSesion() {
    const { error: errorSalida } = await supabase.auth.signOut()

    if (errorSalida) {
      setError('No se pudo cerrar la sesión.')
      return
    }

    router.replace('/login')
    router.refresh()
  }

  const inputStyle = {
    width: '100%',
    padding: '12px',
    marginTop: '6px',
    marginBottom: '18px',
    boxSizing: 'border-box',
    border: '1px solid #ccc',
    borderRadius: '6px'
  }

  if (cargando) {
    return <main style={{ padding: 30 }}>Cargando...</main>
  }

  return (
    <main style={{
      maxWidth: '750px',
      margin: '40px auto',
      padding: '20px'
    }}>
      <h1>Mi Panel de Jugador</h1>
      <p>Yuba Sutter Adult Soccer League</p>
    <a
  href="/mis-paneles"
  style={{
    display: 'inline-block',
    background: '#166534',
    color: 'white',
    padding: '12px 18px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: 'bold',
    marginTop: '10px',
    marginRight: '12px'
  }}
>
  🔄 Mis Paneles
</a>

      <p>Bienvenido, {nombre || usuario?.email}</p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => router.push('/mis-paneles')}>Cambiar de panel</button>
        <button type="button" onClick={cerrarSesion}>Cerrar sesión</button>
      </div>

      <hr style={{ margin: '30px 0' }} />

      <section style={{
        padding: '20px',
        border: '1px solid #cbd5e1',
        borderRadius: '10px',
        marginBottom: '30px',
        background: '#f8fafc'
      }}>
        <h2 style={{ marginTop: 0 }}>📸 Mi fotografía de jugador</h2>
<div style={{
  background: '#eef6ff',
  border: '1px solid #c8def5',
  borderRadius: 12,
  padding: '14px 18px',
  marginBottom: 18,
  color: '#17365a'
}}>
  <strong>📸 ¡Luce los colores de tu equipo!</strong>
  <p style={{ marginBottom: 0, lineHeight: 1.7 }}>
    Para que todos los jugadores de YSASL tengan una
    presentación profesional, toma tu fotografía:
    <br />⚽ Con la camiseta oficial de tu equipo.
    <br />📷 De frente, del pecho hacia arriba.
    <br />☀️ Con buena iluminación y fondo sencillo.
    <br />🚫 Sin filtros, gorras ni lentes oscuros.
  </p>
</div>
        {jugadorVinculado ? (
          <>
            {fotoJugador ? (
              <img
                src={fotoJugador}
                alt="Mi fotografía de jugador"
                width={320}
height={320}
                style={{
                  objectFit: 'contain',
                  objectPosition: 'center center',
                  borderRadius: '50%',
                  display: 'block',
                  margin: '0 auto 15px'
                }}
              />
            ) : (
              <p>Aún no has agregado una fotografía.</p>
            )}
            <p style={{ color: '#475569' }}>
              Esta fotografía será pública en tu ficha y podrá aparecer en Líderes de Goleo.
            </p>
            <p>Quita el fondo gratis y revisa el resultado antes de guardar. La primera descarga puede tardar; la fotografía se procesa en tu dispositivo.</p>
            <label htmlFor="foto-jugador" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              {fotoJugador ? 'Cambiar mi fotografía' : 'Subir mi fotografía'}
            </label>
            <input
              id="foto-jugador"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={seleccionarMiFoto}
              disabled={subiendoFoto || procesandoFoto || optimizandoFoto}
            />
            <p style={{ fontSize: '13px', color: '#64748b' }}>JPG, PNG o WebP. Hasta 15 MB; se optimiza automáticamente a 2 MB antes de subir.</p>
            {optimizandoFoto && <p role="status">Optimizando fotografía…</p>}
            {fotoPendiente && (
              <div style={{ border: '1px solid #cbd5e1', borderRadius: 10, padding: 16, marginTop: 16 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <strong>Original</strong>
                    {vistaOriginal && <img src={vistaOriginal} alt="Vista previa original" style={{ width: '100%', height: 260, objectFit: 'contain' }} />}
                  </div>
                  {vistaRecorte && <div style={{ flex: '1 1 200px', background: '#dce9e1' }}>
                    <strong>Sin fondo</strong>
                    <img src={vistaRecorte} alt="Vista previa sin fondo" style={{ width: '100%', height: 260, objectFit: 'contain' }} />
                  </div>}
                </div>

                <div style={{ margin: '22px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <strong>Así se verá tu tarjeta oficial</strong>
                  <p style={{ margin: 0, color: '#475569', fontSize: 13, textAlign: 'center' }}>
                    Vista previa solamente. Tu fotografía pública no cambiará hasta que guardes.
                  </p>
                  {(() => {
                    const equipo = equipoActual
                    const paletas = [
                      ['#102a43', '#0a192c', '#e1bd6a'],
                      ['#12453b', '#092c26', '#e4c777'],
                      ['#632c3b', '#361923', '#e5bd72'],
                      ['#193d70', '#0c2342', '#e4c47c'],
                      ['#554020', '#302514', '#f0cf83'],
                      ['#40345d', '#241d3b', '#e1c28c'],
                    ]
                    const indice = Number(equipo?.id || 0) % paletas.length
                    const [primario, oscuro, dorado] = equipo?.nombre?.trim().toLocaleUpperCase('es') === 'LA VALLARTA FC'
                      ? ['#07543f', '#002c24', '#e8c46a']
                      : paletas[indice]
                    const imagen = vistaRecorte || vistaOriginal
                    return (
                      <article aria-label="Vista previa de tarjeta oficial" style={{
                        width: '100%', maxWidth: 245, overflow: 'hidden',
                        border: `2px solid ${dorado}`, borderRadius: 21,
                        background: oscuro, color: '#fff',
                        boxShadow: '0 12px 28px rgba(9,26,45,.22)',
                      }}>
                        <div style={{ position: 'relative', height: 310, overflow: 'hidden',
                          background: `linear-gradient(155deg, ${primario} 8%, ${oscuro} 88%)` }}>
                          {escudoEquipo && <img src={escudoEquipo} alt="" aria-hidden="true"
                            style={{ position: 'absolute', width: 205, height: 205, objectFit: 'contain',
                              opacity: 0.12, top: 27, right: -37 }} />}
                          {imagen && <img src={imagen} alt="Fotografía en la tarjeta"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                              objectFit: 'cover', objectPosition: '55% 22%',
                              transform: Number(fichaJugador?.id) === 28
                                ? 'translateY(16px) scale(1)' : 'translateY(-12px) scale(1.05)',
                              transformOrigin: 'center center' }} />}
                          <div style={{ position: 'absolute', top: 13, left: 13, borderRadius: 11,
                            background: oscuro, border: `2px solid ${dorado}`, color: dorado,
                            padding: '8px 12px', fontWeight: 900, fontSize: 25, lineHeight: 1 }}>
                            {fichaJugador?.numero ?? '—'}
                          </div>
                          {escudoEquipo && Number(fichaJugador?.id) !== 28 && (
                            <div style={{ position: 'absolute', right: 11, bottom: 11,
                              width: 61, height: 61, background: '#fffffff2', borderRadius: 13,
                              padding: 6, display: 'grid', placeItems: 'center' }}>
                              <img src={escudoEquipo} alt="" aria-hidden="true"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            </div>
                          )}
                        </div>
                        <div style={{ height: 4, background: `linear-gradient(90deg, ${dorado}, #fff4b6, ${dorado})` }} />
                        <div style={{ padding: '18px 12px 20px', textAlign: 'center' }}>
                          <p style={{ margin: '0 0 9px', color: dorado, fontSize: 11,
                            fontWeight: 800, letterSpacing: 2 }}>YSASL · JUGADOR</p>
                          <h3 style={{ margin: '0 0 14px', fontSize: 19, fontWeight: 900,
                            textTransform: 'uppercase', lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                            {fichaJugador?.nombre || 'JUGADOR'}
                          </h3>
                          <div style={{ padding: '8px 12px', borderRadius: 25,
                            border: '1px solid #ffffff33', background: '#ffffff12',
                            fontSize: 12, fontWeight: 800 }}>{equipo?.nombre || 'MI EQUIPO'}</div>
                        </div>
                      </article>
                    )
                  })()}
                  <span style={{ fontSize: 12, color: '#475569' }}>
                    {vistaRecorte ? 'Mostrando la versión sin fondo.' : 'Mostrando la versión original.'}
                  </span>
                </div>
                <p>Selecciona la versión que quieres publicar. Tu foto actual cambia al guardar.</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  <button type="button" onClick={prepararRecorte} disabled={procesandoFoto || subiendoFoto}>
                    {procesandoFoto ? 'Quitando fondo…' : 'Quitar fondo gratis'}
                  </button>
                  {recortePendiente && <button type="button" onClick={() => subirMiFoto(true)} disabled={procesandoFoto || subiendoFoto}>Aceptar recorte y guardar</button>}
                  <button type="button" onClick={() => subirMiFoto(false)} disabled={procesandoFoto || subiendoFoto}>Guardar original</button>
                  <button type="button" onClick={() => { setFotoPendiente(null); setRecortePendiente(null); setProgresoFoto(''); setErrorFoto('') }} disabled={procesandoFoto || subiendoFoto}>Cancelar</button>
                </div>
                {progresoFoto && <p role="status" aria-live="polite">{progresoFoto}</p>}
              </div>
            )}
            {subiendoFoto && <p role="status">Guardando y preparando fotografía...</p>}
            {mensajeFoto && <p role="status" style={{ color: '#166534' }}>{mensajeFoto}</p>}
            {errorFoto && <p role="alert" style={{ color: '#b91c1c' }}>{errorFoto}</p>}
          </>
        ) : (
          <>
            <p>Podrás publicar tu fotografía oficial cuando el delegado apruebe tu solicitud y tu cuenta esté vinculada a la plantilla.</p>
            {equipoPendiente ? (
              <div style={{ border: '1px solid #d6b65d', borderRadius: 12, padding: 16, background: '#fffdf3' }}>
                <strong>Tu tarjeta de muestra — pendiente de aprobación</strong>
                <p style={{ fontSize: 13, color: '#475569' }}>
                  Puedes probar tu fotografía aquí sin publicarla ni agregarla a la plantilla oficial.
                </p>
                <label htmlFor="foto-muestra" style={{ display: 'block', fontWeight: 700, marginBottom: 8 }}>
                  Elegir fotografía para la muestra
                </label>
                <input id="foto-muestra" type="file" accept="image/jpeg,image/png,image/webp"
                  disabled={procesandoFoto || optimizandoFoto}
                  onChange={async e => {
                    const archivo = e.target.files?.[0]
                    e.target.value = ''
                    if (!archivo) return
                    setErrorFoto('')
                    setOptimizandoFoto(true)
                    setProgresoFoto('Optimizando fotografía…')
                    try {
                      const optimizada = await optimizarFotografia(archivo)
                      setFotoPendiente(optimizada)
                      setRecortePendiente(null)
                      setProgresoFoto(optimizada.size < archivo.size ? 'Fotografía optimizada y lista para revisar.' : '')
                    } catch (err) {
                      setErrorFoto(err.message || 'No se pudo procesar la fotografía.')
                      setProgresoFoto('')
                    } finally {
                      setOptimizandoFoto(false)
                    }
                  }} />
                {fotoPendiente && (
                  <>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12 }}>
                      {vistaOriginal && <img src={vistaOriginal} alt="Fotografía original de muestra"
                        style={{ width: 170, height: 160, objectFit: 'contain' }} />}
                      {vistaRecorte && <img src={vistaRecorte} alt="Fotografía sin fondo de muestra"
                        style={{ width: 170, height: 160, objectFit: 'contain', background: '#dce9e1' }} />}
                    </div>
                    <button type="button" onClick={prepararRecorte} disabled={procesandoFoto}
                      style={{ marginTop: 10 }}>{procesandoFoto ? 'Quitando fondo…' : 'Quitar fondo gratis'}</button>
                    <button type="button" onClick={() => { setFotoPendiente(null); setRecortePendiente(null); setErrorFoto(''); setProgresoFoto('') }}
                      disabled={procesandoFoto} style={{ marginLeft: 10 }}>Descartar muestra</button>
                    {progresoFoto && <p role="status">{progresoFoto}</p>}
                  </>
                )}
                {(() => {
                  const paletas = [
                    ['#102a43', '#0a192c', '#e1bd6a'], ['#12453b', '#092c26', '#e4c777'],
                    ['#632c3b', '#361923', '#e5bd72'], ['#193d70', '#0c2342', '#e4c47c'],
                    ['#554020', '#302514', '#f0cf83'], ['#40345d', '#241d3b', '#e1c28c']
                  ]
                  const [primario, oscuro, dorado] = equipoPendiente.nombre?.trim().toLocaleUpperCase('es') === 'LA VALLARTA FC'
                    ? ['#07543f', '#002c24', '#e8c46a']
                    : paletas[Number(equipoPendiente.id) % paletas.length]
                  const imagen = vistaRecorte || vistaOriginal
                  return (
                    <article aria-label="Tarjeta de muestra pendiente de aprobación" style={{
                      width: '100%', maxWidth: 245, margin: '20px auto 0', border: `2px solid ${dorado}`,
                      borderRadius: 21, overflow: 'hidden', background: oscuro, color: 'white',
                      boxShadow: '0 12px 28px rgba(9,26,45,.22)'
                    }}>
                      <div style={{ position: 'relative', height: 310, overflow: 'hidden',
                        background: `linear-gradient(155deg, ${primario} 8%, ${oscuro} 88%)` }}>
                        {equipoPendiente.escudo_url && <img src={equipoPendiente.escudo_url}
                          alt="" aria-hidden="true" style={{ position: 'absolute', width: 205, height: 205,
                            objectFit: 'contain', opacity: 0.12, top: 27, right: -37 }} />}
                        {imagen ? <img src={imagen} alt="Fotografía en tarjeta de muestra"
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
                            objectFit: 'cover', objectPosition: '55% 22%',
                            transform: 'translateY(-12px) scale(1.05)' }} /> :
                          <div style={{ height: '100%', display: 'grid', placeItems: 'center',
                            color: '#ffffffbb' }}>Tu fotografía aquí</div>}
                        <div style={{ position: 'absolute', top: 13, left: 13, borderRadius: 11,
                          background: oscuro, border: `2px solid ${dorado}`, color: dorado,
                          padding: '8px 12px', fontWeight: 900, fontSize: 25 }}>—</div>
                        {equipoPendiente.escudo_url && <div style={{
                          position: 'absolute', right: 11, bottom: 11, width: 61, height: 61,
                          background: '#fffffff2', borderRadius: 13, padding: 6,
                          display: 'grid', placeItems: 'center'
                        }}><img src={equipoPendiente.escudo_url} alt="" aria-hidden="true"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>}
                      </div>
                      <div style={{ height: 4, background: `linear-gradient(90deg, ${dorado}, #fff4b6, ${dorado})` }} />
                      <div style={{ padding: '18px 12px 20px', textAlign: 'center' }}>
                        <p style={{ color: dorado, fontWeight: 800, fontSize: 11, letterSpacing: 2 }}>YSASL · JUGADOR</p>
                        <h3 style={{ fontSize: 19, fontWeight: 900, textTransform: 'uppercase', overflowWrap: 'anywhere' }}>
                          {nombre || usuario?.user_metadata?.nombre || 'JUGADOR'}
                        </h3>
                        <div style={{ border: '1px solid #ffffff33', background: '#ffffff12',
                          padding: 8, borderRadius: 25, fontSize: 12, fontWeight: 800 }}>
                          {equipoPendiente.nombre}
                        </div>
                        <p style={{ color: dorado, fontSize: 12, fontWeight: 900, marginBottom: 0 }}>
                          VISTA PREVIA — PENDIENTE DE APROBACIÓN
                        </p>
                      </div>
                    </article>
                  )
                })()}
                <p style={{ fontSize: 12, color: '#475569' }}>
                  La muestra solo existe en esta pantalla. No se guarda ni se publica.
                  Cuando seas aprobado, podrás subir tu fotografía oficial.
                </p>
              </div>
            ) : (
              <p>Cuando solicites ingresar a un equipo podrás ver aquí una tarjeta de muestra.</p>
            )}
            {errorFoto && <p role="alert" style={{ color: '#b91c1c' }}>{errorFoto}</p>}
          </>
        )}
      </section>

      {equipoInvitadoNombre && !solicitudAprobada && (
        <div style={{
          border: '1px solid #bfd7f0',
          borderRadius: '8px',
          padding: '15px',
          background: '#f0f7ff',
          marginBottom: '20px'
        }}>
          <strong>Invitación de {equipoInvitadoNombre}</strong>
          <p>El delegado debe aprobarte antes de ingresar a la plantilla.</p>
        </div>
      )}

      <section style={{
        border: '1px solid #d5e2ee',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '30px',
        background: '#f5f9fd'
      }}>
        <h2 style={{ marginTop: 0 }}>Invitaciones de equipos</h2>
        <p>
          Los delegados pueden invitarte desde el directorio privado.
          Tú decides si aceptas. Si aceptas, se enviará una solicitud que
          el delegado deberá aprobar antes de incorporarte a su plantilla.
        </p>
        {cargandoInvitaciones ? (
          <p>Buscando invitaciones...</p>
        ) : invitaciones.length === 0 ? (
          <p>No tienes invitaciones pendientes.</p>
        ) : (
          invitaciones.map(invitacion => {
            const equipo = equipos.find(e => Number(e.id) === Number(invitacion.equipo_id))
            return (
              <div key={invitacion.id} style={{
                background: 'white', border: '1px solid #cbd5e1',
                borderRadius: '8px', padding: '15px', marginBottom: '12px'
              }}>
                <strong>{equipo?.nombre || `Equipo #${invitacion.equipo_id}`}</strong>
                <p>Este equipo quiere invitarte a su plantilla.</p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={procesandoInvitacion !== null}
                    onClick={() => responderInvitacion(invitacion.id, true)}
                    style={{ background: '#166534', color: 'white', padding: '10px 14px', border: 0, borderRadius: '6px' }}
                  >
                    {procesandoInvitacion === invitacion.id ? 'Procesando...' : 'Aceptar invitación'}
                  </button>
                  <button
                    type="button"
                    disabled={procesandoInvitacion !== null}
                    onClick={() => responderInvitacion(invitacion.id, false)}
                    style={{ background: '#fff', color: '#991b1b', padding: '10px 14px', border: '1px solid #fca5a5', borderRadius: '6px' }}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            )
          })
        )}
        {mensajeInvitacion && <p role="status" style={{ color: '#166534' }}>{mensajeInvitacion}</p>}
        {errorInvitacion && <p role="alert" style={{ color: '#b91c1c' }}>{errorInvitacion}</p>}
      </section>

      {/* Quien ya tiene una ficha aprobada no debe solicitar aparecer como jugador libre. */}
      {!solicitudAprobada && (
      <section style={{
        border: '1px solid #cbd5e1',
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h2 style={{ marginTop: 0 }}>Soy jugador libre</h2>
        <p>
          ¿Todavía no tienes equipo? Puedes aparecer voluntariamente en un
          directorio privado que solo consultan los delegados autorizados
          y administradores de YSASL. No mostraremos tu correo ni contraseña.
        </p>
        <p>
          Registrarte como jugador libre no te agrega a ninguna plantilla.
          Para ingresar a un equipo siempre necesitarás su aprobación.
        </p>

        {cargandoLibre ? (
          <p>Cargando tu disponibilidad...</p>
        ) : (
          <form onSubmit={publicarJugadorLibre}>
            <label htmlFor="nombre-libre">Nombre completo</label>
            <input
              id="nombre-libre"
              value={nombreLibre}
              onChange={e => setNombreLibre(e.target.value)}
              required
              maxLength={120}
              style={inputStyle}
            />

            <label htmlFor="posicion-libre">Posición (opcional)</label>
            <select
              id="posicion-libre"
              value={posicionLibre}
              onChange={e => setPosicionLibre(e.target.value)}
              style={inputStyle}
            >
              <option value="">Sin preferencia</option>
              <option value="Portero">Portero</option>
              <option value="Defensa">Defensa</option>
              <option value="Mediocampista">Mediocampista</option>
              <option value="Delantero">Delantero</option>
            </select>

            <label htmlFor="historia-libre">Cuéntanos tu historia futbolística (opcional)</label>
            <textarea
              id="historia-libre"
              value={historiaLibre}
              onChange={e => setHistoriaLibre(e.target.value)}
              maxLength={500}
              rows={5}
              placeholder="Por ejemplo: Jugué en el equipo de mi colegio, después en la liga local. Me gusta jugar al ataque..."
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <p style={{ marginTop: '-12px', marginBottom: '18px', fontSize: '13px', color: '#475569' }}>
              {historiaLibre.length}/500 caracteres. Tu historia la escribes tú;
              solo la podrán consultar delegados y administradores autorizados.
              Evita incluir teléfono, dirección u otros datos personales.
            </p>

            {perfilLibre?.disponible && (
              <p style={{ color: '#166534', fontWeight: 'bold' }}>
                Estás disponible en el directorio privado de jugadores libres.
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="submit"
                disabled={guardandoLibre}
                style={{
                  background: '#0b2948',
                  color: 'white',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: guardandoLibre ? 'wait' : 'pointer'
                }}
              >
                {guardandoLibre
                  ? 'Guardando...'
                  : perfilLibre?.disponible
                    ? 'Actualizar mi perfil'
                    : 'Quiero aparecer como jugador libre'}
              </button>
              {perfilLibre?.disponible && (
                <button
                  type="button"
                  onClick={dejarDeSerLibre}
                  disabled={guardandoLibre}
                  style={{
                    background: '#f1f5f9',
                    color: '#334155',
                    padding: '12px 16px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Dejar de aparecer
                </button>
              )}
            </div>
          </form>
        )}

        {mensajeLibre && (
          <p role="status" style={{ color: '#166534' }}>{mensajeLibre}</p>
        )}
        {errorLibre && (
          <p role="alert" style={{ color: '#b91c1c' }}>{errorLibre}</p>
        )}
      </section>
      )}

      {solicitudAprobada ? (
        <section role="status" style={{
          padding: '20px', border: '1px solid #86efac',
          background: '#f0fdf4', borderRadius: '10px', marginBottom: '25px'
        }}>
          <h2 style={{ marginTop: 0, color: '#166534' }}>
            Ya perteneces a {equipoActual?.nombre || 'tu equipo'}
          </h2>
          <p>Tu solicitud fue aprobada y ya tienes una ficha de jugador.
            No necesitas solicitar ingreso nuevamente.</p>
        </section>
      ) : (
        <>
          <h2>Solicitar ingreso a un equipo</h2>

          <form onSubmit={solicitarIngreso}>
            <label htmlFor="nombre-jugador">Nombre completo</label>
            <input
              id="nombre-jugador"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              maxLength={120}
              style={inputStyle}
            />

            <label htmlFor="equipo-jugador">Seleccionar equipo</label>
            <select
              id="equipo-jugador"
              value={equipoId}
              onChange={e => setEquipoId(e.target.value)}
              required
              style={inputStyle}
            >
              <option value="">Selecciona tu equipo</option>
              {equipos.map(equipo => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre}
                </option>
              ))}
            </select>

            <label htmlFor="numero-jugador">Número de camiseta (opcional)</label>
            <input
              id="numero-jugador"
              type="number"
              min="0"
              max="999"
              value={numero}
              onChange={e => setNumero(e.target.value)}
              style={inputStyle}
            />

            {solicitudEnEquipoSeleccionado && (
              <p role="status" style={{ color: '#166534' }}>
                Ya tienes una solicitud para este equipo (estado: {solicitudEnEquipoSeleccionado.estado}).
              </p>
            )}

            <button
              type="submit"
              disabled={guardando || equipos.length === 0 || !!solicitudEnEquipoSeleccionado}
              style={{
                background: '#0b2948',
                color: 'white',
                padding: '13px 20px',
                border: 'none',
                borderRadius: '6px',
                cursor: guardando ? 'wait' : 'pointer'
              }}
            >
              {guardando ? 'Enviando...' : 'Solicitar ingreso'}
            </button>
          </form>
        </>
      )}

      {mensaje && (
        <p role="status" style={{ color: 'green' }}>
          {mensaje}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      <hr style={{ margin: '30px 0' }} />

      <h2>Mis solicitudes</h2>

      {solicitudes.length === 0 ? (
        <p>Todavía no tienes solicitudes.</p>
      ) : (
        solicitudes.map(s => {
          const equipo = equipos.find(
            e => Number(e.id) === Number(s.equipo_id)
          )

          return (
            <div key={s.id} style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '12px'
            }}>
              <strong>
                {equipo?.nombre || `Equipo #${s.equipo_id}`}
              </strong>
              <p>Estado: <strong>{s.estado}</strong></p>
            </div>
          )
        })
      )}
    </main>
  )
}
