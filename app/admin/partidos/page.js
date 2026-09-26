'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AdminPartidosPage() {
  const router = useRouter()

  const [divisiones, setDivisiones] = useState([])
  const [jornadaId, setJornadaId] = useState('')
const [localId, setLocalId] = useState('')
const [visitanteId, setVisitanteId] = useState('')
const [campoId, setCampoId] = useState('')
const [fecha, setFecha] = useState('')
const [hora, setHora] = useState('')
const [guardando, setGuardando] = useState(false)
const [mensaje, setMensaje] = useState('')
  const [equipos, setEquipos] = useState([])
  const [jornadas, setJornadas] = useState([])
  const [campos, setCampos] = useState([])
const [partidosJornada, setPartidosJornada] = useState([])
  const [partidoEditandoId, setPartidoEditandoId] = useState(null)
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
        .select('id, nombre, division_id')
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

  async function cargarPartidosJornada(idJornada) {
  if (!idJornada) {
    setPartidosJornada([])
    return
  }

  const { data, error } = await supabase
    .from('partidos')
    .select(`
      id,
      jornada_id,
      local_id,
      visitante_id,
      campo_id,
      fecha,
      hora
    `)
    .eq('jornada_id', Number(idJornada))
    .order('id')

  if (error) {
    console.error(error)
    setPartidosJornada([])
    return
  }

  setPartidosJornada(data || [])
}
function editarPartido(partido) {
  setPartidoEditandoId(partido.id)
  setJornadaId(String(partido.jornada_id))
  setLocalId(String(partido.local_id))
  setVisitanteId(String(partido.visitante_id))
  setCampoId(partido.campo_id ? String(partido.campo_id) : '')
  setFecha(partido.fecha || '')
  setHora(partido.hora || '')
  setMensaje('')
}
  async function eliminarPartido(id) {
  const confirmar = window.confirm('¿Seguro que quieres eliminar este partido?')

  if (!confirmar) return

  const { error } = await supabase
    .from('partidos')
    .delete()
    .eq('id', id)

  if (error) {
    console.error(error)
    setMensaje('Error al eliminar el partido.')
    return
  }

  setMensaje('Partido eliminado correctamente.')
  await cargarPartidosJornada(jornadaId)
}
async function guardarPartido() {
  setMensaje('')

  if (!divisionId || !jornadaId || !localId || !visitanteId || !fecha) {
    setMensaje('Completa todos los campos.')
    return
  }

  if (localId === visitanteId) {
    setMensaje('El equipo local y visitante no pueden ser el mismo.')
    return
  }
  const conflicto = partidosJornada.find((partido) => {
  const mismoPartido =
    partidoEditandoId &&
    String(partido.id) === String(partidoEditandoId)

  const mismaFecha = partido.fecha === fecha
const mismaHora =
  hora && partido.hora &&
  String(partido.hora).slice(0, 5) === String(hora).slice(0, 5)

const mismoCampo =
  campoId && partido.campo_id &&
  Number(partido.campo_id) === Number(campoId)

return !mismoPartido && mismaFecha && mismaHora && mismoCampo
})

if (conflicto) {
  setMensaje('Ya existe otro partido en este campo, fecha y hora.')
  return
}

  const equipoOcupado = partidosJornada.find((partido) => {
  const mismoPartido =
    partidoEditandoId &&
    String(partido.id) === String(partidoEditandoId)

  return (
    !mismoPartido &&
    (
      Number(partido.local_id) === Number(localId) ||
      Number(partido.visitante_id) === Number(localId) ||
      Number(partido.local_id) === Number(visitanteId) ||
      Number(partido.visitante_id) === Number(visitanteId)
    )
  )
})

if (equipoOcupado) {
  setMensaje('Uno de estos equipos ya tiene un partido en esta jornada.')
  return
}

  setGuardando(true)

  let error

if (partidoEditandoId) {
  const resultado = await supabase
    .from('partidos')
    .update({
      jornada_id: Number(jornadaId),
      local_id: Number(localId),
      visitante_id: Number(visitanteId),
      campo_id: campoId ? Number(campoId) : null,
fecha: fecha,
hora: hora || null
    })
    .eq('id', Number(partidoEditandoId))

  error = resultado.error
} else {
  const resultado = await supabase
    .from('partidos')
    .insert({
      jornada_id: Number(jornadaId),
      local_id: Number(localId),
      visitante_id: Number(visitanteId),
      campo_id: campoId ? Number(campoId) : null,
fecha: fecha,
hora: hora || null,
estado: 'programado'
    })

  error = resultado.error
}

  if (error) {
    console.error(error)
    setMensaje('Error al guardar el partido.')
    setGuardando(false)
    return
  }
await cargarPartidosJornada(jornadaId)
  setMensaje('Partido guardado correctamente.')
  setPartidoEditandoId(null)
    
  setLocalId('')
  setVisitanteId('')
  setCampoId('')
  setFecha('')
  setHora('')
  setGuardando(false)
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
              value={jornadaId}
onChange={(e) => {
  setJornadaId(e.target.value)
  cargarPartidosJornada(e.target.value)
}}
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
              value={localId}
onChange={(e) => setLocalId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '6px'
              }}
            >
              <option value="">
                Seleccionar equipo local
              </option>

              {equipos
  .filter((equipo) => String(equipo.division_id) === String(divisionId))
  .map((equipo) => (
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
              value={visitanteId}
onChange={(e) => setVisitanteId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '6px'
              }}
            >
              <option value="">
                Seleccionar equipo visitante
              </option>

              {equipos
  .filter((equipo) => String(equipo.division_id) === String(divisionId))
  .map((equipo) => (
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
              value={campoId}
onChange={(e) => setCampoId(e.target.value)}
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
value={fecha}
onChange={(e) => setFecha(e.target.value)}
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
value={hora}
onChange={(e) => setHora(e.target.value)}
              style={{
                width: '100%',
                padding: '10px',
                marginTop: '6px'
              }}
            />
          </div>
              <button
  type="button"
  onClick={guardarPartido}
  disabled={guardando}
  style={{
    width: '100%',
    padding: '12px',
    marginTop: '25px',
    fontWeight: 'bold',
    cursor: 'pointer'
  }}
>
  {guardando ? 'Guardando...' : partidoEditandoId ? 'Actualizar partido' : 'Guardar partido'}
</button>

{mensaje && (
  <p style={{ marginTop: '15px', fontWeight: 'bold' }}>
    {mensaje}
  </p>
)}{jornadaId && partidosJornada.length > 0 && (
  <div style={{ marginTop: '25px' }}>
    <h3>Partidos de esta jornada</h3>

    {partidosJornada.map((partido) => {
      const local = equipos.find(
        (equipo) => Number(equipo.id) === Number(partido.local_id)
      )

      const visitante = equipos.find(
        (equipo) => Number(equipo.id) === Number(partido.visitante_id)
      )

      return (
        <div
          key={partido.id}
                         
          style={{
            padding: '10px',
            marginTop: '8px',
            border: '1px solid #ddd',
            borderRadius: '6px'
          }}
        >
          <strong>
            {local?.nombre || 'Equipo local'} vs{' '}
            {visitante?.nombre || 'Equipo visitante'}
          </strong>

          {partido.fecha && (
            <span> — {partido.fecha}</span>
          )}

          {partido.hora && (
            <span> - {new Date(`2000-01-01T${partido.hora}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
          )}
{partido.campo_id && (
  <span>
    {' — '}
    {campos.find((campo) => Number(campo.id) === Number(partido.campo_id))?.nombre || `Campo ${partido.campo_id}`}
  </span>
)}
<button
  type="button"
  onClick={() => editarPartido(partido)}
  style={{ marginLeft: '15px' }}
>
  Editar
</button>

<button
  type="button"
  onClick={() => eliminarPartido(partido.id)}
  style={{ marginLeft: '8px' }}
>
  Eliminar
</button>
        </div>
      )
    })}
  </div>
)}
        </div>
      )}
    </main>
  )
}
