'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AdminPartidosPage() {
  const router = useRouter()

  const [divisiones, setDivisiones] = useState([])
  const [equipos, setEquipos] = useState([])
  const [jornadas, setJornadas] = useState([])
  const [campos, setCampos] = useState([])

  const [divisionId, setDivisionId] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)
    setError('')

    const [
      { data: divisionesData, error: divisionesError },
      { data: equiposData, error: equiposError },
      { data: jornadasData, error: jornadasError },
      { data: camposData, error: camposError }
    ] = await Promise.all([
      supabase
        .from('divisiones')
        .select('*')
        .order('id'),

      supabase
        .from('equipos')
        .select('id, nombre')
        .order('nombre'),

      supabase
        .from('jornadas')
        .select('id, division_id, numero, fecha')
        .order('numero'),

      supabase
        .from('campos')
        .select('id, nombre, numero, activo')
        .eq('activo', true)
        .order('numero')
    ])

    if (
      divisionesError ||
      equiposError ||
      jornadasError ||
      camposError
    ) {
      console.error({
        divisionesError,
        equiposError,
        jornadasError,
        camposError
      })

      setError('No se pudieron cargar los datos.')
      setCargando(false)
      return
    }

    setDivisiones(divisionesData || [])
    setEquipos(equiposData || [])
    setJornadas(jornadasData || [])
    setCampos(camposData || [])

    setCargando(false)
  }

  const jornadasFiltradas = jornadas.filter(
    (jornada) =>
      String(jornada.division_id) === String(divisionId)
  )

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '40px auto',
        padding: '0 20px'
      }}
    >
      <button
        onClick={() => router.push('/admin')}
        style={{
          marginBottom: '25px',
          padding: '10px 16px',
          cursor: 'pointer'
        }}
      >
        ← Volver al panel
      </button>

      <h1>Administrar Partidos</h1>

      <p>
        Programa y administra los partidos de Yuba Sutter Adult Soccer League.
      </p>

      {cargando && <p>Cargando información...</p>}

      {error && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>
          {error}
        </p>
      )}

      {!cargando && !error && (
        <div
          style={{
            border: '1px solid #ddd',
            borderRadius: '10px',
            padding: '24px',
            marginTop: '30px'
          }}
        >
          <h2>Programar partido</h2>

          {/* DIVISION */}

          <div style={{ marginBottom: '20px' }}>
            <label>
              <strong>División</strong>
            </label>

            <br />

            <select
              value={divisionId}
              onChange={(e) => setDivisionId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '6px'
              }}
            >
              <option value="">Seleccionar división</option>

              {divisiones.map((division) => (
                <option
                  key={division.id}
                  value={division.id}
                >
                  {division.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* JORNADA */}

          <div style={{ marginBottom: '20px' }}>
            <label>
              <strong>Jornada</strong>
            </label>

            <br />

            <select
              defaultValue=""
              disabled={!divisionId}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '6px'
              }}
            >
              <option value="">
                {divisionId
                  ? 'Seleccionar jornada'
                  : 'Primero selecciona una división'}
              </option>

              {jornadasFiltradas.map((jornada) => (
                <option
                  key={jornada.id}
                  value={jornada.id}
                >
                  Jornada {jornada.numero}
                  {jornada.fecha
                    ? ` - ${jornada.fecha}`
                    : ''}
                </option>
              ))}
            </select>
          </div>

          {/* EQUIPO LOCAL */}

          <div style={{ marginBottom: '20px' }}>
            <label>
              <strong>Equipo local</strong>
            </label>

            <br />

            <select
              defaultValue=""
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '6px'
              }}
            >
              <option value="">
                Seleccionar equipo local
              </option>

              {equipos.map((equipo) => (
                <option
                  key={equipo.id}
                  value={equipo.id}
                >
                  {equipo.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* EQUIPO VISITANTE */}

          <div style={{ marginBottom: '20px' }}>
            <label>
              <strong>Equipo visitante</strong>
            </label>

            <br />

            <select
              defaultValue=""
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '6px'
              }}
            >
              <option value="">
                Seleccionar equipo visitante
              </option>

              {equipos.map((equipo) => (
                <option
                  key={equipo.id}
                  value={equipo.id}
                >
                  {equipo.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* CAMPO */}

          <div style={{ marginBottom: '20px' }}>
            <label>
              <strong>Campo</strong>
            </label>

            <br />

            <select
              defaultValue=""
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '6px'
              }}
            >
              <option value="">
                Seleccionar campo
              </option>

              {campos.map((campo) => (
                <option
                  key={campo.id}
                  value={campo.id}
                >
                  {campo.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* FECHA */}

          <div style={{ marginBottom: '20px' }}>
            <label>
              <strong>Fecha</strong>
            </label>

            <br />

            <input
              type="date"
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '6px'
              }}
            />
          </div>

          {/* HORA */}

          <div>
            <label>
              <strong>Hora</strong>
            </label>

            <br />

            <input
              type="time"
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '6px'
              }}
            />
          </div>
        </div>
      )}
    </main>
  )
}
