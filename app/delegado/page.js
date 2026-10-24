'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function normalizarNombre(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

export default function DelegadoPage() {
  const router = useRouter()
  const [equipos, setEquipos] = useState([])
  const [equipoId, setEquipoId] = useState('')
  const [solicitudes, setSolicitudes] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [jugadoresBaja, setJugadoresBaja] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cargandoDatos, setCargandoDatos] = useState(false)
  const [procesando, setProcesando] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [enlaceManual, setEnlaceManual] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoNumero, setNuevoNumero] = useState('')
  // Consulta de solo lectura: jugadores dados de baja de otros equipos.
  const [busquedaOtros, setBusquedaOtros] = useState('')
  const [resultadosOtros, setResultadosOtros] = useState([])
  const [busquedaOtrosRealizada, setBusquedaOtrosRealizada] = useState(false)
  const [buscandoOtros, setBuscandoOtros] = useState(false)
  const [errorBusquedaOtros, setErrorBusquedaOtros] = useState('')

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
        const [resSolicitudes, resJugadores, resBajas] = await Promise.all([
          supabase.from('solicitudes_jugadores')
            .select('id, nombre, numero, estado, created_at')
            .eq('equipo_id', Number(equipoId))
            .eq('estado', 'pendiente')
            .order('created_at', { ascending: true }),
          supabase.from('jugadores')
            .select('id, equipo_id, nombre, numero, activo')
            .eq('equipo_id', Number(equipoId))
            .eq('activo', true)
            .order('nombre'),
          supabase.rpc('listar_jugadores_baja_delegado', {
            p_equipo_id: Number(equipoId)
          })
        ])
        if (!activo) return
        setSolicitudes(resSolicitudes.error ? [] : (resSolicitudes.data || []))
        setJugadores(resJugadores.error ? [] : (resJugadores.data || []))
        setJugadoresBaja(resBajas.error ? [] : (Array.isArray(resBajas.data) ? resBajas.data : []))
        const errores = [
          resSolicitudes.error && 'Solicitudes: ' + resSolicitudes.error.message,
          resJugadores.error && 'Plantilla: ' + resJugadores.error.message,
          resBajas.error && 'Jugadores dados de baja: ' + resBajas.error.message
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

  const equipoActual = equipos.find(e => String(e.equipo_id) === equipoId)
  const nombreEquipo = equipoActual?.equipos?.nombre || `Equipo #${equipoId}`
  const conteoNombres = jugadores.reduce((resultado, jugador) => {
    const nombre = String(jugador.nombre || '').trim().toLocaleLowerCase('es')
    if (nombre) resultado[nombre] = (resultado[nombre] || 0) + 1
    return resultado
  }, {})

  async function copiarInvitacion() {
    if (!equipoId) return
    const enlace = `${window.location.origin}/registro?equipo=${encodeURIComponent(equipoId)}`
    setError('')
    setMensaje('')
    setEnlaceManual('')
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Portapapeles no disponible')
      await navigator.clipboard.writeText(enlace)
      setMensaje('Enlace copiado. Compártelo por WhatsApp, mensaje o correo.')
    } catch {
      setEnlaceManual(enlace)
      setMensaje('No se pudo copiar automáticamente. Selecciona y copia el enlace de abajo.')
    }
  }

  async function agregarJugador(evento) {
    evento.preventDefault()
    if (procesando !== null || cargandoDatos || !equipoId) return

    setMensaje('')
    setError('')

    const nombreLimpio = nuevoNombre.trim().replace(/\s+/g, ' ')
    const numeroTexto = String(nuevoNumero).trim()

    if (nombreLimpio.length < 2 || nombreLimpio.length > 120) {
      setError('Escribe el nombre completo del jugador (2 a 120 caracteres).')
      return
    }
    if (numeroTexto !== '' && (!/^\d+$/.test(numeroTexto) || Number(numeroTexto) > 999)) {
      setError('El número de camiseta debe ser un entero entre 0 y 999.')
      return
    }

    const duplicado = jugadores.find(j =>
      Number(j.equipo_id) === Number(equipoId) &&
      normalizarNombre(j.nombre) === normalizarNombre(nombreLimpio)
    )
    if (duplicado) {
      setError(`Ya existe ${duplicado.nombre} (ID #${duplicado.id}) en la plantilla. No se creó otro registro. Si se trata de otra persona, consulta al Administrador General.`)
      return
    }

    const dadoDeBaja = jugadoresBaja.find(j =>
      Number(j.equipo_id) === Number(equipoId) &&
      normalizarNombre(j.nombre) === normalizarNombre(nombreLimpio)
    )
    if (dadoDeBaja) {
      setError(`${dadoDeBaja.nombre} ya tiene una ficha dada de baja (ID #${dadoDeBaja.id}). Busca esa ficha en "Jugadores dados de baja"; no crees otra.`)
      return
    }

    const idEquipoAlGuardar = Number(equipoId)
    setProcesando('agregar-jugador')
    try {
      // El RPC comprueba el permiso del delegado EN SUPABASE; no confía en el navegador.
      const { data: idNuevo, error: errorRPC } = await supabase.rpc('agregar_jugador_delegado', {
        p_equipo_id: idEquipoAlGuardar,
        p_nombre: nombreLimpio,
        p_numero: numeroTexto === '' ? null : Number(numeroTexto)
      })
      if (errorRPC) throw errorRPC
      if (idNuevo === null || idNuevo === undefined) throw new Error('No se confirmó el registro del jugador.')

      setNuevoNombre('')
      setNuevoNumero('')
      setMensaje(`${nombreLimpio} agregado a ${nombreEquipo} (ID #${idNuevo}). Puede registrarse después y vincular su cuenta; por ahora su ficha ya aparece en la plantilla.`)

      const { data: listaActualizada, error: errorConsulta } = await supabase.from('jugadores')
        .select('id, equipo_id, nombre, numero, activo')
        .eq('equipo_id', idEquipoAlGuardar)
        .eq('activo', true)
        .order('nombre')
      if (errorConsulta) {
        setError('El jugador fue agregado, pero no se pudo actualizar la lista. Recarga la página para verlo.')
      } else {
        setJugadores(listaActualizada || [])
      }
    } catch (err) {
      setError('No se pudo agregar el jugador: ' + (err?.message || 'Error desconocido.'))
    } finally {
      setProcesando(null)
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
      const { data: bajasActualizadas, error: errorBajas } = await supabase.rpc(
        'listar_jugadores_baja_delegado', { p_equipo_id: Number(equipoId) }
      )
      if (!errorBajas && Array.isArray(bajasActualizadas)) setJugadoresBaja(bajasActualizadas)
      setMensaje(`${jugador.nombre} (ID #${jugador.id}) fue dado de baja de ${nombreEquipo}. Su historial se conserva.`)
    } catch (err) {
      setError('No se pudo dar de baja al jugador: ' + err.message)
    } finally {
      setProcesando(null)
    }
  }

  async function reactivarJugador(jugador) {
    if (procesando !== null || cargandoDatos || !equipoId) return

    const pertenece = jugadoresBaja.some(j =>
      Number(j.id) === Number(jugador.id) &&
      Number(j.equipo_id) === Number(equipoId)
    )
    if (!pertenece) {
      setError('Esta ficha no corresponde a un jugador dado de baja de tu equipo.')
      return
    }

    const yaActivo = jugadores.find(j => normalizarNombre(j.nombre) === normalizarNombre(jugador.nombre))
    if (yaActivo) {
      setError(`Ya existe una ficha activa de ${jugador.nombre} (ID #${yaActivo.id}). Consulta al Administrador General.`)
      return
    }

    const otrasFichas = jugadoresBaja.filter(j =>
      Number(j.id) !== Number(jugador.id) &&
      normalizarNombre(j.nombre) === normalizarNombre(jugador.nombre)
    )
    // Nunca reactivar por error una ficha manual si otra ficha del mismo
    // nombre ya está vinculada a la cuenta del jugador.
    if (!jugador.cuenta_vinculada && otrasFichas.some(j => j.cuenta_vinculada)) {
      setError(`Hay otra ficha de ${jugador.nombre} vinculada a su cuenta. Verifica esa ficha antes de reactivar la ID #${jugador.id}.`)
      return
    }
    const advertencia = otrasFichas.length > 0
      ? `\n\nATENCIÓN: Hay otras fichas dadas de baja con este nombre (ID ${otrasFichas.map(j => '#' + j.id).join(', ')}). Verifica cuál conserva el historial oficial ANTES de reactivar.`
      : ''

    const confirmado = window.confirm(
      `¿Reactivar a ${jugador.nombre} (ID #${jugador.id}) en ${nombreEquipo}?` +
      `\n\nSe conservará la misma ficha y su historial de goles y tarjetas.` +
      advertencia +
      `\n\n¿Confirmas que este es el ID correcto?`
    )
    if (!confirmado) return

    setProcesando(`reactivar-${jugador.id}`)
    setMensaje('')
    setError('')
    try {
      const { data: idReactivado, error: errorRPC } = await supabase.rpc('reactivar_jugador_delegado', {
        p_jugador_id: Number(jugador.id)
      })
      if (errorRPC) throw errorRPC
      if (idReactivado === null || idReactivado === undefined) throw new Error('No se confirmó la reactivación.')

      const [resJugadores, resBajas] = await Promise.all([
        supabase.from('jugadores')
          .select('id, equipo_id, nombre, numero, activo')
          .eq('equipo_id', Number(equipoId))
          .eq('activo', true)
          .order('nombre'),
        supabase.rpc('listar_jugadores_baja_delegado', { p_equipo_id: Number(equipoId) })
      ])
      if (resJugadores.error || resBajas.error) {
        setError('Se reactivó la ficha, pero no se pudo actualizar la lista. Recarga la página.')
      } else {
        setJugadores(resJugadores.data || [])
        setJugadoresBaja(Array.isArray(resBajas.data) ? resBajas.data : [])
      }
      setMensaje(`${jugador.nombre} (ID #${jugador.id}) fue reactivado sin crear otra ficha. Su historial se conserva.`)
    } catch (err) {
      setError('No se pudo reactivar al jugador: ' + (err?.message || 'Error desconocido.'))
    } finally {
      setProcesando(null)
    }
  }

  async function buscarJugadoresOtrosEquipos(evento) {
    evento.preventDefault()
    if (!equipoId || buscandoOtros || procesando !== null) return

    const nombre = busquedaOtros.trim().replace(/\s+/g, ' ')
    setErrorBusquedaOtros('')
    setResultadosOtros([])
    setBusquedaOtrosRealizada(false)
    if (nombre.length < 3 || nombre.length > 80) {
      setErrorBusquedaOtros('Escribe entre 3 y 80 caracteres para buscar.')
      return
    }

    setBuscandoOtros(true)
    try {
      const { data, error: errorRPC } = await supabase.rpc('buscar_bajas_otros_equipos_delegado', {
        p_equipo_destino: Number(equipoId),
        p_busqueda: nombre
      })
      if (errorRPC) throw errorRPC
      setResultadosOtros(Array.isArray(data) ? data : [])
      setBusquedaOtrosRealizada(true)
    } catch (err) {
      setErrorBusquedaOtros('No se pudo realizar la búsqueda: ' + (err?.message || 'Error desconocido.'))
    } finally {
      setBuscandoOtros(false)
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
              setSolicitudes([])
              setJugadores([])
              setJugadoresBaja([])
              setNuevoNombre('')
              setNuevoNumero('')
              setBusquedaOtros('')
              setResultadosOtros([])
              setBusquedaOtrosRealizada(false)
              setErrorBusquedaOtros('')
              setMensaje('')
              setError('')
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
              onClick={copiarInvitacion}
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

          <div style={{
            border: '1px solid #d5e2ee', background: '#fff',
            borderRadius: '10px', padding: '18px', marginBottom: '30px'
          }}>
            <h3 style={{ marginTop: 0 }}>Agregar jugador directamente</h3>
            <p>
              Registra un jugador en <strong>{nombreEquipo}</strong> sin esperar
              a que solicite ingreso. Solamente puedes agregar jugadores a tus equipos.
              Si el jugador ya aparece en la plantilla, no crees otra ficha:
              podrá vincular su cuenta más adelante. Si estuvo en otro equipo,
              utiliza primero la búsqueda de bajas que aparece más abajo.
            </p>
            <form onSubmit={agregarJugador}>
              <label htmlFor="nombre-jugador-nuevo">Nombre completo</label>
              <input
                id="nombre-jugador-nuevo"
                type="text"
                autoComplete="off"
                value={nuevoNombre}
                onChange={e => setNuevoNombre(e.target.value)}
                maxLength={120}
                disabled={procesando !== null || cargandoDatos}
                required
                style={{ display: 'block', width: '100%', padding: '10px',
                  boxSizing: 'border-box', marginTop: '6px', marginBottom: '14px' }}
              />
              <label htmlFor="numero-jugador-nuevo">Número de camiseta (opcional)</label>
              <input
                id="numero-jugador-nuevo"
                type="number"
                min="0"
                max="999"
                step="1"
                value={nuevoNumero}
                onChange={e => setNuevoNumero(e.target.value)}
                disabled={procesando !== null || cargandoDatos}
                style={{ display: 'block', width: '100%', padding: '10px',
                  boxSizing: 'border-box', marginTop: '6px', marginBottom: '14px' }}
              />
              <button
                type="submit"
                disabled={procesando !== null || cargandoDatos || !equipoId}
                style={{ ...estiloBoton, background: '#16803c' }}
              >
                {procesando === 'agregar-jugador' ? 'Guardando...' : 'Agregar jugador'}
              </button>
            </form>
          </div>

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
              {jugadores.map(jugador => {
                const nombreNormalizado = String(jugador.nombre || '')
                  .trim().toLocaleLowerCase('es')
                const posibleDuplicado =
                  nombreNormalizado && conteoNombres[nombreNormalizado] > 1
                return (
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
                      {posibleDuplicado && (
                        <div style={{ color: '#9a6700', fontSize: '13px', marginTop: '4px' }}>
                          Posible duplicado: verifica el ID antes de dar de baja.
                        </div>
                      )}
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
                )
              })}
            </>
          )}

          <hr style={{ margin: '30px 0' }} />
          <h2>Buscar jugadores dados de baja de otros equipos</h2>
          <p>
            Busca por nombre a un jugador que estuvo en otro equipo. Esta sección
            solo consulta fichas inactivas; <strong>no transfiere ni reactiva</strong>
            jugadores de otros equipos. Si tiene cuenta registrada, deberá
            solicitar ingreso a {nombreEquipo} usando la invitación del equipo.
            Si no tiene cuenta vinculada, el Administrador General deberá
            verificar su identidad antes de incorporarlo.
          </p>
          <form onSubmit={buscarJugadoresOtrosEquipos} style={{ marginBottom: '16px' }}>
            <label htmlFor="busqueda-jugadores-otros">Nombre del jugador (3 a 80 caracteres)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
              <input
                id="busqueda-jugadores-otros"
                type="search"
                autoComplete="off"
                placeholder="Ejemplo: Ramiro Cruz"
                value={busquedaOtros}
                onChange={e => {
                  setBusquedaOtros(e.target.value)
                  setResultadosOtros([])
                  setBusquedaOtrosRealizada(false)
                  setErrorBusquedaOtros('')
                }}
                maxLength={80}
                disabled={buscandoOtros || procesando !== null || cargandoDatos}
                style={{ flex: '1 1 220px', minWidth: '180px', padding: '10px' }}
              />
              <button
                type="submit"
                disabled={!equipoId || buscandoOtros || procesando !== null || cargandoDatos}
                style={{ ...estiloBoton, background: '#0b2948' }}
              >
                {buscandoOtros ? 'Buscando...' : 'Buscar'}
              </button>
            </div>
          </form>
          {errorBusquedaOtros && <p role="alert" style={{ color: '#b91c1c' }}>{errorBusquedaOtros}</p>}
          {busquedaOtrosRealizada && resultadosOtros.length === 0 && (
            <p role="status">No se encontraron jugadores dados de baja en otros equipos con ese nombre.</p>
          )}
          {resultadosOtros.length > 0 && (
            <div aria-live="polite">
              <p><strong>Coincidencias: {resultadosOtros.length}</strong></p>
              {resultadosOtros.map(jugador => (
                <div key={jugador.ficha_id} style={{
                  border: '1px solid #ddd', borderRadius: '8px',
                  padding: '14px', marginBottom: '10px'
                }}>
                  <strong>{jugador.nombre}</strong>
                  <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                    Ficha #{jugador.ficha_id} · Equipo anterior: {jugador.equipo_origen}
                  </div>
                  <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                    {jugador.tiene_cuenta ? 'Con cuenta vinculada' : 'Sin cuenta vinculada'}
                    {' · '}{jugador.tiene_foto ? 'Con fotografía' : 'Sin fotografía'}
                    {' · '}Eventos: {jugador.eventos ?? 0}
                    {' · '}Suspensiones: {jugador.suspensiones ?? 0}
                  </div>
                  <div style={{ fontSize: '13px', marginTop: '8px', color: '#7c4a00' }}>
                    {jugador.estado_incorporacion === 'ya_activo_en_otro_equipo'
                      ? 'No disponible: esta identidad ya tiene una ficha activa. Primero debe darse de baja.'
                      : jugador.estado_incorporacion === 'requiere_solicitud_del_jugador'
                        ? 'Siguiente paso: el jugador debe solicitar ingreso mediante la invitación del equipo. No crees otra ficha manual.'
                        : 'Requiere revisión del Administrador General para confirmar la identidad antes de incorporarlo.'}
                  </div>
                </div>
              ))}
            </div>
          )}

          <hr style={{ margin: '30px 0' }} />
          <h2>Jugadores dados de baja</h2>
          <p>
            Puedes reactivar una ficha existente de <strong>{nombreEquipo}</strong> sin
            crear otra. Por ahora, esta función solo reactiva jugadores del mismo equipo;
            las transferencias desde otros equipos se agregarán después.
            Revisa el ID y su historial antes de hacerlo. Si hay dos
            fichas con el mismo nombre, pide al Administrador General verificar
            cuál es la correcta.
          </p>
          {cargandoDatos ? (
            <p>Cargando jugadores dados de baja...</p>
          ) : jugadoresBaja.length === 0 ? (
            <p>No hay jugadores dados de baja en este equipo.</p>
          ) : (
            <>
              <p><strong>Jugadores dados de baja: {jugadoresBaja.length}</strong></p>
              {jugadoresBaja.map(jugador => {
                const posibles = jugadoresBaja.filter(j =>
                  normalizarNombre(j.nombre) === normalizarNombre(jugador.nombre)
                )
                const duplicado = posibles.length > 1
                const fichaManualConDuplicadoVinculado = !jugador.cuenta_vinculada &&
                  posibles.some(j => Number(j.id) !== Number(jugador.id) && j.cuenta_vinculada)
                return (
                  <div key={jugador.id} style={{
                    border: '1px solid #ddd', borderRadius: '8px',
                    padding: '14px', marginBottom: '10px',
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap'
                  }}>
                    <div>
                      <strong>{jugador.nombre}</strong>
                      <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
                        ID #{jugador.id} · Camiseta: {jugador.numero ?? 'Sin número'}
                      </div>
                      <div style={{ fontSize: '13px', color: jugador.cuenta_vinculada ? '#166534' : '#555', marginTop: '4px' }}>
                        {jugador.cuenta_vinculada ? 'Cuenta de jugador vinculada' : 'Sin cuenta vinculada'}
                        {' · '}{jugador.tiene_foto ? 'Con fotografía' : 'Sin fotografía'}
                        {' · '}Eventos: {jugador.eventos_partido ?? 0}
                        {' · '}Suspensiones: {jugador.suspensiones ?? 0}
                      </div>
                      {duplicado && (
                        <div style={{ color: '#9a6700', fontSize: '13px', marginTop: '4px' }}>
                          Posible duplicado (ID {posibles.map(j => '#' + j.id).join(', ')}):
                          verifica cuál conserva el historial oficial antes de reactivar.
                        </div>
                      )}
                      {fichaManualConDuplicadoVinculado && (
                        <div style={{ color: '#b91c1c', fontSize: '13px', marginTop: '4px' }}>
                          Esta ficha manual está bloqueada porque existe otra ficha del mismo
                          nombre vinculada a una cuenta. Consulta al Administrador General.
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={procesando !== null || cargandoDatos || fichaManualConDuplicadoVinculado}
                      onClick={() => reactivarJugador(jugador)}
                      style={{ ...estiloBoton, background: fichaManualConDuplicadoVinculado ? '#777' : '#16803c' }}
                    >
                      {fichaManualConDuplicadoVinculado ? 'Revisión requerida' :
                        procesando === `reactivar-${jugador.id}` ? 'Reactivando...' : 'Reactivar'}
                    </button>
                  </div>
                )
              })}
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
