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

        const [respuestaEquipos, respuestaSolicitudes, respuestaLibre, respuestaInvitaciones] =
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
          .select('id, equipo_id, estado, created_at')
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
