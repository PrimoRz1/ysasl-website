'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function AdminDisciplinaPage() {
  const [suspensiones, setSuspensiones] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [jugadorId, setJugadorId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [partidosSuspension, setPartidosSuspension] = useState(1)
  const [fecha, setFecha] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [errorMensaje, setErrorMensaje] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)
    setErrorMensaje('')

    const { data: jugadoresData, error: jugadoresError } = await supabase
      .from('jugadores')
      .select(`
        id,
        nombre,
        numero,
        equipo_id,
        equipos (
          nombre
        )
      `)
      .eq('activo', true)
      .order('nombre')

    if (jugadoresError) {
      console.error('Error al cargar jugadores:', jugadoresError)
      setErrorMensaje('No se pudieron cargar los jugadores.')
    } else {
      setJugadores(jugadoresData || [])
    }

    const { data: suspensionesData, error: suspensionesError } =
      await supabase
        .from('suspensiones')
        .select(`
          id,
          jugador_id,
          motivo,
          partidos_suspension,
          partidos_cumplidos,
          activa,
          fecha,
          created_at,
          jugadores (
            nombre,
            numero,
            equipos (
              nombre
            )
          )
        `)
        .order('created_at', { ascending: false })

    if (suspensionesError) {
      console.error('Error al cargar suspensiones:', suspensionesError)
      setErrorMensaje('No se pudieron cargar las suspensiones.')
    } else {
      setSuspensiones(suspensionesData || [])
    }

    setCargando(false)
  }

  async function guardarSuspension(e) {
    e.preventDefault()
    setErrorMensaje('')

    if (!jugadorId || !motivo.trim() || !partidosSuspension) {
      setErrorMensaje('Completa jugador, motivo y partidos de suspensión.')
      return
    }

    setGuardando(true)

    const { error } = await supabase
      .from('suspensiones')
      .insert({
        jugador_id: Number(jugadorId),
        motivo: motivo.trim(),
        partidos_suspension: Number(partidosSuspension),
        partidos_cumplidos: 0,
        activa: true,
        fecha: fecha || new Date().toISOString().slice(0, 10),
      })

    if (error) {
      console.error('Error al guardar suspensión:', error)
      setErrorMensaje('No se pudo guardar la suspensión.')
      setGuardando(false)
      return
    }

    setJugadorId('')
    setMotivo('')
    setPartidosSuspension(1)
    setFecha('')
    setGuardando(false)

    await cargarDatos()
  }

  return (
    <main
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 24px',
      }}
    >
      <h1 style={{ fontSize: '36px', marginBottom: '10px' }}>
        Administrar Disciplina
      </h1>

      <p style={{ fontSize: '18px', marginBottom: '35px' }}>
        Tarjetas, suspensiones y sanciones de la Yuba Sutter Adult Soccer League.
      </p>

      <section
        style={{
          border: '1px solid #ddd',
          borderRadius: '10px',
          padding: '28px',
          marginBottom: '35px',
          background: 'white',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Registrar suspensión</h2>

        <form onSubmit={guardarSuspension}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '18px',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontWeight: 'bold',
                  marginBottom: '6px',
                }}
              >
                Jugador
              </label>

              <select
                value={jugadorId}
                onChange={(e) => setJugadorId(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                }}
              >
                <option value="">Seleccionar jugador</option>

                {jugadores.map((jugador) => (
                  <option key={jugador.id} value={jugador.id}>
                    {jugador.nombre}
                    {jugador.numero ? ` #${jugador.numero}` : ''}
                    {jugador.equipos?.nombre
                      ? ` - ${jugador.equipos.nombre}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontWeight: 'bold',
                  marginBottom: '6px',
                }}
              >
                Partidos de suspensión
              </label>

              <input
                type="number"
                min="1"
                value={partidosSuspension}
                onChange={(e) => setPartidosSuspension(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontWeight: 'bold',
                  marginBottom: '6px',
                }}
              >
                Fecha
              </label>

              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: '18px' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 'bold',
                marginBottom: '6px',
              }}
            >
              Motivo
            </label>

            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ejemplo: Tarjeta roja"
              required
              style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {errorMensaje && (
            <p style={{ color: '#b00020', marginTop: '15px' }}>
              {errorMensaje}
            </p>
          )}

          <button
            type="submit"
            disabled={guardando}
            style={{
              marginTop: '20px',
              padding: '12px 22px',
              border: 'none',
              borderRadius: '6px',
              background: '#0b2948',
              color: 'white',
              fontWeight: 'bold',
              cursor: 'pointer',
            }}
          >
            {guardando ? 'Guardando...' : 'Guardar suspensión'}
          </button>
        </form>
      </section>

      <section
        style={{
          border: '1px solid #ddd',
          borderRadius: '10px',
          padding: '28px',
          background: 'white',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Suspensiones</h2>

        {cargando ? (
          <p>Cargando...</p>
        ) : suspensiones.length === 0 ? (
          <>
            <h3>Sin suspensiones registradas</h3>
            <p>Actualmente no hay suspensiones activas o históricas.</p>
          </>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Jugador</th>
                  <th style={thStyle}>Equipo</th>
                  <th style={thStyle}>Motivo</th>
                  <th style={thStyle}>Suspensión</th>
                  <th style={thStyle}>Cumplidos</th>
                  <th style={thStyle}>Fecha</th>
                  <th style={thStyle}>Estado</th>
                </tr>
              </thead>

              <tbody>
                {suspensiones.map((suspension) => (
                  <tr key={suspension.id}>
                    <td style={tdStyle}>
                      {suspension.jugadores?.nombre || 'Jugador'}
                    </td>

                    <td style={tdStyle}>
                      {suspension.jugadores?.equipos?.nombre || '-'}
                    </td>

                    <td style={tdStyle}>{suspension.motivo}</td>

                    <td style={tdStyle}>
                      {suspension.partidos_suspension}
                    </td>

                    <td style={tdStyle}>
                      {suspension.partidos_cumplidos}
                    </td>

                    <td style={tdStyle}>
                      {suspension.fecha || '-'}
                    </td>

                    <td style={tdStyle}>
                      {suspension.activa ? 'Activa' : 'Cumplida'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

const thStyle = {
  textAlign: 'left',
  padding: '12px',
  borderBottom: '2px solid #ddd',
}

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #eee',
}
