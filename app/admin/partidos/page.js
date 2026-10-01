'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AdminPartidosPage() {
  const router = useRouter()

  const [temporadas, setTemporadas] = useState([])
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
  const [inscripciones, setInscripciones] = useState([])
  const [jornadas, setJornadas] = useState([])
  const [campos, setCampos] = useState([])
const [partidosJornada, setPartidosJornada] = useState([])
  const [partidoEditandoId, setPartidoEditandoId] = useState(null)
  const [divisionId, setDivisionId] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [camposSeleccionados, setCamposSeleccionados] = useState([])
const [horariosSeleccionados, setHorariosSeleccionados] = useState(['09:00', '11:00', '13:00', '15:00'])

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setCargando(true)
    setError('')

    const [
      { data: temporadasData, error: temporadasError },
      { data: divisionesData, error: divisionesError },
      { data: equiposData, error: equiposError },
      { data: inscripcionesData, error: inscripcionesError },
      { data: jornadasData, error: jornadasError },
      { data: camposData, error: camposError }
    ] = await Promise.all([
      supabase
  .from('temporadas')
  .select('id, nombre, activa')
  .order('id'),  
      supabase
  .from('divisiones')
        .select('*')
        .order('id'),

      supabase
        .from('equipos')
        .select('id, nombre, division_id')
        .order('nombre'),
      supabase
  .from('inscripciones_equipo')
  .select('equipo_id, division_id, activo')
  .eq('activo', true),

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
      temporadasError ||
      divisionesError ||
      equiposError ||
      inscripcionesError ||
      jornadasError ||
      camposError
    ) {
      console.error({
        temporadasError,
        divisionesError,
        equiposError,
        jornadasError,
        camposError
      })

      setError('No se pudieron cargar los datos.')
      setCargando(false)
      return
    }

    setTemporadas(temporadasData || [])
    setDivisiones(divisionesData || [])
    setEquipos(equiposData || [])
    setInscripciones(inscripcionesData || [])
    setJornadas(jornadasData || [])
    setCampos(camposData || [])
    setCamposSeleccionados((camposData || []).map((campo) => Number(campo.id)))

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
  async function generarHorariosCampos() {
  setMensaje('')

  if (!jornadaId) {
    setMensaje('Selecciona una jornada.')
    return
  }

  const partidosPendientes = partidosJornada.filter(
    (partido) => !partido.hora || !partido.campo_id
  )

  if (partidosPendientes.length === 0) {
    setMensaje('Todos los partidos de esta jornada ya tienen hora y campo.')
    return
  }

  if (camposSeleccionados.length === 0) {
    setMensaje('No hay campos activos disponibles.')
    return
  }
const espaciosOcupados = partidosJornada
  .filter((partido) => partido.hora && partido.campo_id)
  .map((partido) => ({
    hora: partido.hora.substring(0, 5),
    campo_id: Number(partido.campo_id)
  }))
  
    
    
    
    
    
    
    
    const horarios = horariosSeleccionados
    const espaciosDisponibles = []
    if (horariosSeleccionados.length === 0) {
  setMensaje('Selecciona por lo menos un horario.')
  return
}

horarios.forEach((horaDisponible) => {
  campos
  .filter((campo) => camposSeleccionados.includes(Number(campo.id)))
  .forEach((campo) => {
   const ocupado = espaciosOcupados.some(
  (espacio) =>
    espacio.hora === horaDisponible &&
    espacio.campo_id === Number(campo.id)
)

if (ocupado) return
    espaciosDisponibles.push({
      hora: horaDisponible,
      campo_id: campo.id
    })
  })
})
   if (espaciosDisponibles.length < partidosPendientes.length) {
  setMensaje(
    `No hay suficientes espacios. Hay ${partidosPendientes.length} partidos y solamente ${espaciosDisponibles.length} combinaciones de campo y horario disponibles.`
  )
  return
}
    const asignaciones = partidosPendientes.map((partido, index) => {
  const espacio = espaciosDisponibles[index]

  return {
    id: partido.id,
    hora: espacio.hora,
    campo_id: espacio.campo_id
  }
})
    for (const asignacion of asignaciones) {
  if (!asignacion.hora || !asignacion.campo_id) continue

  const { error } = await supabase
    .from('partidos')
    .update({
      hora: asignacion.hora,
      campo_id: asignacion.campo_id
    })
    .eq('id', asignacion.id)

  if (error) {
    console.error(error)
    setMensaje('Error al generar horarios y campos.')
    return
  }
}
    await cargarPartidosJornada(jornadaId)

setMensaje('Horarios y campos generados correctamente.')

}
  async function generarCalendarioAutomatico() {
  setMensaje('')

  if (!divisionId) {
    setMensaje('Selecciona una división.')
    return
  }

  const equiposDivision = inscripciones
    .filter(
      (inscripcion) =>
        Number(inscripcion.division_id) === Number(divisionId) &&
        inscripcion.activo
    )
    .map((inscripcion) =>
      equipos.find(
        (equipo) => Number(equipo.id) === Number(inscripcion.equipo_id)
      )
    )
    .filter(Boolean)

  if (equiposDivision.length < 2) {
    setMensaje('Se necesitan por lo menos 2 equipos para generar el calendario.')
    return
  }

  const divisionSeleccionada = divisiones.find(
    (division) => Number(division.id) === Number(divisionId)
  )

  const temporadaSeleccionada = temporadas.find(
    (temporada) =>
      Number(temporada.id) === Number(divisionSeleccionada?.temporada_id)
  )

  if (!temporadaSeleccionada?.fecha_inicio) {
    setMensaje('El torneo necesita una fecha de inicio.')
    return
  }

  const confirmar = window.confirm(
    `Se generará automáticamente el calendario para ${equiposDivision.length} equipos. ¿Continuar?`
  )

  if (!confirmar) return

  setGuardando(true)

  try {
    let listaEquipos = equiposDivision.map((equipo) => equipo.id)

    // Si hay número impar de equipos, agregamos un descanso.
    if (listaEquipos.length % 2 !== 0) {
      listaEquipos.push(null)
    }

    const totalEquipos = listaEquipos.length
    const totalJornadas = totalEquipos - 1
    const partidosPorJornada = totalEquipos / 2

    let rotacion = [...listaEquipos]

    const fechaInicial = new Date(
      `${temporadaSeleccionada.fecha_inicio}T12:00:00`
    )

    // Llevar la primera fecha al siguiente domingo.
    const diasHastaDomingo = (7 - fechaInicial.getDay()) % 7
    fechaInicial.setDate(fechaInicial.getDate() + diasHastaDomingo)

    for (let numeroJornada = 1; numeroJornada <= totalJornadas; numeroJornada++) {
      const fechaJornada = new Date(fechaInicial)
      fechaJornada.setDate(
        fechaInicial.getDate() + (numeroJornada - 1) * 7
      )

      const fechaTexto = [
        fechaJornada.getFullYear(),
        String(fechaJornada.getMonth() + 1).padStart(2, '0'),
        String(fechaJornada.getDate()).padStart(2, '0'),
      ].join('-')

      const { data: jornadaCreada, error: jornadaError } = await supabase
        .from('jornadas')
        .insert({
          division_id: Number(divisionId),
          numero: numeroJornada,
          fecha: fechaTexto,
        })
        .select('id')
        .single()

      if (jornadaError) throw jornadaError

      const partidos = []

      for (let i = 0; i < partidosPorJornada; i++) {
        const local = rotacion[i]
        const visitante = rotacion[totalEquipos - 1 - i]

        // null representa descanso.
        if (local && visitante) {
          partidos.push({
            jornada_id: jornadaCreada.id,
            local_id: local,
            visitante_id: visitante,
            fecha: fechaTexto,
            hora: null,
            campo_id: null,
            estado: 'programado',
          })
        }
      }

      if (partidos.length > 0) {
        const { error: partidosError } = await supabase
          .from('partidos')
          .insert(partidos)

        if (partidosError) throw partidosError
      }

      // Método round-robin: dejamos fijo el primer equipo.
      const fijo = rotacion[0]
      const resto = rotacion.slice(1)
      resto.unshift(resto.pop())
      rotacion = [fijo, ...resto]
    }

    setMensaje(
      `Calendario generado correctamente: ${totalJornadas} jornadas creadas.`
    )

    await cargarDatos()
  } catch (error) {
    console.error(error)
    setMensaje(`Error al generar calendario: ${error.message}`)
  } finally {
    setGuardando(false)
  }
}
async function generarHorariosCampos() {
  setMensaje('')

  if (!jornadaId) {
    setMensaje('Selecciona una jornada.')
    return
  }

  const pendientes = partidosJornada.filter(
    (partido) => !partido.hora || !partido.campo_id
  )

  if (pendientes.length === 0) {
    setMensaje('Todos los partidos de esta jornada ya tienen hora y campo.')
    return
  }

  const espacios = []

  horariosSeleccionados.forEach((horaDisponible) => {
    camposSeleccionados.forEach((campoIdDisponible) => {
      espacios.push({
        hora: horaDisponible,
        campo_id: Number(campoIdDisponible)
      })
    })
  })

  if (espacios.length < pendientes.length) {
    setMensaje(
      `No hay suficientes espacios. Hay ${pendientes.length} partidos y solamente ${espacios.length} espacios disponibles.`
    )
    return
  }

  setGuardando(true)

  try {
    for (let i = 0; i < pendientes.length; i++) {
      const partido = pendientes[i]
      const espacio = espacios[i]

      const { error } = await supabase
        .from('partidos')
        .update({
          hora: espacio.hora,
          campo_id: espacio.campo_id
        })
        .eq('id', partido.id)

      if (error) throw error
    }

    await cargarPartidosJornada(jornadaId)
    setMensaje('Horarios y campos generados correctamente.')
  } catch (error) {
    console.error(error)
    setMensaje(`Error al generar horarios y campos: ${error.message}`)
  } finally {
    setGuardando(false)
  }
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
<div style={{ marginBottom: '25px' }}>
  <button
    type="button"
    onClick={generarCalendarioCompleto}
    disabled={guardando || !divisionId}
    style={{
      padding: '10px 16px',
      fontWeight: 'bold',
      cursor: 'pointer'
    }}
  >
    {guardando ? 'Generando...' : '⚽ Generar calendario automático'}
  </button>

  <div style={{ marginTop: '6px', fontSize: '14px' }}>
    Crea automáticamente todas las jornadas y enfrentamientos de la división seleccionada.
  </div>
</div>

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
                  {`${temporadas.find(
  (temporada) => Number(temporada.id) === Number(division.temporada_id)
)?.nombre || 'Sin temporada'} — ${division.nombre}`}
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
  .filter((equipo) =>
  inscripciones.some(
    (inscripcion) =>
      Number(inscripcion.equipo_id) === Number(equipo.id) &&
      Number(inscripcion.division_id) === Number(divisionId)
  )
)
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
  .filter((equipo) =>
  inscripciones.some(
    (inscripcion) =>
      Number(inscripcion.equipo_id) === Number(equipo.id) &&
      Number(inscripcion.division_id) === Number(divisionId)
  )
)
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
)}
  <div style={{ marginTop: '20px', marginBottom: '10px' }}>
  <strong>Horarios disponibles:</strong>

  {['09:00', '11:00', '13:00', '15:00'].map((horario) => (
    <label key={horario} style={{ marginLeft: '15px' }}>
      <input
        type="checkbox"
        checked={horariosSeleccionados.includes(horario)}
        onChange={(e) => {
          if (e.target.checked) {
            setHorariosSeleccionados([...horariosSeleccionados, horario])
          } else {
            setHorariosSeleccionados(
              horariosSeleccionados.filter((h) => h !== horario)
            )
          }
        }}
      />
      {' '}
      {horario === '09:00'
        ? '9:00 AM'
        : horario === '11:00'
        ? '11:00 AM'
        : horario === '13:00'
        ? '1:00 PM'
        : '3:00 PM'}
    </label>
  ))}
</div>
<div style={{ marginTop: '10px', marginBottom: '10px' }}>
  <strong>Campos disponibles:</strong>

  {campos.map((campo) => (
    <label key={campo.id} style={{ marginLeft: '15px' }}>
      <input
        type="checkbox"
        checked={camposSeleccionados.includes(Number(campo.id))}
        onChange={(e) => {
          const campoId = Number(campo.id)

          if (e.target.checked) {
            setCamposSeleccionados([...camposSeleccionados, campoId])
          } else {
            setCamposSeleccionados(
              camposSeleccionados.filter((id) => id !== campoId)
            )
          }
        }}
      />
      {' '}
      Campo {campo.numero}
    </label>
  ))}
</div>
{jornadaId && partidosJornada.length > 0 && (
  <button
    type="button"
    onClick={generarHorariosCampos}
    style={{
      width: '100%',
      padding: '12px',
      marginTop: '15px',
      fontWeight: 'bold',
      cursor: 'pointer'
    }}
  >
    Generar horarios y campos
  </button>
)}
{jornadaId && partidosJornada.length > 0 && (
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
