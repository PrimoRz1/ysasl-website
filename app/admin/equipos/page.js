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

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: equiposData } = await supabase
      .from('equipos')
      .select('id, nombre, activo')
      .order('nombre')

    const { data: divisionesData } = await supabase
      .from('divisiones')
      .select('id, nombre, temporada_id')
      .order('orden')
    const { data: temporadasData } = await supabase
  .from('temporadas')
  .select('id, nombre, activa')
  .order('id', { ascending: false })

    const { data: inscripcionesData, error: inscripcionesError } = await supabase
      .from('inscripciones_equipo')
      .select('id, equipo_id, division_id, activo')
    

    setEquipos(equiposData || [])
    setDivisiones(divisionesData || [])
    setTemporadas(temporadasData || [])
    setInscripciones(inscripcionesData || [])
  }

  async function crearEquipo() {
    if (!nombre.trim() || !divisionId) {
      setMensaje('Escribe el nombre y selecciona una división.')
      return
    }

    setMensaje('')

    const { data: equipo, error } = await supabase
      .from('equipos')
      .insert({
        nombre: nombre.trim(),
        activo: true
      })
      .select()
      .single()

    if (error) {
      console.error(error)
      setMensaje('No se pudo crear el equipo.')
      return
    }

    const { error: errorInscripcion } = await supabase
      .from('inscripciones_equipo')
      .insert({
        equipo_id: equipo.id,
        division_id: Number(divisionId),
        activo: true
      })

    if (errorInscripcion) {
      console.error(errorInscripcion)
      setMensaje('Equipo creado, pero no se pudo asignar a la división.')
      return
    }

    setNombre('')
    setDivisionId('')
    setMensaje('Equipo creado correctamente.')
    await cargarDatos()
  }

  function obtenerTorneoDivision(equipoId) {
  const inscripcion = inscripciones.find(
    (item) => item.equipo_id === equipoId && item.activo
  )

  if (!inscripcion) return 'Sin división'

  const division = divisiones.find(
    (division) => division.id === inscripcion.division_id
  )

  if (!division) return 'Sin división'

  const temporada = temporadas.find(
    (temporada) => temporada.id === division.temporada_id
  )

  return `${temporada?.nombre || 'Sin torneo'} — ${division.nombre}`
}

  return (
    <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px' }}>
  <div style={{ marginBottom: '25px' }}>
  <button
    type="button"
    onClick={() => window.location.href = '/admin/partidos'}
    style={{ padding: '10px 15px', cursor: 'pointer' }}
  >
    ← Volver a Partidos
  </button>

  <button
    type="button"
    onClick={() => window.location.href = '/admin/jugadores'}
    style={{ marginLeft: '10px', padding: '10px 15px', cursor: 'pointer' }}
  >
    Continuar a Jugadores →
  </button>
</div>
      <h1>Administrar Equipos</h1>

      <p>Desde aquí podrás agregar y administrar los equipos de YSASL.</p>

      <div
        style={{
          border: '1px solid #ddd',
          padding: '20px',
          marginTop: '25px',
          marginBottom: '30px'
        }}
      >
        <h2>Agregar equipo</h2>

        <input
          type="text"
          placeholder="Nombre del equipo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={{ padding: '8px', marginRight: '10px' }}
        />

        <select
          value={divisionId}
          onChange={(e) => setDivisionId(e.target.value)}
          style={{ padding: '8px', marginRight: '10px' }}
        >
          <option value="">Seleccionar división</option>

          {divisiones.map((division) => {
  const temporada = temporadas.find(
    (t) => t.id === division.temporada_id
  )

  return (
    <option key={division.id} value={division.id}>
      {temporada ? `${temporada.nombre} — ` : ''}
      {division.nombre}
    </option>
  )
})}
        </select>

        <button
          type="button"
          onClick={crearEquipo}
          style={{ padding: '8px 14px', cursor: 'pointer' }}
        >
          + Agregar equipo
        </button>

        {mensaje && <p><strong>{mensaje}</strong></p>}
      </div>

      <h2>Equipos</h2>

      {equipos.map((equipo) => (
        <div
          key={equipo.id}
          style={{
            borderBottom: '1px solid #ddd',
            padding: '12px 0'
          }}
        >
          <strong>{equipo.nombre}</strong>
          <div>{obtenerTorneoDivision(equipo.id)}</div>
        </div>
      ))}
    </main>
  )
}
