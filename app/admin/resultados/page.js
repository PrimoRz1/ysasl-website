'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function AdminResultadosPage() {
  const [partidos, setPartidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [guardandoId, setGuardandoId] = useState(null)
  const [goles, setGoles] = useState({})

  useEffect(() => {
    cargarPartidos()
  }, [])

  async function cargarPartidos() {
    setCargando(true)
    setMensaje('')

    const { data, error } = await supabase
      .from('calendario_partidos')
      .select('*')
      .neq('estado', 'finalizado')
      .order('fecha', { ascending: true })
      .order('hora', { ascending: true })

    if (error) {
      console.error(error)
      setMensaje('Error al cargar los partidos.')
      setPartidos([])
    } else {
      setPartidos(data || [])
    }

    setCargando(false)
  }

  function cambiarGol(partidoId, tipo, valor) {
    if (valor !== '' && Number(valor) < 0) return

    setGoles((actual) => ({
      ...actual,
      [partidoId]: {
        ...(actual[partidoId] || {}),
        [tipo]: valor,
      },
    }))
  }

  async function guardarResultado(partido) {
    const resultado = goles[partido.id] || {}
    const golesLocal = resultado.local
    const golesVisitante = resultado.visitante

    if (
      golesLocal === undefined ||
      golesLocal === '' ||
      golesVisitante === undefined ||
      golesVisitante === ''
    ) {
      setMensaje('Escribe los goles de los dos equipos.')
      return
    }

    setGuardandoId(partido.id)
    setMensaje('')

    const { error } = await supabase
      .from('partidos')
      .update({
        goles_local: Number(golesLocal),
        goles_visitante: Number(golesVisitante),
        estado: 'finalizado',
      })
      .eq('id', partido.id)

    if (error) {
      console.error(error)
      setMensaje('Error al guardar el resultado.')
      setGuardandoId(null)
      return
    }

    setMensaje('Resultado guardado correctamente.')
    setGuardandoId(null)

    setGoles((actual) => {
      const copia = { ...actual }
      delete copia[partido.id]
      return copia
    })

    await cargarPartidos()
  }

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '35px 25px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1>Administrar resultados</h1>

      <p>
        Captura el marcador final de los partidos.
      </p>

      {mensaje && (
        <p style={{ fontWeight: 'bold', marginTop: '20px' }}>
          {mensaje}
        </p>
      )}

      {cargando ? (
        <p>Cargando partidos...</p>
      ) : partidos.length === 0 ? (
        <p>No hay partidos pendientes.</p>
      ) : (
        <div style={{ marginTop: '25px' }}>
          {partidos.map((partido) => (
            <div
              key={partido.id}
              style={{
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '18px',
                marginBottom: '15px',
              }}
            >
              <div
                style={{
                  marginBottom: '12px',
                  fontWeight: 'bold',
                }}
              >
                Jornada {partido.jornada}
                {' — '}
                {partido.fecha || 'Sin fecha'}
                {' — '}
                {partido.hora
                  ? String(partido.hora).slice(0, 5)
                  : 'Sin hora'}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '15px',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <strong>{partido.local}</strong>

                <input
                  type="number"
                  min="0"
                  value={goles[partido.id]?.local ?? ''}
                  onChange={(e) =>
                    cambiarGol(partido.id, 'local', e.target.value)
                  }
                  style={{
                    width: '70px',
                    padding: '8px',
                    fontSize: '16px',
                  }}
                />

                <span>vs</span>

                <input
                  type="number"
                  min="0"
                  value={goles[partido.id]?.visitante ?? ''}
                  onChange={(e) =>
                    cambiarGol(
                      partido.id,
                      'visitante',
                      e.target.value
                    )
                  }
                  style={{
                    width: '70px',
                    padding: '8px',
                    fontSize: '16px',
                  }}
                />

                <strong>{partido.visitante}</strong>

                <button
                  onClick={() => guardarResultado(partido)}
                  disabled={guardandoId === partido.id}
                  style={{
                    padding: '9px 15px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                  }}
                >
                  {guardandoId === partido.id
                    ? 'Guardando...'
                    : 'Guardar resultado'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
