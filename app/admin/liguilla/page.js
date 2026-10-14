'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

// Primera etapa: vista previa de la liguilla. NO crea ni modifica registros.
// La temporada oficial (id 1) no se muestra ni se consulta para esta función.
const TEMPORADA_PROTEGIDA = 1
const caja = { border: '1px solid #d5dbe2', borderRadius: 10, padding: 18, marginTop: 18 }
const selector = { padding: 10, width: '100%', maxWidth: 580, marginTop: 6 }

function obtenerClasificados(total) {
  if (total >= 10) return 8
  if (total >= 7) return 6
  if (total >= 4) return 4
  return 0
}

function crearTabla(equipos, partidos) {
  const tabla = new Map(equipos.map((equipo) => [Number(equipo.id), {
    id: Number(equipo.id), nombre: equipo.nombre, pj: 0, pg: 0, pe: 0,
    pp: 0, gf: 0, gc: 0, dg: 0, pts: 0,
  }]))

  for (const partido of partidos) {
    if (partido.estado !== 'finalizado') continue
    const local = tabla.get(Number(partido.local_id))
    const visitante = tabla.get(Number(partido.visitante_id))
    if (!local || !visitante || local.id === visitante.id) continue
    if (partido.goles_local == null || partido.goles_visitante == null) continue
    const gl = Number(partido.goles_local)
    const gv = Number(partido.goles_visitante)
    if (!Number.isFinite(gl) || !Number.isFinite(gv)) continue

    local.pj++; visitante.pj++
    local.gf += gl; local.gc += gv
    visitante.gf += gv; visitante.gc += gl
    if (gl > gv) { local.pg++; local.pts += 3; visitante.pp++ }
    else if (gv > gl) { visitante.pg++; visitante.pts += 3; local.pp++ }
    else { local.pe++; visitante.pe++; local.pts++; visitante.pts++ }
  }

  return [...tabla.values()].map((equipo) => ({
    ...equipo, dg: equipo.gf - equipo.gc,
  })).sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf ||
    a.nombre.localeCompare(b.nombre) || a.id - b.id)
}

function crearRondas(tabla, cantidad) {
  const puesto = (numero) => {
    const equipo = tabla[numero - 1]
    return equipo ? `${numero}. ${equipo.nombre}` : `${numero}. Por definir`
  }
  const cierre = [
    { titulo: 'Final', duelos: [['Ganador semifinal 1', 'Ganador semifinal 2']] },
    { titulo: 'Tercer lugar', duelos: [['Perdedor semifinal 1', 'Perdedor semifinal 2']] },
  ]

  if (cantidad === 4) return [
    { titulo: 'Semifinales', duelos: [[puesto(1), puesto(4)], [puesto(2), puesto(3)]] },
    ...cierre,
  ]
  if (cantidad === 6) return [
    { titulo: 'Repechaje', duelos: [[puesto(3), puesto(6)], [puesto(4), puesto(5)]] },
    { titulo: 'Semifinales', duelos: [
      [puesto(1), 'Ganador: 4.º vs 5.º'],
      [puesto(2), 'Ganador: 3.º vs 6.º'],
    ] },
    ...cierre,
  ]
  if (cantidad === 8) return [
    { titulo: 'Cuartos de final', duelos: [
      [puesto(1), puesto(8)], [puesto(4), puesto(5)],
      [puesto(2), puesto(7)], [puesto(3), puesto(6)],
    ] },
    { titulo: 'Semifinales', duelos: [
      ['Ganador: 1.º vs 8.º', 'Ganador: 4.º vs 5.º'],
      ['Ganador: 2.º vs 7.º', 'Ganador: 3.º vs 6.º'],
    ] },
    ...cierre,
  ]
  return []
}

export default function AdminLiguillaPage() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [temporadas, setTemporadas] = useState([])
  const [divisiones, setDivisiones] = useState([])
  const [temporadaId, setTemporadaId] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [equipos, setEquipos] = useState([])
  const [partidos, setPartidos] = useState([])
  const [configuracion, setConfiguracion] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let vigente = true
    async function iniciar() {
      const { data: { user }, error: errorUsuario } = await supabase.auth.getUser()
      if (!vigente) return
      if (errorUsuario || !user) { router.replace('/login'); return }

      const [resTemporadas, resDivisiones] = await Promise.all([
        supabase.from('temporadas').select('id,nombre,activa').neq('id', TEMPORADA_PROTEGIDA).order('id', { ascending: false }),
        supabase.from('divisiones').select('id,nombre,temporada_id').neq('temporada_id', TEMPORADA_PROTEGIDA).order('id'),
      ])
      if (!vigente) return
      if (resTemporadas.error || resDivisiones.error) {
        setError('No se pudieron cargar temporadas y divisiones.')
      } else {
        const lista = resTemporadas.data || []
        setTemporadas(lista)
        setDivisiones(resDivisiones.data || [])
        const prueba = lista.find((t) => Number(t.id) === 9)
        setTemporadaId(String((prueba || lista[0])?.id || ''))
      }
      setVerificando(false)
    }
    iniciar()
    return () => { vigente = false }
  }, [router])

  const divisionesTorneo = useMemo(() => divisiones.filter(
    (division) => Number(division.temporada_id) === Number(temporadaId)
  ), [divisiones, temporadaId])

  useEffect(() => { setDivisionId('') }, [temporadaId])

  useEffect(() => {
    let vigente = true
    async function cargarDivision() {
      setEquipos([])
      setPartidos([])
      setConfiguracion(null)
      setError('')
      if (!divisionId) return
      const division = divisiones.find((d) => Number(d.id) === Number(divisionId))
      if (!division || Number(division.temporada_id) !== Number(temporadaId) ||
          Number(division.temporada_id) === TEMPORADA_PROTEGIDA) {
        setError('La división seleccionada no pertenece a un torneo de prueba o futuro.')
        return
      }
      setCargando(true)
      try {
        const [inscritosRes, jornadasRes, configRes] = await Promise.all([
          supabase.from('inscripciones_equipo').select('equipo_id').eq('division_id', Number(divisionId)).eq('activo', true),
          supabase.from('jornadas').select('id,numero,fecha').eq('division_id', Number(divisionId)).order('numero'),
          supabase.from('configuracion_liguilla').select('equipos_clasifican,formato,activa').eq('division_id', Number(divisionId)).maybeSingle(),
        ])
        if (inscritosRes.error) throw inscritosRes.error
        if (jornadasRes.error) throw jornadasRes.error
        if (configRes.error) throw configRes.error
        const idsEquipos = [...new Set((inscritosRes.data || []).map((r) => Number(r.equipo_id)))]
        const idsJornadas = (jornadasRes.data || []).map((j) => Number(j.id))
        let equiposData = []
        let partidosData = []
        if (idsEquipos.length) {
          const res = await supabase.from('equipos').select('id,nombre').in('id', idsEquipos)
          if (res.error) throw res.error
          equiposData = res.data || []
        }
        // Paginación para no truncar calendarios largos al llegar al límite de Supabase.
        for (let i = 0; i < idsJornadas.length; i += 40) {
          const lote = idsJornadas.slice(i, i + 40)
          for (let desde = 0; ; desde += 500) {
            const res = await supabase.from('partidos')
              .select('id,jornada_id,local_id,visitante_id,goles_local,goles_visitante,estado')
              .in('jornada_id', lote).eq('fase', 'regular').order('id').range(desde, desde + 499)
            if (res.error) throw res.error
            partidosData.push(...(res.data || []))
            if ((res.data || []).length < 500) break
          }
        }
        if (!vigente) return
        setEquipos(equiposData)
        setPartidos(partidosData)
        setConfiguracion(configRes.data || null)
      } catch (err) {
        if (vigente) setError(`No se pudo cargar la vista previa: ${err.message}`)
      } finally {
        if (vigente) setCargando(false)
      }
    }
    cargarDivision()
    return () => { vigente = false }
  }, [divisionId, temporadaId, divisiones])

  const tabla = useMemo(() => crearTabla(equipos, partidos), [equipos, partidos])
  const cantidad = obtenerClasificados(tabla.length)
  const finalizados = partidos.filter((p) => p.estado === 'finalizado').length
  const pendientes = partidos.filter((p) => p.estado !== 'finalizado').length
  const rondas = crearRondas(tabla, cantidad)
  const completa = partidos.length > 0 && pendientes === 0

  if (verificando) return <main style={{ padding: 30 }}>Verificando acceso...</main>

  return (
    <main style={{ maxWidth: 1100, margin: '35px auto', padding: '0 20px' }}>
      <button type="button" onClick={() => router.push('/admin/configurar-torneo')}>← Volver a configurar torneo</button>
      <h1>Vista previa de Liguilla</h1>
      <p>YSASL — esta pantalla solo consulta información. <strong>No genera partidos ni modifica resultados.</strong></p>
      <p>El torneo oficial Verano / Invierno 2026 está excluido de esta función.</p>

      <div style={caja}>
        <label htmlFor="temporada"><strong>Temporada</strong></label><br />
        <select id="temporada" style={selector} value={temporadaId}
          onChange={(e) => setTemporadaId(e.target.value)}>
          <option value="">Selecciona temporada</option>
          {temporadas.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <br /><br />
        <label htmlFor="division"><strong>División</strong></label><br />
        <select id="division" style={selector} value={divisionId}
          onChange={(e) => setDivisionId(e.target.value)}>
          <option value="">Selecciona división</option>
          {divisionesTorneo.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      </div>

      {cargando && <p>Cargando equipos y resultados...</p>}
      {error && <p style={{ color: '#b42318' }}>{error}</p>}
      {!cargando && divisionId && !error && <>
        <div style={caja}>
          <h2>Clasificación de la fase regular</h2>
          <p><strong>{tabla.length} equipos inscritos.</strong> Clasifican automáticamente {cantidad || 'ninguno todavía'}.</p>
          <p>Partidos: {finalizados} finalizados, {pendientes} pendientes.</p>
          {configuracion && Number(configuracion.equipos_clasifican) !== cantidad &&
            <p style={{ color: '#9a6700' }}>La configuración guardada indica {configuracion.equipos_clasifican} clasificados; según la regla automática actual corresponden {cantidad}. No se ha cambiado la configuración.</p>}
          {!completa && <p style={{ color: '#9a6700' }}><strong>Clasificación provisional.</strong> La liguilla no debe generarse hasta terminar todos los partidos de la fase regular.</p>}
          {completa && <p><strong>La fase regular aparece completa.</strong> Se puede preparar la generación en la siguiente etapa.</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>{['#', 'Equipo', 'PJ', 'PG', 'PE', 'PP', 'GF', 'GC', 'DG', 'PTS'].map((x) =>
                <th key={x} style={{ borderBottom: '1px solid #aaa', padding: 8, textAlign: x === 'Equipo' ? 'left' : 'center' }}>{x}</th>)}</tr></thead>
              <tbody>{tabla.map((e, i) => <tr key={e.id} style={{ fontWeight: i < cantidad ? 700 : 400 }}>
                {[i + 1, e.nombre, e.pj, e.pg, e.pe, e.pp, e.gf, e.gc, e.dg, e.pts].map((valor, idx) =>
                  <td key={idx} style={{ padding: 8, borderBottom: '1px solid #eee', textAlign: idx === 1 ? 'left' : 'center' }}>{valor}</td>)}
              </tr>)}</tbody>
            </table>
          </div>
        </div>

        {rondas.map((ronda) => <div style={caja} key={ronda.titulo}>
          <h2>{ronda.titulo}</h2>
          {ronda.duelos.map(([a, b], idx) => <p key={idx}>
            <strong>Partido {idx + 1}:</strong> {a} <strong>vs</strong> {b}
          </p>)}
          <small>{['Repechaje', 'Cuartos de final'].includes(ronda.titulo)
            ? 'Si hay empate, avanza el mejor clasificado en la fase regular.'
            : 'Si hay empate, se define directamente por penales (sin tiempos extras).'}</small>
        </div>)}

        {cantidad === 0 && <p>Se necesitan al menos 4 equipos inscritos para preparar una liguilla.</p>}
        <p style={{ marginTop: 25 }}><strong>Modo de prueba:</strong> todavía no se crean partidos, fechas, campos ni horarios.</p>
      </>}
    </main>
  )
}
