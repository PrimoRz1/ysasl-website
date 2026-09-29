'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function TemporadasPage() {
  const [temporadas, setTemporadas] = useState([])
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarTemporadas()
  }, [])

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
        fecha_fin: fechaFin || null,
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
    setFechaFin('')
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

          <div style={{ marginBottom: '15px' }}>
            <label>
              <strong>Fecha final</strong>
            </label>

            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
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
          </div>
        ))
      )}
    </main>
  )
}
