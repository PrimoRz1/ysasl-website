'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

// Solo sirve para detectar POSIBLES duplicados; no elimina ni une registros.
function normalizarNombre(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function numeroValido(valor) {
  if (valor === '' || valor === null || valor === undefined) return true
  return /^\d+$/.test(String(valor)) && Number(valor) <= 999
}

export default function AdminJugadoresPage() {
  const router = useRouter()

  const [verificando, setVerificando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [equipos, setEquipos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [equipoId, setEquipoId] = useState('')
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)

  const [editandoId, setEditandoId] = useState(null)
  const [editNombre, setEditNombre] = useState('')
  const [editEquipoId, setEditEquipoId] = useState('')
  const [editNumero, setEditNumero] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEquipo, setFiltroEquipo] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('activos')

  useEffect(() => {
    let activo = true

    async function verificarAcceso() {
      try {
        const { data: auth, error: errorAuth } = await supabase.auth.getUser()

        if (errorAuth || !auth.user) {
          router.replace('/login')
          return
        }

        const { data: perfil, error: errorPerfil } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', auth.user.id)
          .single()

        if (errorPerfil) throw errorPerfil

        if (!perfil || perfil.rol !== 'admin') {
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        const [respuestaEquipos, respuestaJugadores] = await Promise.all([
          supabase.from('equipos').select('id, nombre').eq('activo', true).order('nombre'),
          supabase.from('jugadores').select('id, equipo_id, nombre, numero, activo').order('nombre')
        ])

        if (respuestaEquipos.error) throw respuestaEquipos.error
        if (respuestaJugadores.error) throw respuestaJugadores.error
        if (!activo) return

        setEquipos(respuestaEquipos.data || [])
        setJugadores(respuestaJugadores.data || [])
        setAutorizado(true)
      } catch (err) {
        if (activo) setError('No se pudo cargar la administración: ' + err.message)
      } finally {
        if (activo) setVerificando(false)
      }
    }

    verificarAcceso()
    return () => { activo = false }
  }, [router])

  async function cargarJugadores() {
    const { data, error: errorConsulta } = await supabase
      .from('jugadores')
      .select('id, equipo_id, nombre, numero, activo')
      .order('nombre')

    if (errorConsulta) throw errorConsulta
    setJugadores(data || [])
  }

  function nombreEquipo(id) {
    return equipos.find(equipo => String(equipo.id) === String(id))?.nombre || `Equipo #${id}`
  }

  function duplicadosDe(jugador) {
    return jugadores.filter(otro =>
      otro.id !== jugador.id &&
      String(otro.equipo_id) === String(jugador.equipo_id) &&
      normalizarNombre(otro.nombre) === normalizarNombre(jugador.nombre)
    )
  }

  async function agregarJugador(e) {
    e.preventDefault()
    if (procesando) return
    setMensaje('')
    setError('')

    const nombreLimpio = nombre.trim()
    if (!equipoId || nombreLimpio.length < 2 || nombreLimpio.length > 120) {
      setError('Selecciona un equipo y escribe el nombre completo del jugador.')
      return
    }
    if (!numeroValido(numero)) {
      setError('El número de camiseta debe ser un entero entre 0 y 999.')
      return
    }

    const posibles = jugadores.filter(j =>
      j.activo &&
      String(j.equipo_id) === String(equipoId) &&
      normalizarNombre(j.nombre) === normalizarNombre(nombreLimpio)
    )

    if (posibles.length > 0) {
      const continuar = window.confirm(
        `Ya existe un jugador activo con ese nombre en ${nombreEquipo(equipoId)}.\n` +
        `ID existente: ${posibles.map(j => j.id).join(', ')}.\n\n` +
        '¿Deseas agregar otro registro de todos modos?'
      )
      if (!continuar) return
    }

    setProcesando(true)
    try {
      const { data, error: errorInsertar } = await supabase
        .from('jugadores')
        .insert({
          equipo_id: Number(equipoId),
          nombre: nombreLimpio,
          numero: numero === '' ? null : Number(numero),
          activo: true
        })
        .select('id')
        .single()

      if (errorInsertar || !data) throw errorInsertar || new Error('No se confirmó el registro.')
      setNombre('')
      setNumero('')
      await cargarJugadores()
      setMensaje(`Jugador agregado correctamente (ID #${data.id}).`)
    } catch (err) {
      setError('No se pudo completar el registro: ' + err.message)
    } finally {
      setProcesando(false)
    }
  }

  function comenzarEdicion(jugador) {
    setEditandoId(jugador.id)
    setEditNombre(jugador.nombre)
    setEditEquipoId(String(jugador.equipo_id))
    setEditNumero(jugador.numero ?? '')
    setMensaje('')
    setError('')
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setEditNombre('')
    setEditEquipoId('')
    setEditNumero('')
  }

  async function guardarEdicion(id) {
    if (procesando) return
    setMensaje('')
    setError('')

    if (!editEquipoId || editNombre.trim().length < 2 || editNombre.trim().length > 120) {
      setError('El jugador debe tener un nombre completo y un equipo.')
      return
    }
    if (!numeroValido(editNumero)) {
      setError('El número de camiseta debe ser un entero entre 0 y 999.')
      return
    }

    setProcesando(true)
    try {
      const { data, error: errorGuardar } = await supabase
        .from('jugadores')
        .update({
          nombre: editNombre.trim(),
          equipo_id: Number(editEquipoId),
          numero: editNumero === '' ? null : Number(editNumero)
        })
        .eq('id', id)
        .select('id')
        .single()

      if (errorGuardar || !data) throw errorGuardar || new Error('No se confirmó el cambio.')
      cancelarEdicion()
      await cargarJugadores()
      setMensaje(`Jugador ID #${id} actualizado correctamente.`)
    } catch (err) {
      setError('No se pudo actualizar el jugador: ' + err.message)
    } finally {
      setProcesando(false)
    }
  }

  async function cambiarEstado(jugador) {
    if (procesando) return
    setMensaje('')
    setError('')

    const reactivar = !jugador.activo
    const accion = reactivar ? 'REACTIVAR' : 'DAR DE BAJA'
    const confirmar = window.confirm(
      `${accion} JUGADOR\n\n` +
      `Nombre: ${jugador.nombre}\n` +
      `Equipo: ${nombreEquipo(jugador.equipo_id)}\n` +
      `ID del registro: #${jugador.id}\n\n` +
      (reactivar
        ? 'El jugador volverá a aparecer en la plantilla activa. ¿Continuar?'
        : 'El jugador dejará de aparecer en la plantilla activa, pero su registro e historial se conservarán. ¿Continuar?')
    )

    if (!confirmar) return

    setProcesando(true)
    try {
      const { data, error: errorCambio } = await supabase
        .from('jugadores')
        .update({ activo: reactivar })
        .eq('id', jugador.id)
        .eq('activo', jugador.activo)
        .select('id, activo')
        .single()

      if (errorCambio || !data) {
        throw errorCambio || new Error('No se confirmó el cambio. Actualiza la página.')
      }

      await cargarJugadores()
      setMensaje(
        reactivar
          ? `${jugador.nombre} (ID #${jugador.id}) fue reactivado.`
          : `${jugador.nombre} (ID #${jugador.id}) fue dado de baja. Su historial se conserva.`
      )
    } catch (err) {
      setError('No se pudo cambiar el estado: ' + err.message)
    } finally {
      setProcesando(false)
    }
  }

  const textoBuscado = normalizarNombre(busqueda)
  const jugadoresFiltrados = jugadores.filter(jugador => {
    const coincideNombre = normalizarNombre(jugador.nombre).includes(textoBuscado) ||
      String(jugador.id).includes(busqueda.trim())
    const coincideEquipo = !filtroEquipo || String(jugador.equipo_id) === String(filtroEquipo)
    const coincideEstado = filtroEstado === 'todos' ||
      (filtroEstado === 'activos' && jugador.activo) ||
      (filtroEstado === 'inactivos' && !jugador.activo)
    return coincideNombre && coincideEquipo && coincideEstado
  })

  const totalActivos = jugadores.filter(j => j.activo).length
  const totalInactivos = jugadores.length - totalActivos

  if (verificando) {
    return <main style={{ padding: 30 }}>Verificando acceso...</main>
  }

  if (!autorizado) {
    return (
      <main style={{ maxWidth: 800, margin: '40px auto', padding: 20 }}>
        <h1>Administrar Jugadores</h1>
        <p role="alert" style={{ color: '#b42318' }}>{error || 'No tienes acceso a esta sección.'}</p>
        <button onClick={() => router.push('/login')}>Ir a iniciar sesión</button>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 1100, margin: '40px auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <button type="button" onClick={() => router.push('/admin')} style={botonSecundario}>
          ← Volver al panel
        </button>
        <button type="button" onClick={() => router.push('/admin/equipos')} style={botonSecundario}>
          ← Volver a Equipos
        </button>
        <button type="button" onClick={() => router.push('/admin/resultados')} style={botonSecundario}>
          Continuar a Resultados →
        </button>
      </div>

      <h1>Administrar Jugadores</h1>
      <p>Agrega, edita y administra las plantillas de YSASL.</p>
      <p>
        <strong>{totalActivos}</strong> activos · <strong>{totalInactivos}</strong> dados de baja
      </p>
      <p style={{ color: '#555' }}>
        Dar de baja conserva el registro y el historial. No se eliminan jugadores desde esta pantalla.
      </p>

      <form onSubmit={agregarJugador} style={{ marginTop: 30, padding: 24, border: '1px solid #ddd', borderRadius: 10, maxWidth: 600 }}>
        <h2>Agregar jugador</h2>
        <label htmlFor="nuevo-equipo">Equipo</label>
        <select id="nuevo-equipo" value={equipoId} onChange={e => setEquipoId(e.target.value)} style={campo} required>
          <option value="">Seleccionar equipo</option>
          {equipos.map(equipo => (
            <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>
          ))}
        </select>

        <label htmlFor="nuevo-nombre">Nombre del jugador</label>
        <input id="nuevo-nombre" type="text" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={120} style={campo} required />

        <label htmlFor="nuevo-numero">Número de camiseta (opcional)</label>
        <input id="nuevo-numero" type="number" min="0" max="999" step="1" value={numero} onChange={e => setNumero(e.target.value)} style={campo} />

        <button type="submit" disabled={procesando} style={botonPrincipal}>
          {procesando ? 'Guardando...' : 'Agregar jugador'}
        </button>
      </form>

      {mensaje && <p role="status" style={{ marginTop: 20, padding: 12, background: '#edf8f0', borderRadius: 6, color: '#166534' }}>{mensaje}</p>}
      {error && <p role="alert" style={{ marginTop: 20, padding: 12, background: '#fff1f1', borderRadius: 6, color: '#b42318' }}>{error}</p>}

      <section style={{ marginTop: 40 }}>
        <h2>Jugadores registrados</h2>
        <div style={{ display: 'flex', gap: 15, flexWrap: 'wrap', margin: '20px 0' }}>
          <div style={{ flex: 1, minWidth: 210 }}>
            <label htmlFor="buscar-jugador">Buscar por nombre o ID</label>
            <input id="buscar-jugador" type="text" placeholder="Nombre o ID..." value={busqueda} onChange={e => setBusqueda(e.target.value)} style={campoFiltro} />
          </div>
          <div style={{ flex: 1, minWidth: 210 }}>
            <label htmlFor="filtrar-equipo">Filtrar por equipo</label>
            <select id="filtrar-equipo" value={filtroEquipo} onChange={e => setFiltroEquipo(e.target.value)} style={campoFiltro}>
              <option value="">Todos los equipos</option>
              {equipos.map(equipo => (
                <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label htmlFor="filtrar-estado">Estado</label>
            <select id="filtrar-estado" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={campoFiltro}>
              <option value="activos">Activos</option>
              <option value="inactivos">Dados de baja</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>

        <p>Mostrando {jugadoresFiltrados.length} de {jugadores.length} registros.</p>

        {jugadoresFiltrados.length === 0 ? (
          <p>No se encontraron jugadores con esos filtros.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 15 }}>
              <thead>
                <tr>
                  <th style={celda}>Jugador / ID</th>
                  <th style={celda}>Equipo</th>
                  <th style={celda}>Número</th>
                  <th style={celda}>Estado</th>
                  <th style={celda}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {jugadoresFiltrados.map(jugador => {
                  const posibles = duplicadosDe(jugador)
                  return (
                    <tr key={jugador.id}>
                      {editandoId === jugador.id ? (
                        <>
                          <td style={celda}>
                            <input value={editNombre} onChange={e => setEditNombre(e.target.value)} maxLength={120} style={campoTabla} />
                            <small>ID #{jugador.id}</small>
                          </td>
                          <td style={celda}>
                            <select value={editEquipoId} onChange={e => setEditEquipoId(e.target.value)} style={campoTabla}>
                              {equipos.map(equipo => (
                                <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>
                              ))}
                            </select>
                          </td>
                          <td style={celda}>
                            <input type="number" min="0" max="999" step="1" value={editNumero} onChange={e => setEditNumero(e.target.value)} style={{ ...campoTabla, width: 85 }} />
                          </td>
                          <td style={celda}>{jugador.activo ? 'Activo' : 'Baja'}</td>
                          <td style={celda}>
                            <button type="button" onClick={() => guardarEdicion(jugador.id)} disabled={procesando} style={botonGuardar}>Guardar</button>
                            <button type="button" onClick={cancelarEdicion} disabled={procesando} style={botonSecundario}>Cancelar</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={celda}>
                            <strong>{jugador.nombre}</strong>
                            <div style={{ fontSize: 12, color: '#555' }}>ID #{jugador.id}</div>
                            {posibles.length > 0 && (
                              <div style={{ fontSize: 12, color: '#9a5600', marginTop: 4 }}>
                                Posible duplicado: ID {posibles.map(j => `#${j.id} (${j.activo ? 'activo' : 'baja'})`).join(', ')}.
                                Verifica antes de dar de baja.
                              </div>
                            )}
                          </td>
                          <td style={celda}>{nombreEquipo(jugador.equipo_id)}</td>
                          <td style={celda}>{jugador.numero ?? '-'}</td>
                          <td style={celda}>{jugador.activo ? 'Activo' : 'Baja'}</td>
                          <td style={celda}>
                            <button type="button" onClick={() => comenzarEdicion(jugador)} disabled={procesando || editandoId !== null} style={botonEditar}>Editar</button>
                            <button
                              type="button"
                              onClick={() => cambiarEstado(jugador)}
                              disabled={procesando || editandoId !== null}
                              style={jugador.activo ? botonBaja : botonReactivar}
                            >
                              {jugador.activo ? 'Dar de baja' : 'Reactivar'}
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

const campo = {
  display: 'block', width: '100%', padding: 10, marginTop: 6,
  marginBottom: 18, boxSizing: 'border-box'
}

const campoFiltro = {
  display: 'block', width: '100%', padding: 10, marginTop: 6,
  boxSizing: 'border-box'
}

const campoTabla = {
  padding: 8, width: '100%', boxSizing: 'border-box'
}

const botonPrincipal = {
  background: '#0b2d50', color: 'white', border: 'none', borderRadius: 6,
  padding: '12px 20px', cursor: 'pointer', fontWeight: 'bold'
}

const botonEditar = {
  padding: '8px 10px', marginRight: 6, marginBottom: 4, cursor: 'pointer'
}

const botonGuardar = {
  background: '#0b2d50', color: 'white', border: 'none', borderRadius: 4,
  padding: '8px 10px', marginRight: 6, cursor: 'pointer'
}

const botonSecundario = {
  padding: '8px 10px', marginRight: 6, marginBottom: 4, cursor: 'pointer'
}

const botonBaja = {
  background: '#b42318', color: 'white', border: 'none', borderRadius: 4,
  padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold'
}

const botonReactivar = {
  background: '#16803c', color: 'white', border: 'none', borderRadius: 4,
  padding: '8px 12px', cursor: 'pointer', fontWeight: 'bold'
}

const celda = {
  borderBottom: '1px solid #ddd', padding: 12, textAlign: 'left', verticalAlign: 'middle'
}
