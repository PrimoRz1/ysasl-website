
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const boton = { padding: '9px 14px', cursor: 'pointer', margin: '5px' }
const campo = { padding: '9px', margin: '5px', maxWidth: '100%' }
const panel = { border: '1px solid #ddd', borderRadius: '8px', padding: '18px', margin: '20px 0' }

function esDomingo(fecha) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
    new Date(`${fecha}T12:00:00Z`).getUTCDay() === 0
}

function sumarSemana(fecha) {
  const [a, m, d] = fecha.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + 7)).toISOString().slice(0, 10)
}

export default function AdminJornadasPage() {
  const [temporadas, setTemporadas] = useState([])
  const [divisiones, setDivisiones] = useState([])
  const [equipos, setEquipos] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [jornadas, setJornadas] = useState([])
  const [temporadaId, setTemporadaId] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [jornadaId, setJornadaId] = useState('')
  const [numero, setNumero] = useState('')
  const [fechaNueva, setFechaNueva] = useState('')
  const [localId, setLocalId] = useState('')
  const [visitanteId, setVisitanteId] = useState('')
  const [partidos, setPartidos] = useState([])
  const [alcance, setAlcance] = useState('temporada')
  const [desde, setDesde] = useState('')
  const [vistaPrevia, setVistaPrevia] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => { cargarPartidos() }, [jornadaId])

  async function cargarDatos() {
    const resultados = await Promise.all([
      supabase.from('temporadas').select('id,nombre,activa').order('id', { ascending: false }),
      supabase.from('divisiones').select('id,nombre,temporada_id').order('id'),
      supabase.from('equipos').select('id,nombre').order('nombre'),
      supabase.from('inscripciones_equipo').select('equipo_id,division_id,activo').eq('activo', true),
      supabase.from('jornadas').select('id,division_id,numero,fecha').order('numero')
    ])
    const error = resultados.find((r) => r.error)?.error
    if (error) { setMensaje(`Error al cargar: ${error.message}`); return }
    setTemporadas(resultados[0].data || [])
    setDivisiones(resultados[1].data || [])
    setEquipos(resultados[2].data || [])
    setInscripciones(resultados[3].data || [])
    setJornadas(resultados[4].data || [])
  }

  async function cargarPartidos() {
    setPartidos([])
    if (!jornadaId) return
    const { data, error } = await supabase.from('partidos')
      .select('id,jornada_id,local_id,visitante_id,fecha,estado')
      .eq('jornada_id', Number(jornadaId)).order('id')
    if (error) setMensaje(`Error al cargar partidos: ${error.message}`)
    else setPartidos(data || [])
  }

  const divisionesTorneo = divisiones.filter((d) => d.temporada_id === Number(temporadaId))
  const jornadasDivision = jornadas.filter((j) => j.division_id === Number(divisionId))
  const jornadaActual = jornadasDivision.find((j) => j.id === Number(jornadaId))
  const idsEquipos = new Set(inscripciones.filter((i) => i.division_id === Number(divisionId)).map((i) => i.equipo_id))
  const equiposDivision = equipos.filter((e) => idsEquipos.has(e.id))
  const nombreEquipo = (id) => equipos.find((e) => e.id === id)?.nombre || `Equipo ${id}`

  async function crearJornada() {
    const n = Number(numero)
    if (!divisionId || !Number.isInteger(n) || n < 1 || !esDomingo(fechaNueva)) {
      setMensaje('Selecciona una división, un número válido y una fecha que sea domingo.')
      return
    }
    if (jornadasDivision.some((j) => j.numero === n)) {
      setMensaje('Ya existe una jornada con ese número en esta división.')
      return
    }
    if (!window.confirm(`¿Crear Jornada ${n} el ${fechaNueva}?`)) return
    setOcupado(true); setMensaje('')
    try {
      const { data: existente, error: errorConsulta } = await supabase.from('jornadas')
        .select('id').eq('division_id', Number(divisionId)).eq('numero', n).limit(1)
      if (errorConsulta) throw errorConsulta
      if (existente?.length) throw new Error('La jornada ya existe. No se creó otra.')
      const { data, error } = await supabase.from('jornadas')
        .insert({ division_id: Number(divisionId), numero: n, fecha: fechaNueva })
        .select('id').single()
      if (error) throw error
      await cargarDatos()
      setJornadaId(String(data.id))
      setNumero(''); setFechaNueva('')
      setMensaje(`Jornada ${n} creada. Ahora puedes agregar sus partidos.`)
    } catch (e) { setMensaje(`No se pudo crear: ${e.message}`) }
    finally { setOcupado(false) }
  }

  async function agregarPartido() {
    const local = Number(localId), visitante = Number(visitanteId)
    if (!jornadaActual || !localId || !visitanteId || local === visitante ||
        !idsEquipos.has(local) || !idsEquipos.has(visitante)) {
      setMensaje('Selecciona dos equipos distintos de la división y una jornada.')
      return
    }
    setOcupado(true); setMensaje('')
    try {
      const { data: existentes, error: errorConsulta } = await supabase.from('partidos')
        .select('local_id,visitante_id').eq('jornada_id', jornadaActual.id)
      if (errorConsulta) throw errorConsulta
      if ((existentes || []).some((p) => [p.local_id, p.visitante_id].includes(local) ||
          [p.local_id, p.visitante_id].includes(visitante))) {
        throw new Error('Uno de los equipos ya tiene partido en esta jornada.')
      }
      const { error } = await supabase.from('partidos').insert({
        jornada_id: jornadaActual.id, local_id: local, visitante_id: visitante,
        fecha: jornadaActual.fecha, estado: 'programado'
      })
      if (error) throw error
      setLocalId(''); setVisitanteId('')
      await cargarPartidos()
      setMensaje('Partido agregado. Asigna el campo y la hora desde Admin → Partidos.')
    } catch (e) { setMensaje(`No se pudo agregar: ${e.message}`) }
    finally { setOcupado(false) }
  }

  async function prepararReprogramacion() {
    setVistaPrevia(null); setMensaje('')
    if (!temporadaId || !esDomingo(desde) || (alcance === 'division' && !divisionId)) {
      setMensaje('Selecciona el torneo, el alcance y el domingo desde el que deseas mover el calendario.')
      return
    }
    setOcupado(true)
    try {
      const idsDivisiones = divisionesTorneo
        .filter((d) => alcance === 'temporada' || d.id === Number(divisionId))
        .map((d) => d.id)
      if (!idsDivisiones.length) throw new Error('No hay divisiones seleccionadas.')
      const { data: filas, error } = await supabase.from('jornadas')
        .select('id,division_id,numero,fecha')
        .in('division_id', idsDivisiones).gte('fecha', desde).order('fecha')
      if (error) throw error
      if (!filas?.length) throw new Error('No hay jornadas desde esa fecha.')
      const { data: partidosEncontrados, error: errorPartidos } = await supabase.from('partidos')
        .select('id,jornada_id,estado').in('jornada_id', filas.map((j) => j.id))
      if (errorPartidos) throw errorPartidos
      const finalizados = (partidosEncontrados || []).filter((p) => p.estado === 'finalizado')
      if (finalizados.length) {
        throw new Error(`Hay ${finalizados.length} partido(s) finalizado(s) en las jornadas seleccionadas. Elige un domingo posterior; no moveremos resultados.`)
      }
      setVistaPrevia({
        temporadaId: Number(temporadaId), divisionId: alcance === 'division' ? Number(divisionId) : null,
        desde, jornadas: filas.length, partidos: (partidosEncontrados || []).length,
        primera: filas[0].fecha, nueva: sumarSemana(filas[0].fecha)
      })
    } catch (e) { setMensaje(`No se pudo preparar: ${e.message}`) }
    finally { setOcupado(false) }
  }

  async function confirmarReprogramacion() {
    if (!vistaPrevia || ocupado) return
    if (vistaPrevia.temporadaId !== Number(temporadaId) ||
        vistaPrevia.divisionId !== (alcance === 'division' ? Number(divisionId) : null) ||
        vistaPrevia.desde !== desde) {
      setVistaPrevia(null); setMensaje('Cambió la selección. Prepara otra vista previa.'); return
    }
    if (!window.confirm(`¿MOVER ${vistaPrevia.jornadas} jornadas y ${vistaPrevia.partidos} partidos 7 DÍAS?
Los partidos finalizados no se modificarán. Esta acción cambia fechas reales.`)) return
    setOcupado(true); setMensaje('')
    try {
      const { data, error } = await supabase.rpc('ysasl_reprogramar_jornadas', {
        p_temporada_id: vistaPrevia.temporadaId,
        p_division_id: vistaPrevia.divisionId,
        p_desde: vistaPrevia.desde
      })
      if (error) throw error
      setVistaPrevia(null)
      await cargarDatos()
      await cargarPartidos()
      setMensaje(`Calendario reprogramado correctamente. ${JSON.stringify(data)}`)
    } catch (e) {
      setMensaje(`No se reprogramó: ${e.message}. Si dice que la función no existe, falta instalarla en Supabase.`)
    } finally { setOcupado(false) }
  }

  return (
    <main style={{ maxWidth: 950, margin: '30px auto', padding: 20 }}>
      <h1>Administrar Jornadas</h1>
      <p>Crear jornadas y partidos manualmente, o recorrer el calendario una semana.</p>
      <a href="/admin/partidos">← Volver a Admin → Partidos</a>
      <div style={panel}>
        <h2>Seleccionar torneo y división</h2>
        <select style={campo} value={temporadaId} onChange={(e) => {
          setTemporadaId(e.target.value); setDivisionId(''); setJornadaId(''); setVistaPrevia(null)
        }}>
          <option value="">Seleccionar torneo</option>
          {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <select style={campo} value={divisionId} onChange={(e) => {
          setDivisionId(e.target.value); setJornadaId(''); setVistaPrevia(null)
        }}>
          <option value="">Seleccionar división</option>
          {divisionesTorneo.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </div>

      <div style={panel}>
        <h2>1. Crear jornada manual</h2>
        <input style={campo} type="number" min="1" placeholder="Número de jornada" value={numero} onChange={(e) => setNumero(e.target.value)} />
        <input style={campo} type="date" value={fechaNueva} onChange={(e) => setFechaNueva(e.target.value)} />
        <button style={boton} disabled={ocupado} onClick={crearJornada}>+ Crear jornada</button>
        <p>La fecha debe ser domingo. No modifica el calendario automático.</p>
      </div>

      <div style={panel}>
        <h2>2. Agregar partidos a una jornada</h2>
        <select style={campo} value={jornadaId} onChange={(e) => setJornadaId(e.target.value)}>
          <option value="">Seleccionar jornada</option>
          {jornadasDivision.map((j) => <option key={j.id} value={j.id}>Jornada {j.numero} — {j.fecha}</option>)}
        </select>
        <div>
          <select style={campo} value={localId} onChange={(e) => setLocalId(e.target.value)}>
            <option value="">Equipo local</option>
            {equiposDivision.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <select style={campo} value={visitanteId} onChange={(e) => setVisitanteId(e.target.value)}>
            <option value="">Equipo visitante</option>
            {equiposDivision.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </select>
          <button style={boton} disabled={ocupado} onClick={agregarPartido}>+ Agregar partido</button>
        </div>
        {jornadaActual && <p>Partidos registrados: {partidos.length}</p>}
        {partidos.map((p) => <div key={p.id} style={{ padding: 5 }}>
          {nombreEquipo(p.local_id)} vs. {nombreEquipo(p.visitante_id)} — {p.estado || 'programado'}
        </div>)}
        <p>Los campos y horarios se asignan en <a href="/admin/partidos">Admin → Partidos</a>.</p>
      </div>

      <div style={panel}>
        <h2>3. Reprogramar calendario (+7 días)</h2>
        <p>Cuando se suspende un domingo, mueve las jornadas pendientes y sus partidos. Conserva campos, horas y resultados.</p>
        <select style={campo} value={alcance} onChange={(e) => { setAlcance(e.target.value); setVistaPrevia(null) }}>
          <option value="temporada">Todas las divisiones del torneo</option>
          <option value="division">Solo la división seleccionada</option>
        </select>
        <label> Desde el domingo: <input style={campo} type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setVistaPrevia(null) }} /></label>
        <button style={boton} disabled={ocupado} onClick={prepararReprogramacion}>Ver antes de cambiar</button>
        {vistaPrevia && <div style={{ padding: 12, border: '1px solid #aaa', marginTop: 12 }}>
          <p><strong>Vista previa:</strong> {vistaPrevia.jornadas} jornadas y {vistaPrevia.partidos} partidos.</p>
          <p>Primera fecha: {vistaPrevia.primera} → {vistaPrevia.nueva}</p>
          <button style={boton} disabled={ocupado} onClick={confirmarReprogramacion}>Confirmar reprogramación +7 días</button>
          <button style={boton} onClick={() => setVistaPrevia(null)}>Cancelar</button>
        </div>}
        <p><small>La reprogramación requiere una función SQL segura en Supabase. La instalaremos antes de utilizar este botón.</small></p>
      </div>
      {mensaje && <p role="status" style={{ padding: 12, border: '1px solid #ccc' }}><strong>{mensaje}</strong></p>}
    </main>
  )
}
