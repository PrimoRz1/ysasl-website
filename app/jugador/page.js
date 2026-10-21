'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function obtenerEquipoInvitado(valor) {
  if (typeof valor !== 'number' && typeof valor !== 'string') return null
  const id = Number(valor)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export default function JugadorPage() {
  const router = useRouter()

  const [usuario, setUsuario] = useState(null)
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

  useEffect(() => {
    let activo = true

    async function cargar() {
      try {
        const { data: auth, error: errorAuth } =
          await supabase.auth.getUser()

        if (!activo) return

        if (errorAuth || !auth.user) {
          router.replace('/login')
          return
        }

        const user = auth.user

        const [respuestaEquipos, respuestaSolicitudes] =
          await Promise.all([
            supabase
              .from('equipos')
              .select('id, nombre')
              .eq('activo', true)
              .order('nombre'),
            supabase
              .from('solicitudes_jugadores')
              .select('id, equipo_id, estado, created_at')
              .eq('usuario_id', user.id)
              .order('created_at', { ascending: false })
          ])

        if (!activo) return

        setUsuario(user)
        setNombre(user.user_metadata?.nombre || '')

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

        // El registro por invitación guardó este dato en Supabase Auth.
        // Si no hay invitación, el jugador conserva el registro normal.
        const invitacionId = obtenerEquipoInvitado(
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
            .select('id, equipo_id, estado, created_at')
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
        if (activo) setCargando(false)
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
        .select('id, equipo_id, estado, created_at')
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

      <p>Bienvenido, {nombre || usuario?.email}</p>

      <button onClick={cerrarSesion}>Cerrar sesión</button>

      <hr style={{ margin: '30px 0' }} />

      {equipoInvitadoNombre && (
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

        <button
          type="submit"
          disabled={guardando || equipos.length === 0}
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
