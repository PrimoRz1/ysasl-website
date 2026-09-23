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
  useEffect(() => {
  cargarPartidos()
  cargarJugadores()
    cargarEquipos()
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

setGuardandoId(null)

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

setTarjetas((actual) => {
  const copia = { ...actual }
  delete copia[partido.id]
  return copia
})
    const tarjetasProcesadas = await procesarTarjetas(partido)

if (!tarjetasProcesadas) {
  setMensaje('El resultado se guardó, pero hubo un error al procesar las tarjetas.')
  setGuardandoId(null)
  return
}
    const suspensionesProcesadas = await procesarSuspensiones(partido)

if (!suspensionesProcesadas) {
  setMensaje('El resultado se guardó, pero hubo un error al procesar las suspensiones.')
}
    await cargarPartidos()
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

  // Primero borramos los goles anteriores de este partido
  const { error: errorBorrar } = await supabase
    .from('eventos_partido')
    .delete()
    .eq('partido_id', partido.id)
    .eq('tipo', 'gol')

  if (errorBorrar) {
    console.error(errorBorrar)
    setMensaje('Error al actualizar los goleadores.')
    return false
  }

  // Guardamos los goleadores seleccionados
  if (golesPartido.length > 0) {
    const registros = golesPartido.map((gol) => ({
      partido_id: partido.id,
      jugador_id: Number(gol.jugador_id),
      equipo_id: Number(gol.equipo_id),
      tipo: 'gol'
    }))

    const { error: errorInsertar } = await supabase
      .from('eventos_partido')
      .insert(registros)

    if (errorInsertar) {
      console.error(errorInsertar)
      setMensaje('Error al guardar los goleadores.')
      return false
    }
  }

  return true
}
  async function guardarTarjetas(partido) {
  const tarjetasPartido = tarjetas[partido.id] || []

  // Primero borramos las tarjetas anteriores de este partido
  const { error: errorBorrar } = await supabase
    .from('eventos_partido')
    .delete()
    .eq('partido_id', partido.id)
    .in('tipo', ['amarilla', 'roja'])

  if (errorBorrar) {
    console.error(errorBorrar)
    setMensaje('Error al actualizar las tarjetas.')
    return false
  }

  // Guardamos las tarjetas seleccionadas
  if (tarjetasPartido.length > 0) {
    const registros = tarjetasPartido
      .filter((tarjeta) => tarjeta.jugador_id)
      .map((tarjeta) => ({
        partido_id: partido.id,
        jugador_id: Number(tarjeta.jugador_id),
        equipo_id: Number(tarjeta.equipo_id),
        tipo: tarjeta.tipo,
      }))

    if (registros.length > 0) {
      const { error: errorInsertar } = await supabase
        .from('eventos_partido')
        .insert(registros)

      if (errorInsertar) {
        console.error(errorInsertar)
        setMensaje('Error al guardar las tarjetas.')
        return false
      }
    }
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
