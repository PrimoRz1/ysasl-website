'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function DelegadoPage() {
  const router = useRouter()
  const [equipos, setEquipos] = useState([])
  const [equipoId, setEquipoId] = useState('')
  const [solicitudes, setSolicitudes] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [procesando, setProcesando] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [enlaceManual, setEnlaceManual] = useState('')
  const [invitacionLibreManual, setInvitacionLibreManual] = useState('')
  const [jugadoresLibres, setJugadoresLibres] = useState([])
  const [cargandoLibres, setCargandoLibres] = useState(false)
  const [errorLibres, setErrorLibres] = useState('')
  const [busquedaLibre, setBusquedaLibre] = useState('')
  const [filtroPosicion, setFiltroPosicion] = useState('')
  const [versionLibres, setVersionLibres] = useState(0)

  useEffect(() => {
    let activo = true
    async function verificarDelegado() {
      try {
        const { data, error: errorAuth } = await supabase.auth.getUser()
        if (errorAuth || !data.user) {
          router.replace('/login')
          return
        }
        const { data: permisos, error: errorPermisos } = await supabase
          .from('delegados_equipo')
          .select('equipo_id, tipo, equipos(nombre)')
          .eq('usuario_id', data.user.id)
          .eq('activo', true)
        if (errorPermisos) throw errorPermisos
        if (!activo) return
        const lista = permisos || []
        setEquipos(lista)
        if (lista.length > 0) setEquipoId(String(lista[0].equipo_id))
      } catch (err) {
        if (activo) setError(err.message || 'Error verificando permisos.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    verificarDelegado()
    return () => { activo = false }
  }, [router])

  useEffect(() => {
    if (!equipoId) return
    let activo = true
    async function cargarDatos() {
      setCargandoDatos(true)
      setError('')
      setMensaje('')
      try {
        const [resSolicitudes, resJugadores] = await Promise.all([
          supabase.from('solicitudes_jugadores')
            .select('id, nombre, numero, estado, created_at')
            .eq('equipo_id', Number(equipoId))
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: true }),
          supabase.from('jugadores')
            .select('id, equipo_id, nombre, numero, activo')
            .eq('equipo_id', Number(equipoId))
            .eq('activo', true)
            .order('nombre')
        ])
        if (!activo) return
        setSolicitudes(resSolicitudes.error ? [] : (resSolicitudes.data || []))
        setJugadores(resJugadores.error ? [] : (resJugadores.data || []))
        const errores = [
          resSolicitudes.error && 'Solicitudes: ' + resSolicitudes.error.message,
          resJugadores.error && 'Plantilla: ' + resJugadores.error.message
        ].filter(Boolean)
        if (errores.length) setError(errores.join(' | '))
      } catch (err) {
        if (activo) setError('No se pudieron cargar los datos: ' + err.message)
      } finally {
        if (activo) setCargandoDatos(false)
      }
    }
    cargarDatos()
    return () => { activo = false }
  }, [equipoId])

  // La consulta solo se ejecuta si el usuario tiene al menos un equipo asignado.
  // La seguridad real la impone RLS en Supabase, no este filtro de interfaz.
  useEffect(() => {
    if (equipos.length === 0) {
      setJugadoresLibres([])
      return
    }

    let activo = true
    async function cargarJugadoresLibres() {
      setCargandoLibres(true)
      setErrorLibres('')
      try {
        const { data, error: errorConsulta } = await supabase
          .from('jugadores_libres')
          .select('usuario_id, nombre, posicion')
          .eq('disponible', true)
          .order('nombre', { ascending: true })

        if (!activo) return
        if (errorConsulta) throw errorConsulta
        setJugadoresLibres(data || [])
      } catch (err) {
        if (activo) {
          setJugadoresLibres([])
          setErrorLibres('No se pudo consultar el directorio privado: ' +
            (err.message || 'Error desconocido.'))
        }
      } finally {
        if (activo) setCargandoLibres(false)
      }
    }

    cargarJugadoresLibres()
    return () => { activo = false }
  }, [equipos.length, versionLibres])

  const equipoActual = equipos.find(e => String(e.equipo_id) === equipoId)
  const nombreEquipo = equipoActual?.equipos?.nombre || `Equipo #${equipoId}`
  // Los nombres iguales no implican duplicados: cada jugador tiene su ID.
  const jugadoresLibresFiltrados = jugadoresLibres.filter(jugador => {
    const coincideNombre = String(jugador.nombre || '')
      .toLocaleLowerCase('es')
      .includes(busquedaLibre.trim().toLocaleLowerCase('es'))
    const coincidePosicion = !filtroPosicion || jugador.posicion === filtroPosicion
    return coincideNombre && coincidePosicion
  })

  async function copiarInvitacion(nombreJugador = '') {
    if (!equipoId) return
    const enlace = `${window.location.origin}/registro?equipo=${encodeURIComponent(equipoId)}`
    const texto = nombreJugador
      ? `Hola ${nombreJugador}, te invitamos a unirte a ${nombreEquipo} en YSASL.\n` +
        `Regístrate aquí: ${enlace}\n` +
        'Tu solicitud deberá ser aprobada por el delegado antes de entrar al equipo.'
      : enlace

    setError('')
    setMensaje('')
    setEnlaceManual('')
    setInvitacionLibreManual('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Portapapeles no disponible')
      await navigator.clipboard.writeText(texto)
      setMensaje(nombreJugador
        ? `Mensaje para ${nombreJugador} copiado. Compártelo personalmente por WhatsApp, SMS o correo.`
        : 'Enlace copiado. Compártelo por WhatsApp, mensaje o correo.')
    } catch {
      if (nombreJugador) setInvitacionLibreManual(texto)
      else setEnlaceManual(texto)
      setMensaje('No se pudo copiar automáticamente. Selecciona y copia el texto que aparece en la página.')
    }
  }

  async function resolverSolicitud(id, aprobar) {
    if (procesando !== null) return
    setProcesando(`solicitud-${id}`)
    setMensaje('')
    setError('')
    try {
      const { error: errorRPC } = await supabase.rpc('resolver_solicitud_jugador', {
        p_solicitud_id: id,
        p_aprobar: aprobar
      })
      if (errorRPC) throw errorRPC
      setSolicitudes(actuales => actuales.filter(s => s.id !== id))
      setMensaje(aprobar
        ? 'Jugador aprobado e incorporado al equipo.'
        : 'Solicitud rechazada correctamente.')
      if (aprobar) {
        const { data, error: errorConsulta } = await supabase.from('jugadores')
          .select('id, equipo_id, nombre, numero, activo')
          .eq('equipo_id', Number(equipoId))
          .eq('activo', true)
          .order('nombre')
        if (errorConsulta) {
          setError('Se aprobó la solicitud, pero no se pudo actualizar la plantilla. Recarga la página.')
        } else {
          setJugadores(data || [])
        }
      }
    } catch (err) {
      setError('No se pudo procesar la solicitud: ' + err.message)
    } finally {
      setProcesando(null)
    }
  }

  async function darDeBaja(jugador) {
    if (procesando !== null || !equipoId) return
    const pertenece = jugadores.some(j =>
      Number(j.id) === Number(jugador.id) &&
      Number(j.equipo_id) === Number(equipoId)
    )
    if (!pertenece) {
      setError('Este jugador no pertenece a la plantilla activa seleccionada.')
      return
    }
    const confirmado = window.confirm(
      `¿Dar de baja a ${jugador.nombre} (ID #${jugador.id}) de ${nombreEquipo}?\n\n` +
      'Se retirará de la plantilla activa. Su cuenta, goles, tarjetas y estadísticas ' +
      'históricas se conservarán.'
    )
    if (!confirmado) return

    setProcesando(`baja-${jugador.id}`)
    setMensaje('')
    setError('')
    try {
      const { error: errorRPC } = await supabase.rpc('dar_de_baja_jugador', {
        p_jugador_id: jugador.id
      })
      if (errorRPC) throw errorRPC
      setJugadores(actuales => actuales.filter(j => Number(j.id) !== Number(jugador.id)))
      setMensaje(`${jugador.nombre} (ID #${jugador.id}) fue dado de baja de ${nombreEquipo}. Su historial se conserva.`)
    } catch (err) {
      setError('No se pudo dar de baja al jugador: ' + err.message)
    } finally {
      setProcesando(null)
    }
  }

  async function cerrarSesion() {
    const { error: errorSalida } = await supabase.auth.signOut()
    if (errorSalida) {
      setError(errorSalida.message)
      return
    }
    router.replace('/login')
    router.refresh()
  }

  const estiloBoton = {
    padding: '12px 18px', color: 'white', border: 'none',
    borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
  }

  if (cargando) return <main style={{ padding: 30 }}>Verificando acceso...</main>

  return (
    <main style={{ maxWidth: '850px', margin: '40px auto', padding: '20px' }}>
      <h1>Panel de Delegados</h1>
      <p>Yuba Sutter Adult Soccer League</p>
      <button type="button" onClick={cerrarSesion}>Cerrar sesión</button>
      <hr style={{ margin: '30px 0' }} />

      <h2>Mis equipos</h2>
      {equipos.length === 0 ? (
        <p>No tienes equipos asignados actualmente. Contacta al administrador de YSASL.</p>
      ) : (
        <>
          <label htmlFor="equipo-delegado">Seleccionar equipo</label>
          <select
            id="equipo-delegado"
            value={equipoId}
            onChange={e => {
              setEquipoId(e.target.value)
              setEnlaceManual('')
              setInvitacionLibreManual('')
              setSolicitudes([])
              setJugadores([])
            }}
            disabled={procesando !== null}
            style={{
              display: 'block', width: '100%', padding: '12px',
              marginTop: '10px', marginBottom: '20px'
            }}
          >
            {equipos.map(equipo => (
              <option key={equipo.equipo_id} value={equipo.equipo_id}>
                {equipo.equipos?.nombre || `Equipo #${equipo.equipo_id}`}
              </option>
            ))}
          </select>

          <div style={{
            border: '1px solid #d5e2ee', background: '#f5f9fd',
            borderRadius: '10px', padding: '18px', marginBottom: '30px'
          }}>
            <h3 style={{ marginTop: 0 }}>Invitar jugadores</h3>
            <p>
              Comparte el enlace de tu equipo. Cada jugador deberá registrarse
              y solicitar ingreso; el delegado aprobará su solicitud antes de incorporarlo.
            </p>
            <button
              type="button"
              onClick={() => copiarInvitacion()}
              disabled={!equipoId}
              style={{ ...estiloBoton, background: '#0b2948' }}
            >
              Copiar invitación del equipo
            </button>
            {enlaceManual && (
              <div style={{ marginTop: '12px' }}>
                <label htmlFor="enlace-invitacion">Enlace para copiar</label>
                <input
                  id="enlace-invitacion"
                  readOnly
                  value={enlaceManual}
                  onFocus={e => e.target.select()}
                  style={{
                    display: 'block', width: '100%', padding: '10px',
                    marginTop: '6px', boxSizing: 'border-box'
                  }}
                />
              </div>
            )}
          </div>

          <section aria-labelledby="titulo-jugadores-libres" style={{
            border: '1px solid #d5e2ee', borderRadius: '10px',
            padding: '18px', marginBottom: '30px'
          }}>
            <h2 id="titulo-jugadores-libres" style={{ marginTop: 0 }}>
              Jugadores libres
            </h2>
            <p>
              Directorio privado de jugadores que decidieron aparecer como disponibles.
              Solo muestra nombre y posición; no incluye correos ni contraseñas.
            </p>
            <p style={{ color: '#555', fontSize: '14px' }}>
              Para invitar a alguien, copia el mensaje y compártelo personalmente.
              La invitación no se envía automáticamente desde esta página.
              El jugador deberá solicitar ingreso y tú tendrás que aprobarlo.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <div style={{ flex: '1 1 220px' }}>
                <label htmlFor="buscar-jugador-libre">Buscar por nombre</label>
                <input
                  id="buscar-jugador-libre"
                  type="search"
                  value={busquedaLibre}
                  onChange={e => setBusquedaLibre(e.target.value)}
                  placeholder="Nombre del jugador"
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box',
                    padding: '10px', marginTop: '6px' }}
                />
              </div>
              <div style={{ flex: '1 1 180px' }}>
                <label htmlFor="filtrar-posicion-libre">Filtrar por posición</label>
                <select
                  id="filtrar-posicion-libre"
                  value={filtroPosicion}
                  onChange={e => setFiltroPosicion(e.target.value)}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box',
                    padding: '10px', marginTop: '6px' }}
                >
                  <option value="">Todas las posiciones</option>
                  <option value="Portero">Portero</option>
                  <option value="Defensa">Defensa</option>
                  <option value="Mediocampista">Mediocampista</option>
                  <option value="Delantero">Delantero</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setVersionLibres(v => v + 1)}
              disabled={cargandoLibres}
              style={{ padding: '9px 14px', marginBottom: '14px' }}
            >
              {cargandoLibres ? 'Actualizando...' : 'Actualizar directorio'}
            </button>

            {errorLibres && (
              <p role="alert" style={{ color: '#b91c1c' }}>{errorLibres}</p>
            )}

            {cargandoLibres ? (
              <p>Cargando jugadores libres...</p>
            ) : errorLibres ? null : jugadoresLibresFiltrados.length === 0 ? (
              <p>{jugadoresLibres.length === 0
                ? 'Todavía no hay jugadores libres disponibles.'
                : 'No hay jugadores que coincidan con los filtros.'}</p>
            ) : (
              <>
                <p><strong>{jugadoresLibresFiltrados.length} jugador(es) encontrado(s)</strong></p>
                {jugadoresLibresFiltrados.map(jugadorLibre => (
                  <div key={jugadorLibre.usuario_id} style={{
                    border: '1px solid #ddd', borderRadius: '8px',
                    padding: '14px', marginBottom: '10px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap'
                  }}>
                    <div>
                      <strong>{jugadorLibre.nombre}</strong>
                      <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                        Posición: {jugadorLibre.posicion || 'Sin preferencia'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copiarInvitacion(jugadorLibre.nombre)}
                      disabled={!equipoId}
                      style={{ ...estiloBoton, background: '#0b2948' }}
                    >
                      Copiar mensaje de invitación
                    </button>
                  </div>
                ))}
              </>
            )}

            {invitacionLibreManual && (
              <div style={{ marginTop: '16px' }}>
                <label htmlFor="invitacion-libre-manual">Mensaje para copiar</label>
                <textarea
                  id="invitacion-libre-manual"
                  readOnly
                  rows={4}
                  value={invitacionLibreManual}
                  onFocus={e => e.target.select()}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box',
                    padding: '10px', marginTop: '6px' }}
                />
              </div>
            )}
          </section>

          {mensaje && <p role="status" style={{ color: 'green' }}>{mensaje}</p>}
          {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}

          <h2>Solicitudes pendientes</h2>
          {cargandoDatos ? (
            <p>Cargando solicitudes...</p>
          ) : solicitudes.length === 0 ? (
            <p>No hay solicitudes pendientes.</p>
          ) : (
            solicitudes.map(solicitud => (
              <div key={solicitud.id} style={{
                border: '1px solid #ddd', borderRadius: '10px',
                padding: '20px', marginBottom: '15px'
              }}>
                <h3>{solicitud.nombre}</h3>
                <p>Número de camiseta: {solicitud.numero ?? 'Sin número'}</p>
                <p>Estado: {solicitud.estado}</p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={procesando !== null}
                    onClick={() => resolverSolicitud(solicitud.id, true)}
                    style={{ ...estiloBoton, background: '#16803c' }}
                  >
                    {procesando === `solicitud-${solicitud.id}` ? 'Procesando...' : 'Aprobar'}
                  </button>
                  <button
                    type="button"
                    disabled={procesando !== null}
                    onClick={() => resolverSolicitud(solicitud.id, false)}
                    style={{ ...estiloBoton, background: '#b91c1c' }}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))
          )}

          <hr style={{ margin: '30px 0' }} />
          <h2>Administrar jugadores</h2>
          <p>
            Plantilla activa de <strong>{nombreEquipo}</strong>.
            Revisa el nombre y el ID antes de dar de baja a alguien.
            La baja conserva su historial.
          </p>
          {cargandoDatos ? (
            <p>Cargando jugadores...</p>
          ) : jugadores.length === 0 ? (
            <p>No hay jugadores activos en este equipo.</p>
          ) : (
            <>
              <p><strong>Jugadores activos: {jugadores.length}</strong></p>
              {jugadores.map(jugador => (
                <div key={jugador.id} style={{
                    border: '1px solid #ddd', borderRadius: '8px',
                    padding: '14px', marginBottom: '10px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: '14px',
                    flexWrap: 'wrap'
                  }}>
                    <div>
                      <strong>{jugador.nombre}</strong>
                      <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                        ID #{jugador.id} · Camiseta: {jugador.numero ?? 'Sin número'}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={procesando !== null}
                      onClick={() => darDeBaja(jugador)}
                      style={{ ...estiloBoton, background: '#b91c1c' }}
                    >
                      {procesando === `baja-${jugador.id}` ? 'Procesando...' : 'Dar de baja'}
                    </button>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {equipos.length === 0 && mensaje && (
        <p role="status" style={{ color: 'green' }}>{mensaje}</p>
      )}
      {equipos.length === 0 && error && (
        <p role="alert" style={{ color: 'red' }}>{error}</p>
      )}
    </main>
  )
}
