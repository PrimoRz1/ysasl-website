
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function AdminEquiposPage() {
  const [equipos, setEquipos] = useState([])
  const [divisiones, setDivisiones] = useState([])
  const [temporadas, setTemporadas] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [nombre, setNombre] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [nombreEditado, setNombreEditado] = useState('')
  const [inscripcionEditadaId, setInscripcionEditadaId] = useState('')
  const [divisionEditadaId, setDivisionEditadaId] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const [rEquipos, rDivisiones, rTemporadas, rInscripciones] = await Promise.all([
      supabase.from('equipos').select('id, nombre, activo').order('nombre'),
      supabase.from('divisiones').select('id, nombre, temporada_id').order('orden'),
      supabase.from('temporadas').select('id, nombre, activa').order('id', { ascending: false }),
      supabase.from('inscripciones_equipo').select('id, equipo_id, division_id, activo')
    ])

    const fallo = [rEquipos, rDivisiones, rTemporadas, rInscripciones].find((r) => r.error)
    if (fallo) {
      console.error(fallo.error)
      setMensaje(`Error al cargar datos: ${fallo.error.message}`)
      return
    }

    setEquipos(rEquipos.data || [])
    setDivisiones(rDivisiones.data || [])
    setTemporadas(rTemporadas.data || [])
    setInscripciones(rInscripciones.data || [])
  }

  function etiquetaDivision(id) {
    const division = divisiones.find((d) => d.id === Number(id))
    if (!division) return 'Sin división'
    const temporada = temporadas.find((t) => t.id === division.temporada_id)
    return `${temporada?.nombre || 'Sin torneo'} — ${division.nombre}`
  }

  function inscripcionesActivas(equipoId) {
    return inscripciones.filter((i) => i.equipo_id === equipoId && i.activo)
  }

  function obtenerTorneoDivision(equipoId) {
    const activas = inscripcionesActivas(equipoId)
    return activas.length
      ? activas.map((i) => etiquetaDivision(i.division_id)).join(' | ')
      : 'Sin división'
  }

  async function crearEquipo() {
    if (ocupado) return
    if (!nombre.trim() || !divisionId) {
      setMensaje('Escribe el nombre y selecciona una división.')
      return
    }

    setOcupado(true)
    setMensaje('')
    try {
      const { data: equipo, error } = await supabase
        .from('equipos')
        .insert({ nombre: nombre.trim(), activo: true })
        .select('id')
        .single()

      if (error || !equipo) throw new Error(error?.message || 'No se creó el equipo.')

      const { error: errorInscripcion } = await supabase
        .from('inscripciones_equipo')
        .insert({ equipo_id: equipo.id, division_id: Number(divisionId), activo: true })

      if (errorInscripcion) {
        setMensaje(`Se creó el equipo ID ${equipo.id}, pero falló la inscripción: ${errorInscripcion.message}. No lo agregues de nuevo; revisemos ese equipo.`)
        await cargarDatos()
        return
      }

      setNombre('')
      setDivisionId('')
      await cargarDatos()
      setMensaje('Equipo creado correctamente.')
    } catch (error) {
      setMensaje(`No se pudo crear el equipo: ${error.message}`)
    } finally {
      setOcupado(false)
    }
  }

  function empezarEdicion(equipo) {
    const primera = inscripcionesActivas(equipo.id)[0]
    setEditandoId(equipo.id)
    setNombreEditado(equipo.nombre)
    setInscripcionEditadaId(primera ? String(primera.id) : '')
    setDivisionEditadaId(primera ? String(primera.division_id) : '')
    setMensaje('')
  }

  async function guardarNombre(equipo) {
    if (ocupado) return
    const nuevoNombre = nombreEditado.trim()
    if (!nuevoNombre) {
      setMensaje('El nombre no puede estar vacío.')
      return
    }
    if (nuevoNombre === equipo.nombre) {
      setMensaje('El nombre no cambió.')
      return
    }

    setOcupado(true)
    try {
      const { data, error } = await supabase
        .from('equipos')
        .update({ nombre: nuevoNombre })
        .eq('id', equipo.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('No se actualizó el registro. Revisa los permisos de Supabase.')
      await cargarDatos()
      setEditandoId(null)
      setMensaje('Nombre actualizado correctamente. El nombre nuevo se verá también en los partidos anteriores de este equipo.')
    } catch (error) {
      setMensaje(`No se pudo cambiar el nombre: ${error.message}`)
    } finally {
      setOcupado(false)
    }
  }

  async function contarPartidos(equipoId) {
    const { count, error } = await supabase
      .from('partidos')
      .select('id', { count: 'exact', head: true })
      .or(`local_id.eq.${equipoId},visitante_id.eq.${equipoId}`)

    if (error) throw error
    return count ?? 0
  }

  async function cambiarDivision(equipo) {
    if (ocupado) return
    const actual = inscripciones.find(
      (i) => i.id === Number(inscripcionEditadaId) && i.equipo_id === equipo.id && i.activo
    )
    const origen = divisiones.find((d) => d.id === actual?.division_id)
    const destino = divisiones.find((d) => d.id === Number(divisionEditadaId))

    if (!actual || !origen || !destino) {
      setMensaje('Selecciona una inscripción y una división válidas.')
      return
    }
    if (origen.id === destino.id) {
      setMensaje('La división no cambió.')
      return
    }
    if (origen.temporada_id !== destino.temporada_id) {
      setMensaje('Solo se permite cambiar a otra división del mismo torneo.')
      return
    }
    if (inscripciones.some((i) => i.id !== actual.id && i.equipo_id === equipo.id && i.division_id === destino.id && i.activo)) {
      setMensaje('El equipo ya tiene una inscripción activa en esa división.')
      return
    }

    setOcupado(true)
    try {
      const partidos = await contarPartidos(equipo.id)
      if (partidos > 0) {
        setMensaje(`No se puede cambiar la división: ${equipo.nombre} tiene ${partidos} partido(s) registrados. Así protegemos el calendario y los resultados.`)
        return
      }
      if (!window.confirm(`¿Cambiar ${equipo.nombre} de ${etiquetaDivision(origen.id)} a ${etiquetaDivision(destino.id)}?`)) return

      const { data, error } = await supabase
        .from('inscripciones_equipo')
        .update({ division_id: destino.id })
        .eq('id', actual.id)
        .eq('equipo_id', equipo.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('No se actualizó la inscripción. Revisa los permisos de Supabase.')
      await cargarDatos()
      setEditandoId(null)
      setMensaje('División actualizada correctamente.')
    } catch (error) {
      setMensaje(`No se pudo cambiar la división: ${error.message}`)
    } finally {
      setOcupado(false)
    }
  }

  async function eliminarEquipo(equipo) {
    if (ocupado) return
    setOcupado(true)
    setMensaje('')
    try {
      const [partidos, rJugadores, rEventos] = await Promise.all([
        contarPartidos(equipo.id),
        supabase.from('jugadores').select('id', { count: 'exact', head: true }).eq('equipo_id', equipo.id),
        supabase.from('eventos_partido').select('id', { count: 'exact', head: true }).eq('equipo_id', equipo.id)
      ])
      if (rJugadores.error) throw rJugadores.error
      if (rEventos.error) throw rEventos.error

      const jugadores = rJugadores.count ?? 0
      const eventos = rEventos.count ?? 0
      if (partidos > 0 || jugadores > 0 || eventos > 0) {
        setMensaje(`No se eliminó ${equipo.nombre}: tiene ${partidos} partido(s), ${jugadores} jugador(es) y ${eventos} evento(s). No borraremos esos datos.`)
        return
      }

      const confirmacion = window.prompt(
        `ELIMINACIÓN PERMANENTE DE ${equipo.nombre}.\n\nTambién se borrarán sus inscripciones y preferencias de horario.\nPara confirmar, escribe exactamente el nombre del equipo:`
      )
      if (confirmacion !== equipo.nombre) {
        setMensaje('Eliminación cancelada. No se cambió ningún equipo.')
        return
      }

      const { data, error } = await supabase
        .from('equipos')
        .delete()
        .eq('id', equipo.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('No se eliminó el equipo. Revisa los permisos de Supabase.')
      await cargarDatos()
      if (editandoId === equipo.id) setEditandoId(null)
      setMensaje(`Se eliminó ${equipo.nombre} correctamente.`)
    } catch (error) {
      setMensaje(`No se pudo eliminar el equipo: ${error.message}`)
    } finally {
      setOcupado(false)
    }
  }

  const inscripcionActual = inscripciones.find((i) => i.id === Number(inscripcionEditadaId))
  const divisionActual = divisiones.find((d) => d.id === inscripcionActual?.division_id)
  const divisionesMismoTorneo = divisiones.filter(
    (d) => d.temporada_id === divisionActual?.temporada_id
  )
  const estiloBoton = { padding: '8px 12px', cursor: 'pointer', marginRight: '8px', marginTop: '8px' }
  const estiloInput = { padding: '8px', marginRight: '10px', maxWidth: '100%' }

  return (
    <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px' }}>
      <div style={{ marginBottom: '25px' }}>
        <button type="button" onClick={() => window.location.href = '/admin/partidos'} style={estiloBoton}>
          ← Volver a Partidos
        </button>
        <button type="button" onClick={() => window.location.href = '/admin/jugadores'} style={estiloBoton}>
          Continuar a Jugadores →
        </button>
      </div>

      <h1>Administrar Equipos</h1>
      <p>Agrega, edita y administra los equipos de YSASL.</p>

      <div style={{ border: '1px solid #ddd', padding: '20px', marginTop: '25px', marginBottom: '30px', borderRadius: '8px' }}>
        <h2>Agregar equipo</h2>
        <input
          type="text"
          placeholder="Nombre del equipo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={estiloInput}
        />
        <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)} style={estiloInput}>
          <option value="">Seleccionar división</option>
          {divisiones.map((division) => (
            <option key={division.id} value={division.id}>{etiquetaDivision(division.id)}</option>
          ))}
        </select>
        <button type="button" disabled={ocupado} onClick={crearEquipo} style={estiloBoton}>
          + Agregar equipo
        </button>
      </div>

      {mensaje && (
        <p role="status" style={{ padding: '12px', border: '1px solid #ccc', borderRadius: '6px' }}>
          <strong>{mensaje}</strong>
        </p>
      )}

      <h2>Equipos ({equipos.length})</h2>
      {equipos.map((equipo) => {
        const activas = inscripcionesActivas(equipo.id)
        return (
          <div key={equipo.id} style={{ borderBottom: '1px solid #ddd', padding: '16px 0' }}>
            <strong>{equipo.nombre}</strong>
            <div style={{ marginTop: '4px', color: '#666' }}>{obtenerTorneoDivision(equipo.id)}</div>
            <button type="button" disabled={ocupado} onClick={() => editandoId === equipo.id ? setEditandoId(null) : empezarEdicion(equipo)} style={estiloBoton}>
              {editandoId === equipo.id ? 'Cancelar edición' : 'Editar equipo'}
            </button>
            <button type="button" disabled={ocupado} onClick={() => eliminarEquipo(equipo)} style={{ ...estiloBoton, color: '#b42318' }}>
              Eliminar equipo
            </button>

            {editandoId === equipo.id && (
              <div style={{ marginTop: '12px', padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0 }}>Editar {equipo.nombre}</h3>
                <p><strong>Nombre del equipo</strong></p>
                <input type="text" value={nombreEditado} onChange={(e) => setNombreEditado(e.target.value)} style={estiloInput} />
                <button type="button" disabled={ocupado} onClick={() => guardarNombre(equipo)} style={estiloBoton}>
                  Guardar nombre
                </button>

                {activas.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <p><strong>Cambiar división (solo si el equipo no tiene partidos)</strong></p>
                    {activas.length > 1 && (
                      <select
                        value={inscripcionEditadaId}
                        onChange={(e) => {
                          const nueva = activas.find((i) => String(i.id) === e.target.value)
                          setInscripcionEditadaId(e.target.value)
                          setDivisionEditadaId(nueva ? String(nueva.division_id) : '')
                        }}
                        style={estiloInput}
                      >
                        {activas.map((i) => (
                          <option key={i.id} value={i.id}>{etiquetaDivision(i.division_id)}</option>
                        ))}
                      </select>
                    )}
                    <select value={divisionEditadaId} onChange={(e) => setDivisionEditadaId(e.target.value)} style={estiloInput}>
                      {divisionesMismoTorneo.map((d) => (
                        <option key={d.id} value={d.id}>{etiquetaDivision(d.id)}</option>
                      ))}
                    </select>
                    <button type="button" disabled={ocupado} onClick={() => cambiarDivision(equipo)} style={estiloBoton}>
                      Guardar división
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </main>
  )
}
