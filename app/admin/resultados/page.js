'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function AdminResultadosPage() {
  const [partidos, setPartidos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [mensaje, setMensaje] = useState('')
  const [guardandoId, setGuardandoId] = useState(null)
  const [goles, setGoles] = useState({})
const [jugadores, setJugadores] = useState([])
  const [equipos, setEquipos] = useState([])
const [goleadores, setGoleadores] = useState({})
  const [tarjetas, setTarjetas] = useState({})
  const [divisiones, setDivisiones] = useState([])
const [divisionId, setDivisionId] = useState('')
const [jornadas, setJornadas] = useState([])
const [jornadaId, setJornadaId] = useState('')
  const [faseVista, setFaseVista] = useState('todas')
  useEffect(() => {
  cargarPartidos()
  cargarJugadores()
    cargarEquipos()
    cargarDivisiones()
}, [])

  async function cargarPartidos() {
    setCargando(true)
    setMensaje('')

    const { data, error } = await supabase
      .from('calendario_partidos')
      .select('*')
      .order('fecha', { ascending: false, nullsFirst: false })
      .order('hora', { ascending: true })

    if (error) {
      console.error(error)
      setMensaje('Error al cargar los partidos.')
      setPartidos([])
    } else {
      // La vista calendario_partidos puede no incluir la columna fase.
      // Consultar SOLO LECTURA en partidos para mostrar la fase oficial,
      // sin modificar los resultados, tarjetas ni eventos de los encuentros.
      const partidosVista = data || []
      const fasesPorId = new Map()
      let errorFases = null

      // Consultas pequeñas para no exceder los límites de la API.
      for (let inicio = 0; inicio < partidosVista.length; inicio += 200) {
        const ids = partidosVista.slice(inicio, inicio + 200).map((p) => p.id)
        const respuesta = await supabase
          .from('partidos')
          .select('id,fase')
          .in('id', ids)

        if (respuesta.error) {
          errorFases = respuesta.error
          break
        }
        for (const fila of respuesta.data || []) {
          fasesPorId.set(Number(fila.id), fila.fase)
        }
      }

      if (errorFases) {
        console.error('Error al consultar fases oficiales:', errorFases)
        setMensaje('No se pudieron consultar las fases oficiales. Los resultados siguen disponibles, pero algunas etiquetas pueden mostrar Jornada.')
      }

      const partidosConFase = partidosVista.map((partido) => ({
        ...partido,
        fase: fasesPorId.get(Number(partido.id)) ?? partido.fase ?? null,
      }))

      setPartidos(partidosConFase)
      setGoles(
        Object.fromEntries(
          partidosConFase.map((partido) => [
            partido.id,
            {
              local: partido.goles_local ?? '',
              visitante: partido.goles_visitante ?? '',
            },
          ])
        )
      )
    }

    setCargando(false)
  }

  async function cargarDivisiones() {
  // Solo lectura: agregar el nombre del torneo a cada división.
  const [respuestaDivisiones, respuestaTemporadas] = await Promise.all([
    supabase
      .from('divisiones')
      .select('id, nombre, temporada_id')
      .order('orden', { ascending: true }),
    supabase
      .from('temporadas')
      .select('id, nombre'),
  ])

  if (respuestaDivisiones.error || respuestaTemporadas.error) {
    console.error(respuestaDivisiones.error || respuestaTemporadas.error)
    setMensaje('Error al cargar los torneos y divisiones.')
    return
  }

  const nombresTemporadas = new Map(
    (respuestaTemporadas.data || []).map((temporada) => [
      Number(temporada.id),
      temporada.nombre,
    ])
  )

  setDivisiones(
    (respuestaDivisiones.data || []).map((division) => ({
      ...division,
      nombreTorneo:
        nombresTemporadas.get(Number(division.temporada_id)) ||
        `Torneo ${division.temporada_id}`,
    }))
  )
}

  async function cargarJugadores() {
  const { data, error } = await supabase
    .from('jugadores')
    .select('id, equipo_id, nombre, numero')
    .eq('activo', true)
    .order('nombre', { ascending: true })

  if (error) {
    console.error(error)
    return
  }

  setJugadores(data || [])
}
  async function cargarEquipos() {
  const { data, error } = await supabase
    .from('equipos')
    .select('id, nombre')
    .eq('activo', true)

  if (error) {
    console.error(error)
    return
  }

  setEquipos(data || [])
}

  async function cargarJornadas(division) {
  if (!division) {
    setJornadas([])
    setJornadaId('')
    return
  }

  const { data, error } = await supabase
    .from('jornadas')
    .select('id, numero, fecha')
    .eq('division_id', division)
    .order('numero', { ascending: false })

  if (error) {
    console.error(error)
    setJornadas([])
    return
  }

  setJornadas(data || [])
  setJornadaId('')
}

  // Etiquetas basadas en la fase REAL guardada en partidos.fase.
  // No inferir liguilla por numero de jornada: cada temporada puede variar.
  function nombreFase(faseOriginal) {
    const fase = String(faseOriginal || '').toLowerCase()
    if (fase === 'repechaje' || fase.includes('reclas')) return 'Reclasificación'
    if (fase.includes('cuartos')) return 'Cuartos de final'
    if (fase.includes('semifinal')) return 'Semifinales'
    if (fase.includes('tercer')) return 'Tercer lugar'
    if (fase === 'final') return 'Gran final'
    return null
  }

  function esLiguilla(partido) {
    return Boolean(nombreFase(partido.fase)) ||
      String(partido.fase || '').toLowerCase() === 'liguilla'
  }

  function etiquetaPartido(partido) {
    const fase = nombreFase(partido.fase)
    if (fase) return fase
    if (esLiguilla(partido)) return `Liguilla — Jornada ${partido.jornada}`
    return `Jornada ${partido.jornada}`
  }

  function etiquetaJornada(numero, divisionSeleccionada) {
    // Mostrar el nombre de fase si los partidos de esta jornada coinciden.
    // Las jornadas de fase regular conservan su número original.
    const fases = new Set(
      partidos
        .filter((partido) =>
          Number(partido.division_id) === Number(divisionSeleccionada) &&
          Number(partido.jornada) === Number(numero)
        )
        .map((partido) => nombreFase(partido.fase) || 'regular')
    )
    return fases.size === 1 && !fases.has('regular')
      ? [...fases][0]
      : `Jornada ${numero}`
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

const goleadoresGuardados = await guardarGoleadores(partido)

if (!goleadoresGuardados) {
  setGuardandoId(null)
  return
}

    setGoles((actual) => {
      const copia = { ...actual }
      delete copia[partido.id]
      return copia
    })
const tarjetasGuardadas = await guardarTarjetas(partido)

if (!tarjetasGuardadas) {
  setGuardandoId(null)
  return
}

    const tarjetasProcesadas = await procesarTarjetas(partido)

if (!tarjetasProcesadas) {
  setMensaje('El resultado y las tarjetas se guardaron, pero hubo un error al procesar las suspensiones. No vuelvas a guardar esas tarjetas: revisa los registros.')
  setTarjetas((actual) => {
    const copia = { ...actual }
    delete copia[partido.id]
    return copia
  })
  setGuardandoId(null)
  return
}

setTarjetas((actual) => {
  const copia = { ...actual }
  delete copia[partido.id]
  return copia
})
    const suspensionesProcesadas = await procesarSuspensiones(partido)

if (!suspensionesProcesadas) {
  setMensaje('El resultado se guardó, pero hubo un error al procesar las suspensiones.')
}
    await cargarPartidos()
    setGuardandoId(null)
  }

async function procesarSuspensiones(partido) {
  // Buscar jugadores de los dos equipos que jugaron este partido
  const { data: jugadoresPartido, error: jugadoresError } = await supabase
    .from('jugadores')
    .select('id, equipo_id')
    .in('equipo_id', [partido.local_id, partido.visitante_id])

  if (jugadoresError) {
    console.error('Error al buscar jugadores para suspensiones:', jugadoresError)
    return false
  }

  if (!jugadoresPartido || jugadoresPartido.length === 0) {
    return true
  }

  const jugadoresIds = jugadoresPartido.map((jugador) => jugador.id)

  // Buscar suspensiones activas de esos jugadores
  const { data: suspensiones, error: suspensionesError } = await supabase
    .from('suspensiones')
    .select('id, jugador_id, partidos_suspension, partidos_cumplidos, activa, fecha')
    .in('jugador_id', jugadoresIds)
    .eq('activa', true)

  if (suspensionesError) {
    console.error('Error al buscar suspensiones:', suspensionesError)
    return false
  }

  if (!suspensiones || suspensiones.length === 0) {
    return true
  }

  for (const suspension of suspensiones) {
    const jugador = jugadoresPartido.find(
      (j) => j.id === suspension.jugador_id
    )

    if (!jugador) continue
    // No contar partidos anteriores a la fecha de la suspensión
if (suspension.fecha && partido.fecha && partido.fecha < suspension.fecha) {
  continue
}

    // Verificar que este partido no haya contado antes para este jugador
    const { data: eventoExistente, error: eventoError } = await supabase
      .from('eventos_partido')
      .select('id')
      .eq('partido_id', partido.id)
      .eq('jugador_id', suspension.jugador_id)
      .eq('tipo', 'suspension_cumplida')
      .maybeSingle()

    if (eventoError) {
      console.error('Error al verificar suspensión:', eventoError)
      return false
    }

    if (eventoExistente) continue

    const nuevosCumplidos = Number(suspension.partidos_cumplidos || 0) + 1
    const suspensionTerminada =
      nuevosCumplidos >= Number(suspension.partidos_suspension)

    const { error: actualizarError } = await supabase
      .from('suspensiones')
      .update({
        partidos_cumplidos: nuevosCumplidos,
        activa: !suspensionTerminada,
      })
      .eq('id', suspension.id)

    if (actualizarError) {
      console.error('Error al actualizar suspensión:', actualizarError)
      return false
    }

    const { error: registrarError } = await supabase
      .from('eventos_partido')
      .insert({
        partido_id: partido.id,
        jugador_id: suspension.jugador_id,
        equipo_id: jugador.equipo_id,
        tipo: 'suspension_cumplida',
      })

    if (registrarError) {
      console.error('Error al registrar partido de suspensión:', registrarError)
      return false
    }
  }

  return true
}  
async function guardarGoleadores(partido) {
  const golesPartido = goleadores[partido.id] || []

  // NO borrar goleadores históricos al volver a guardar el marcador.
  // Los jugadores seleccionados aquí se agregan como eventos nuevos.
  if (golesPartido.length === 0) return true

  if (golesPartido.some((gol) => !gol.jugador_id || !gol.equipo_id)) {
    setMensaje('Selecciona un jugador para cada gol agregado.')
    return false
  }

  const registros = golesPartido.map((gol) => ({
    partido_id: partido.id,
    jugador_id: Number(gol.jugador_id),
    equipo_id: Number(gol.equipo_id),
    tipo: 'gol',
  }))

  const { error } = await supabase
    .from('eventos_partido')
    .insert(registros)

  if (error) {
    console.error(error)
    setMensaje('Error al agregar los goleadores.')
    return false
  }

  // Evita repetir el mismo lote si después se guarda el marcador otra vez.
  setGoleadores((actual) => {
    const copia = { ...actual }
    delete copia[partido.id]
    return copia
  })
  return true
}

  async function guardarTarjetas(partido) {
    const tarjetasPartido = tarjetas[partido.id] || []

    // NO borrar tarjetas históricas al guardar un resultado.
    if (tarjetasPartido.length === 0) return true

    if (tarjetasPartido.some((tarjeta) => !tarjeta.jugador_id || !tarjeta.equipo_id)) {
      setMensaje('Selecciona un jugador para cada tarjeta agregada.')
      return false
    }

    const registros = tarjetasPartido.map((tarjeta) => ({
      partido_id: partido.id,
      jugador_id: Number(tarjeta.jugador_id),
      equipo_id: Number(tarjeta.equipo_id),
      tipo: tarjeta.tipo,
    }))

    const { error } = await supabase
      .from('eventos_partido')
      .insert(registros)

    if (error) {
      console.error(error)
      setMensaje('Error al agregar las tarjetas.')
      return false
    }

    return true
  }
  async function procesarTarjetas(partido) {
  const tarjetasPartido = (tarjetas[partido.id] || []).filter(
    (tarjeta) => tarjeta.jugador_id
  )

  const tarjetasRojas = tarjetasPartido.filter(
    (tarjeta) => tarjeta.tipo === 'roja'
  )

  for (const tarjeta of tarjetasRojas) {
    const { data: suspensionExistente, error: verificarError } = await supabase
  .from('suspensiones')
  .select('id')
  .eq('jugador_id', Number(tarjeta.jugador_id))
  .eq('motivo', 'tarjeta roja')
  .eq('fecha', partido.fecha)
  .maybeSingle()

if (verificarError) {
  console.error('Error al verificar suspensión por tarjeta roja:', verificarError)
  return false
}

if (suspensionExistente) {
  continue
}
    const { error } = await supabase
      .from('suspensiones')
      .insert({
        jugador_id: Number(tarjeta.jugador_id),
        motivo: 'tarjeta roja',
        partidos_suspension: 1,
        partidos_cumplidos: 0,
        activa: true,
        fecha: partido.fecha,
      })

    if (error) {
      console.error('Error al crear suspensión por tarjeta roja:', error)
      return false
    }
  }
// Revisar acumulacion de 3 tarjetas amarillas
const tarjetasAmarillas = tarjetasPartido.filter(
  (tarjeta) => tarjeta.tipo === 'amarilla'
)

for (const tarjeta of tarjetasAmarillas) {
  const { count, error } = await supabase
    .from('eventos_partido')
    .select('*', { count: 'exact', head: true })
    .eq('jugador_id', Number(tarjeta.jugador_id))
    .eq('tipo', 'amarilla')

  if (error) {
    console.error('Error al contar tarjetas amarillas:', error)
    return false
  }

  if (count > 0 && count % 3 === 0) {
    const { data: suspensionAmarillasExistente, error: verificarAmarillasError } = await supabase
  .from('suspensiones')
  .select('id')
  .eq('jugador_id', Number(tarjeta.jugador_id))
  .eq('motivo', '3 tarjetas amarillas')
  .eq('fecha', partido.fecha)
  .maybeSingle()

if (verificarAmarillasError) {
  console.error('Error al verificar suspensión por amarillas:', verificarAmarillasError)
  return false
}

if (suspensionAmarillasExistente) {
  continue
}
    const { error: suspensionError } = await supabase
      .from('suspensiones')
      .insert({
        jugador_id: Number(tarjeta.jugador_id),
        motivo: '3 tarjetas amarillas',
        partidos_suspension: 1,
        partidos_cumplidos: 0,
        activa: true,
        fecha: partido.fecha,
      })

    if (suspensionError) {
      console.error(
        'Error al crear suspensión por acumulación de amarillas:',
        suspensionError
      )
      return false
    }
  }
}
  return true
}
function agregarGoleador(partido, equipoId) {
  setGoleadores((actual) => {
    const lista = actual[partido.id] || []

    return {
      ...actual,
      [partido.id]: [
        ...lista,
        {
          jugador_id: '',
          equipo_id: equipoId,
        },
      ],
    }
  })
}
  function agregarTarjeta(partido, equipoId, tipo) {
  setTarjetas((actual) => {
    const lista = actual[partido.id] || []

    return {
      ...actual,
      [partido.id]: [
        ...lista,
        {
          jugador_id: '',
          equipo_id: equipoId,
          tipo: tipo,
        },
      ],
    }
  })
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
      
<div style={{ marginBottom: '25px' }}>
  <button
    type="button"
    onClick={() => window.location.href = '/admin/jugadores'}
    style={{ padding: '10px 15px', marginRight: '10px', cursor: 'pointer' }}
  >
    ← Volver a Jugadores
  </button>

  <button
    type="button"
    onClick={() => window.location.href = '/admin/disciplina'}
    style={{ padding: '10px 15px', cursor: 'pointer' }}
  >
    Continuar a Disciplina →
  </button>
</div>

      <h1>Administrar resultados</h1>

      <p>
        Captura el marcador final de los partidos.
      </p>

<div style={{ marginTop: '20px', marginBottom: '25px' }}>
  <label>
    <strong>División:</strong>
  </label>

  <select
    value={divisionId}
    onChange={(e) => {
      const valor = e.target.value
      setDivisionId(valor)
      cargarJornadas(valor)
    }}
    style={{ marginLeft: '10px', marginRight: '25px' }}
  >
    <option value="">Seleccionar división</option>
    {divisiones.map((division) => (
      <option key={division.id} value={division.id}>
        {division.nombreTorneo} — {division.nombre}
      </option>
    ))}
  </select>

  <label>
    <strong>Fase:</strong>
  </label>
  <select
    value={faseVista}
    onChange={(e) => setFaseVista(e.target.value)}
    style={{ marginLeft: '10px', marginRight: '25px' }}
  >
    <option value="todas">Todas</option>
    <option value="regular">Temporada regular</option>
    <option value="liguilla">Liguilla</option>
  </select>

  <label>
    <strong>Jornada:</strong>
  </label>

  <select
    value={jornadaId}
    onChange={(e) => setJornadaId(e.target.value)}
    disabled={!divisionId}
    style={{ marginLeft: '10px' }}
  >
    <option value="">Seleccionar jornada</option>
    {jornadas.map((jornada) => (
      <option key={jornada.id} value={jornada.id}>
        {etiquetaJornada(jornada.numero, divisionId)}
        {jornada.fecha ? ` — ${jornada.fecha}` : ''}
      </option>
    ))}
  </select>
</div>

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
          {partidos
  .filter((partido) => {
    if (divisionId && Number(partido.division_id) !== Number(divisionId)) {
      return false
    }

    if (faseVista === 'liguilla' && !esLiguilla(partido)) return false
    if (faseVista === 'regular' && esLiguilla(partido)) return false

    if (jornadaId) {
  const jornadaSeleccionada = jornadas.find(
    (jornada) => Number(jornada.id) === Number(jornadaId)
  )

  if (
    jornadaSeleccionada &&
    Number(partido.jornada) !== Number(jornadaSeleccionada.numero)
  ) {
    return false
  }
}

    return true
  })
  .map((partido) => (
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
                {etiquetaPartido(partido)}
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

                <div style={{ marginTop: '15px', marginBottom: '15px' }}>
  <strong>Goleadores:</strong>

  <div style={{ marginTop: '8px' }}>
    <button
      type="button"
      onClick={() => agregarGoleador(partido, equipos.find(e => e.nombre === partido.local)?.id)}
    >
      + Gol {partido.local}
    </button>

    <button
      type="button"
      onClick={() => agregarGoleador(partido, equipos.find(e => e.nombre === partido.visitante)?.id)}
      style={{ marginLeft: '10px' }}
    >
      + Gol {partido.visitante}
    </button>
      <button
  type="button"
  onClick={() => agregarTarjeta(partido, equipos.find(e => e.nombre === partido.local)?.id, 'amarilla')}
  style={{ marginLeft: '10px' }}
>
  🟨 Amarilla {partido.local}
</button>

<button
  type="button"
  onClick={() => agregarTarjeta(partido, equipos.find(e => e.nombre === partido.local)?.id, 'roja')}
  style={{ marginLeft: '10px' }}
>
  🟥 Roja {partido.local}
</button>

<button
  type="button"
  onClick={() => agregarTarjeta(partido, equipos.find(e => e.nombre === partido.visitante)?.id, 'amarilla')}
  style={{ marginLeft: '10px' }}
>
  🟨 Amarilla {partido.visitante}
</button>

<button
  type="button"
  onClick={() => agregarTarjeta(partido, equipos.find(e => e.nombre === partido.visitante)?.id, 'roja')}
  style={{ marginLeft: '10px' }}
>
  🟥 Roja {partido.visitante}
</button>
  </div>
{(goleadores[partido.id] || []).map((gol, index) => (
  <div key={index} style={{ marginTop: '8px' }}>
    <select
      value={gol.jugador_id}
      onChange={(e) => {
        const copia = [...(goleadores[partido.id] || [])]
        copia[index] = {
          ...copia[index],
          jugador_id: e.target.value,
        }

        setGoleadores((actual) => ({
          ...actual,
          [partido.id]: copia,
        }))
      }}
    >
      <option value="">Selecciona goleador</option>

      {jugadores
        .filter(
          (jugador) =>
            Number(jugador.equipo_id) === Number(gol.equipo_id)
        )
        .map((jugador) => (
          <option key={jugador.id} value={jugador.id}>
            {jugador.numero ? `#${jugador.numero} - ${jugador.nombre}` : jugador.nombre}
          </option>
        ))}
    </select>
  </div>
))}
  {(tarjetas[partido.id] || []).map((tarjeta, index) => (
  <div key={index} style={{ marginTop: '8px' }}>
    <span>
      {tarjeta.tipo === 'amarilla' ? '🟨 Amarilla' : '🟥 Roja'}:{' '}
    </span>

    <select
      value={tarjeta.jugador_id}
      onChange={(e) => {
        const copia = [...(tarjetas[partido.id] || [])]

        copia[index] = {
          ...copia[index],
          jugador_id: e.target.value,
        }

        setTarjetas((actual) => ({
          ...actual,
          [partido.id]: copia,
        }))
      }}
    >
      <option value="">Selecciona jugador</option>

      {jugadores
        .filter(
          (jugador) =>
            Number(jugador.equipo_id) === Number(tarjeta.equipo_id)
        )
        .map((jugador) => (
          <option key={jugador.id} value={jugador.id}>
            {jugador.numero ? `#${jugador.numero} - ${jugador.nombre}` : jugador.nombre}
          </option>
        ))}
    </select>
  </div>
))}
      
      </div>
                  
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
