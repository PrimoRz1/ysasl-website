'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function TemporadasPage() {
  const [temporadas, setTemporadas] = useState([])
  const [divisiones, setDivisiones] = useState([])
const [nuevaDivision, setNuevaDivision] = useState('')
const [temporadaSeleccionada, setTemporadaSeleccionada] = useState(null)
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarTemporadas()
    cargarDivisiones()
    }, [])
    async function crearDivision(temporadaId) {
  if (!nuevaDivision.trim()) {
    setMensaje('Escribe el nombre de la división.')
    return
  }

  const divisionesDelTorneo = divisiones.filter(
    (division) => division.temporada_id === temporadaId
  )

  const { error } = await supabase
    .from('divisiones')
    .insert({
      temporada_id: temporadaId,
      nombre: nuevaDivision.trim(),
      orden: divisionesDelTorneo.length + 1,
    })

  if (error) {
    console.error(error)
    setMensaje('No se pudo crear la división.')
    return
  }

  setNuevaDivision('')
  setMensaje('División creada correctamente.')
  await cargarDivisiones()
}

async function eliminarDivision(division) {
  const confirmar = window.confirm(
    `¿Seguro que deseas eliminar "${division.nombre}"?`
  )

  if (!confirmar) return

  setMensaje('')

  const { error } = await supabase
    .from('divisiones')
    .delete()
    .eq('id', division.id)

  if (error) {
    console.error(error)
    setMensaje('No se pudo eliminar la división.')
    return
  }

  setMensaje('División eliminada correctamente.')
  await cargarDivisiones()
}
  
  async function cargarTemporadas() {
    const { data, error } = await supabase
      .from('temporadas')
      .select('id, nombre, activa, fecha_inicio, fecha_fin')
      .order('id', { ascending: false })

    if (error) {
      console.error(error)
      return
    }

    setTemporadas(data || [])
  }
  async function cargarDivisiones() {
  const { data, error } = await supabase
    .from('divisiones')
    .select('id, nombre, temporada_id, orden')
    .order('orden')

  if (error) {
    console.error(error)
    return
  }

  setDivisiones(data || [])
}

  async function crearTemporada(e) {
    e.preventDefault()
    setMensaje('')

    if (!nombre.trim()) {
      setMensaje('Escribe el nombre del torneo.')
      return
    }

    setGuardando(true)

    const { error } = await supabase
      .from('temporadas')
      .insert({
        nombre: nombre.trim(),
        fecha_inicio: fechaInicio || null,
        
        activa: false
      })

    setGuardando(false)

    if (error) {
      console.error(error)
      setMensaje('No se pudo crear el torneo.')
      return
    }

    setNombre('')
    setFechaInicio('')
    
    setMostrarFormulario(false)
    setMensaje('Torneo creado correctamente.')

    await cargarTemporadas()
  }

  return (
    <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px' }}>
      <h1>Administrar Torneos</h1>

      <p>
        Desde aquí podrás crear y administrar los torneos de YSASL.
      </p>

      <button
        onClick={() => setMostrarFormulario(!mostrarFormulario)}
        style={{
          padding: '12px 20px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        {mostrarFormulario ? 'Cancelar' : '+ Crear nuevo torneo'}
      </button>

      {mostrarFormulario && (
        <form
          onSubmit={crearTemporada}
          style={{
            border: '1px solid #ccc',
            padding: '20px',
            marginBottom: '30px'
          }}
        >
          <h2>Nuevo torneo</h2>

          <div style={{ marginBottom: '15px' }}>
            <label>
              <strong>Nombre del torneo</strong>
            </label>

            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ejemplo: Primavera 2027"
              style={{
                display: 'block',
                width: '100%',
                padding: '10px',
                marginTop: '5px'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>
              <strong>Fecha de inicio</strong>
            </label>

            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{
                display: 'block',
                padding: '10px',
                marginTop: '5px'
              }}
            />
          </div>

          

          <button
            type="submit"
            disabled={guardando}
            style={{
              padding: '12px 20px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            {guardando ? 'Guardando...' : 'Guardar torneo'}
          </button>
        </form>
      )}

      {mensaje && (
        <p>
          <strong>{mensaje}</strong>
        </p>
      )}

      <h2>Torneos</h2>

      {temporadas.length === 0 ? (
        <p>No hay torneos registrados.</p>
      ) : (
        temporadas.map((temporada) => (
          <div
            key={temporada.id}
            style={{
              border: '1px solid #ddd',
              padding: '15px',
              marginBottom: '10px'
            }}
          >
            <strong>{temporada.nombre}</strong>

            {temporada.activa && (
              <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>
                ACTIVO
              </span>
            )}

            <div style={{ marginTop: '8px' }}>
              Inicio: {temporada.fecha_inicio || 'Sin fecha'}
              {' — '}
              Final: {temporada.fecha_fin || 'Sin fecha'}
            </div>
          <div style={{ marginTop: '15px' }}>
  <strong>Divisiones</strong>

  {divisiones
    .filter((division) => division.temporada_id === temporada.id)
    .map((division) => (
      <div
  key={division.id}
  style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}
>
  <span>{division.nombre}</span>

  <button
    type="button"
    onClick={() => eliminarDivision(division)}
    style={{ cursor: 'pointer' }}
  >
    Eliminar
  </button>
</div>
    ))}

  <div style={{ marginTop: '10px' }}>
    <input
      type="text"
      placeholder="Ejemplo: Tercera División"
      value={temporadaSeleccionada === temporada.id ? nuevaDivision : ''}
      onFocus={() => setTemporadaSeleccionada(temporada.id)}
      onChange={(e) => {
        setTemporadaSeleccionada(temporada.id)
        setNuevaDivision(e.target.value)
      }}
      style={{ padding: '8px', marginRight: '8px' }}
    />

    <button
      type="button"
      onClick={() => crearDivision(temporada.id)}
      style={{ padding: '8px 12px', cursor: 'pointer' }}
    >
      + Agregar división
    </button>
  </div>
</div>
              </div>
        ))
      )}
    </main>
  )
}
