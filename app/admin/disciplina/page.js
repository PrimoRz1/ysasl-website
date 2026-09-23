'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function AdminDisciplinaPage() {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarDisciplina()
  }, [])

  async function cargarDisciplina() {
    setCargando(true)

    const { data, error } = await supabase
      .from('disciplina')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error al cargar disciplina:', error)
      setRegistros([])
    } else {
      setRegistros(data || [])
    }

    setCargando(false)
  }

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '40px auto',
        padding: '0 20px',
      }}
    >
      <h1>Administrar Disciplina</h1>

      <p>
        Tarjetas, suspensiones y sanciones de la Yuba Sutter Adult Soccer League.
      </p>

      {cargando ? (
        <p>Cargando...</p>
      ) : registros.length === 0 ? (
        <div
          style={{
            marginTop: '30px',
            padding: '25px',
            border: '1px solid #ddd',
            borderRadius: '10px',
          }}
        >
          <h2>Sin sanciones registradas</h2>
          <p>Actualmente no hay registros disciplinarios.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', marginTop: '30px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr>
                <th style={celda}>Jugador</th>
                <th style={celda}>Equipo</th>
                <th style={celda}>Tarjeta</th>
                <th style={celda}>Suspensión</th>
              </tr>
            </thead>

            <tbody>
              {registros.map((registro) => (
                <tr key={registro.id}>
                  <td style={celda}>
                    {registro.jugador_nombre || '-'}
                  </td>

                  <td style={celda}>
                    {registro.equipo_nombre || '-'}
                  </td>

                  <td style={celda}>
                    {registro.tarjeta || '-'}
                  </td>

                  <td style={celda}>
                    {registro.suspension || '-'}
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

const celda = {
  border: '1px solid #ddd',
  padding: '12px',
  textAlign: 'left',
}
