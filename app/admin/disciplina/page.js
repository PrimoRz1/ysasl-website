'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function AdminDisciplinaPage() {
  const [suspensiones, setSuspensiones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [errorMensaje, setErrorMensaje] = useState('')

  useEffect(() => {
    cargarSuspensiones()
  }, [])

  async function cargarSuspensiones() {
    setCargando(true)
    setErrorMensaje('')

    const { data, error } = await supabase
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
          id,
          nombre,
          numero,
          equipo_id,
          equipos (
            id,
            nombre
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error al cargar suspensiones:', error)
      setErrorMensaje(error.message)
      setSuspensiones([])
    } else {
      setSuspensiones(data || [])
    }

    setCargando(false)
  }

  return (
    <main
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 20px'
      }}
    >
      <h1 style={{ fontSize: '36px', marginBottom: '10px' }}>
        Administrar Disciplina
      </h1>

      <p style={{ fontSize: '18px', marginBottom: '35px' }}>
        Tarjetas, suspensiones y sanciones de la Yuba Sutter Adult Soccer League.
      </p>

      {cargando && (
        <p>Cargando disciplina...</p>
      )}

      {!cargando && errorMensaje && (
        <div
          style={{
            border: '1px solid #dc2626',
            borderRadius: '10px',
            padding: '20px',
            marginBottom: '25px'
          }}
        >
          <strong>Error al cargar suspensiones</strong>
          <p>{errorMensaje}</p>
        </div>
      )}

      {!cargando && !errorMensaje && suspensiones.length === 0 && (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '10px',
            padding: '28px'
          }}
        >
          <h2>Sin suspensiones registradas</h2>
          <p>Actualmente no hay suspensiones activas o históricas.</p>
        </div>
      )}

      {!cargando && !errorMensaje && suspensiones.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>Jugador</th>
                <th style={thStyle}>Equipo</th>
                <th style={thStyle}>Motivo</th>
                <th style={thStyle}>Suspensión</th>
                <th style={thStyle}>Cumplidos</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Fecha</th>
              </tr>
            </thead>

            <tbody>
              {suspensiones.map((suspension) => (
                <tr key={suspension.id}>
                  <td style={tdStyle}>
                    {suspension.jugadores?.nombre || 'Sin jugador'}
                  </td>

                  <td style={tdStyle}>
                    {suspension.jugadores?.equipos?.nombre || 'Sin equipo'}
                  </td>

                  <td style={tdStyle}>
                    {suspension.motivo || '-'}
                  </td>

                  <td style={tdStyle}>
                    {suspension.partidos_suspension ?? 0}
                  </td>

                  <td style={tdStyle}>
                    {suspension.partidos_cumplidos ?? 0}
                  </td>

                  <td style={tdStyle}>
                    {suspension.activa ? 'Activa' : 'Cumplida'}
                  </td>

                  <td style={tdStyle}>
                    {suspension.fecha || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}

const thStyle = {
  textAlign: 'left',
  padding: '12px',
  borderBottom: '2px solid #ddd'
}

const tdStyle = {
  padding: '12px',
  borderBottom: '1px solid #ddd'
}
