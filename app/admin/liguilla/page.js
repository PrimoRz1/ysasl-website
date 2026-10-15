
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

// Vista previa y borrador de programación de liguilla. NO escribe registros.
// La temporada oficial (id 1) puede consultarse, pero nunca se prepara para guardar.
const TEMPORADA_PROTEGIDA = 1
const caja = { border: '1px solid #d5dbe2', borderRadius: 10, padding: 18, marginTop: 18 }
const selector = { padding: 10, width: '100%', maxWidth: 580, marginTop: 6 }

function obtenerClasificados(total) {
  if (total >= 10) return 8
  if (total >= 7) return 6
  if (total >= 4) return 4
  return 0
}

function domingoSiguiente(fechaISO, semanas = 1) {
  const fecha = new Date(`${fechaISO}T12:00:00Z`)
  if (Number.isNaN(fecha.getTime())) return ''
  const diasHastaDomingo = (7 - fecha.getUTCDay()) || 7
  fecha.setUTCDate(fecha.getUTCDate() + diasHastaDomingo + (semanas - 1) * 7)
  return fecha.toISOString().slice(0, 10)
}

function crearPlanFechas(ultimaFecha, cantidad) {
  if (!ultimaFecha || ![4, 6, 8].includes(cantidad)) return []
  const preliminar = cantidad === 6 ? 'Repechaje' : 'Cuartos de final'
  const etapas = cantidad === 4
    ? [{ nombre: 'Semifinales', semana: 1, partidos: 2 }]
    : [{ nombre: preliminar, semana: 1, partidos: cantidad === 6 ? 2 : 4 },
       { nombre: 'Semifinales', semana: 2, partidos: 2 }]
  const semanaFinal = cantidad === 4 ? 2 : 3
  return [
    ...etapas.map((etapa) => ({
      ...etapa, fecha: domingoSiguiente(ultimaFecha, etapa.semana),
      horario: 'Por asignar según disponibilidad de campos y horarios',
    })),
    { nombre: 'Tercer lugar', partidos: 1,
      fecha: domingoSiguiente(ultimaFecha, semanaFinal), horario: '10:00 AM' },
    { nombre: 'Final', partidos: 1,
      fecha: domingoSiguiente(ultimaFecha, semanaFinal), horario: '12:00 PM' },
  ]
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

// Solo se generan cruces de la primera ronda: las siguientes dependen de resultados.
function crearBorradorPrimeraRonda(tabla, cantidad, fecha) {
  const cruces = cantidad === 4 ? [[1, 4], [2, 3]]
    : cantidad === 6 ? [[3, 6], [4, 5]]
    : cantidad === 8 ? [[1, 8], [4, 5], [2, 7], [3, 6]] : []
  const etapa = cantidad === 4 ? 'Semifinales' : cantidad === 6 ? 'Repechaje' : 'Cuartos de final'
  return cruces.map(([posLocal, posVisitante], indice) => ({
    numero: indice + 1,
    etapa,
    localId: tabla[posLocal - 1]?.id || null,
    visitanteId: tabla[posVisitante - 1]?.id || null,
    local: `${posLocal}. ${tabla[posLocal - 1]?.nombre || 'Por definir'}`,
    visitante: `${posVisitante}. ${tabla[posVisitante - 1]?.nombre || 'Por definir'}`,
    fecha: fecha || '',
    hora: '',
    campoId: '',
  }))
}
function convertirHoraAMinutos(hora) {
  if (!hora) return null

  const partes = String(hora).split(':')
  if (partes.length < 2) return null

  const horas = Number(partes[0])
  const minutos = Number(partes[1])

  if (!Number.isInteger(horas) || !Number.isInteger(minutos)) return null
  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return null

  return horas * 60 + minutos
}

function hayConflictoHorario(hora1, hora2) {
  const inicio1 = convertirHoraAMinutos(hora1)
  const inicio2 = convertirHoraAMinutos(hora2)

  if (inicio1 === null || inicio2 === null) return false

  return Math.abs(inicio1 - inicio2) < 120
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
  const [jornadas, setJornadas] = useState([])
  const [mostrarPlan, setMostrarPlan] = useState(false)
  const [configuracion, setConfiguracion] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [borrador, setBorrador] = useState([])
  const [mostrarBorrador, setMostrarBorrador] = useState(false)
  const [camposDisponibles, setCamposDisponibles] = useState([])
  const [cargandoCampos, setCargandoCampos] = useState(false)
  const [errorBorrador, setErrorBorrador] = useState('')
  const [partidosOcupados, setPartidosOcupados] = useState([])
  const [estadoDisponibilidad, setEstadoDisponibilidad] = useState('sin_consultar')

  useEffect(() => {
    let vigente = true
    async function iniciar() {
      const { data: { user }, error: errorUsuario } = await supabase.auth.getUser()
      if (!vigente) return
      if (errorUsuario || !user) { router.replace('/login'); return }
      const { data: perfil, error: errorPerfil } = await supabase.from('perfiles')
        .select('rol').eq('id', user.id).maybeSingle()
      if (!vigente) return
      if (errorPerfil || perfil?.rol !== 'admin') { router.replace('/admin'); return }

      const [resTemporadas, resDivisiones] = await Promise.all([
        supabase.from('temporadas').select('id,nombre,activa').order('id', { ascending: false }),
        supabase.from('divisiones').select('id,nombre,temporada_id').order('id'),
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
      setJornadas([])
      setMostrarPlan(false)
      setConfiguracion(null)
      setBorrador([])
      setMostrarBorrador(false)
      setErrorBorrador('')
      setError('')
      if (!divisionId) return
      const division = divisiones.find((d) => Number(d.id) === Number(divisionId))
      if (!division || Number(division.temporada_id) !== Number(temporadaId)) {
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
              .select('id,jornada_id,local_id,visitante_id,goles_local,goles_visitante,estado,fecha')
              .in('jornada_id', lote).eq('fase', 'regular').order('id').range(desde, desde + 499)
            if (res.error) throw res.error
            partidosData.push(...(res.data || []))
            if ((res.data || []).length < 500) break
          }
        }
        if (!vigente) return
        setEquipos(equiposData)
        setPartidos(partidosData)
        setJornadas(jornadasRes.data || [])
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
  // No basta con marcar "finalizado": todos los marcadores deben estar completos.
  const completa = partidos.length > 0 && pendientes === 0 && partidos.every((p) =>
    p.goles_local != null && p.goles_visitante != null &&
    Number.isInteger(Number(p.goles_local)) && Number.isInteger(Number(p.goles_visitante)) &&
    Number(p.goles_local) >= 0 && Number(p.goles_visitante) >= 0
  )
  const fechaPorJornada = useMemo(() => new Map(
    jornadas.map((j) => [Number(j.id), j.fecha])
  ), [jornadas])
  const ultimaFechaRegular = useMemo(() => {
    const fechas = partidos.map((p) => p.fecha || fechaPorJornada.get(Number(p.jornada_id)))
      .filter(Boolean).sort()
    return fechas.length ? fechas[fechas.length - 1] : ''
  }, [partidos, fechaPorJornada])
  const planFechas = useMemo(() => crearPlanFechas(ultimaFechaRegular, cantidad),
    [ultimaFechaRegular, cantidad])

  // En esta etapa solo se permite preparar borradores para PRUEBA YSASL 2027.
  // La protección de escritura real deberá implementarse también en Supabase.
  const esTemporadaPrueba = Number(temporadaId) === 9 &&
    Number(temporadaId) !== TEMPORADA_PROTEGIDA

  async function prepararBorrador() {
    if (!esTemporadaPrueba || !divisionId || cargando || cantidad === 0) return
    setErrorBorrador('')
    setCargandoCampos(true)
    try {
      const { data, error: errorCampos } = await supabase.from('campos')
        .select('*').order('id')
      if (errorCampos) throw errorCampos
      setCamposDisponibles(data || [])
      setBorrador(crearBorradorPrimeraRonda(tabla, cantidad, planFechas[0]?.fecha))
      setMostrarBorrador(true)
    } catch (err) {
      setErrorBorrador(`No se pudieron consultar los campos: ${err.message}`)
    } finally {
      setCargandoCampos(false)
    }
  }

  function actualizarBorrador(indice, campo, valor) {
    setBorrador((actual) => actual.map((partido, i) =>
      i === indice ? { ...partido, [campo]: valor } : partido
    ))
  }
  const fechasBorrador = [...new Set(
    borrador.map((p) => p.fecha).filter(Boolean)
  )].sort().join(',')

  useEffect(() => {
    let vigente = true

    async function consultarOcupados() {
      setPartidosOcupados([])
      setEstadoDisponibilidad('sin_consultar')
      if (!mostrarBorrador || !fechasBorrador) return
      setEstadoDisponibilidad('consultando')

      try {
        const fechas = fechasBorrador.split(',')
        const resultados = []

        for (let desde = 0; ; desde += 500) {
          const { data, error } = await supabase
            .from('partidos')
            .select('id,fecha,hora,campo_id,estado,jornadas(fecha)')
            .neq('estado', 'cancelado')
            .order('id')
            .range(desde, desde + 499)

          if (error) throw error

          resultados.push(...(data || []))
          if ((data || []).length < 500) break
        }

        if (vigente) {
          setPartidosOcupados(resultados.filter((p) =>
            fechas.includes(p.fecha || p.jornadas?.fecha)
          ))
          setEstadoDisponibilidad('verificado')
        }
      } catch (err) {
        if (vigente) {
          setEstadoDisponibilidad('error')
          setErrorBorrador(
            `No se pudo comprobar disponibilidad: ${err.message}`
          )
        }
      }
    }

    consultarOcupados()
    return () => { vigente = false }
  }, [mostrarBorrador, fechasBorrador])
    const conflictosBorrador = useMemo(() => {
    return borrador.map((partido, indice) => {
      if (!partido.fecha || !partido.hora || !partido.campoId) {
        return null
      }

      const ocupado = partidosOcupados.find((p) =>
        (p.fecha || p.jornadas?.fecha) === partido.fecha &&
        Number(p.campo_id) === Number(partido.campoId) &&
        hayConflictoHorario(p.hora, partido.hora)
      )

      if (ocupado) {
        return `Conflicto con el partido existente #${ocupado.id}`
      }

      const repetido = borrador.find((otro, i) =>
        i !== indice &&
        otro.fecha === partido.fecha &&
        otro.campoId &&
        Number(otro.campoId) === Number(partido.campoId) &&
        hayConflictoHorario(otro.hora, partido.hora)
      )

      if (repetido) {
        return `Conflicto con el partido ${repetido.numero} del borrador`
      }

      return null
    })
  }, [borrador, partidosOcupados])
  const listoParaGuardar =
  esTemporadaPrueba &&
  completa &&
  mostrarBorrador &&
  borrador.length > 0 &&
  borrador.every((p) => p.fecha && p.hora && p.campoId) &&
  estadoDisponibilidad === 'verificado' &&
  conflictosBorrador.every((mensaje) => !mensaje)
  async function guardarPartidosLiguilla() {
  if (
    !listaParaGuardar ||
    Number(temporadaId) !== 9 ||
    ![12, 13].includes(Number(divisionId))
  ) {
    setErrorBorrador('No se cumplen las condiciones para guardar.');
    return;
  }

  const confirmado = window.confirm(
    '¿Confirmas guardar las dos semifinales de PRUEBA YSASL 2027?'
  );

  if (!confirmado) return;

  try {
    const partidosParaGuardar = borrador.map((partido) => ({
      localId: Number(partido.localId),
      visitanteId: Number(partido.visitanteId),
      fecha: partido.fecha,
      hora: partido.hora,
      campoId: Number(partido.campoId),
    }));

    const { data, error } = await supabase.rpc(
      'guardar_liguilla_prueba',
      {
        p_division_id: Number(divisionId),
        p_borrador: partidosParaGuardar,
      }
    );

    if (error) throw error;

    window.alert(
      `Se guardaron ${data.partidos_creados} semifinales correctamente.`
    );

    window.location.reload();
  } catch (error) {
    setErrorBorrador(`No se pudieron guardar: ${error.message}`);
  }
}
  if (verificando) return <main style={{ padding: 30 }}>Verificando acceso...</main>

  return (
    <main style={{ maxWidth: 1100, margin: '35px auto', padding: '0 20px' }}>
      <button type="button" onClick={() => router.push('/admin/configurar-torneo')}>← Volver a configurar torneo</button>
      <h1>Vista previa de Liguilla</h1>
      <p>YSASL — esta pantalla solo consulta información. <strong>No genera partidos ni modifica resultados.</strong></p>
      <p>El torneo oficial Verano / Invierno 2026 se puede consultar en modo de vista previa. No se modifican partidos ni resultados.</p>

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
        {planFechas.length > 0 && <div style={caja}>
          <h2>Programación propuesta de liguilla</h2>
          <p>Último partido regular programado: <strong>{ultimaFechaRegular}</strong>.</p>
          <button type="button" onClick={() => setMostrarPlan((anterior) => !anterior)}>
            {mostrarPlan ? 'Ocultar propuesta de fechas' : 'Ver propuesta de fechas y horarios'}
          </button>
          {mostrarPlan && <>
            <p><strong>Vista previa únicamente.</strong> Estas fechas son tentativas y
              todavía no se han comprobado campos disponibles ni otros partidos.</p>
            {!completa && <p style={{ color: '#9a6700' }}>
              La fase regular tiene {pendientes} partidos pendientes. No se puede confirmar la liguilla todavía.
            </p>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>{['Etapa', 'Fecha propuesta', 'Partidos', 'Horario'].map((titulo) =>
                  <th key={titulo} style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #aaa' }}>{titulo}</th>
                )}</tr></thead>
                <tbody>{planFechas.map((etapa) => <tr key={etapa.nombre}>
                  {[etapa.nombre, etapa.fecha, etapa.partidos, etapa.horario].map((valor, indice) =>
                    <td key={indice} style={{ padding: 8, borderBottom: '1px solid #eee' }}>{valor}</td>
                  )}
                </tr>)}</tbody>
              </table>
            </div>
          </>}
        </div>}
        {esTemporadaPrueba && cantidad > 0 && <div style={caja}>
          <h2>Preparar partidos de liguilla — simulación</h2>
          <p>Este borrador reúne los cruces de la primera ronda y permite revisar fechas,
            horarios y campos. <strong>No guarda nada en Supabase.</strong></p>
          <button type="button" disabled={cargandoCampos || cargando} onClick={prepararBorrador}>
            {cargandoCampos ? 'Consultando campos...' : 'Preparar borrador de partidos'}
          </button>
<button
  type="button"
onClick={guardarPartidosLiguilla}
  disabled={!listoParaGuardar}
  title="El guardado se habilitará cuando se completen las verificaciones de seguridad"
  style={{
    marginLeft: 10,
    padding: '8px 12px',
    opacity: 0.5,
    cursor: 'not-allowed'
  }}
>
  Guardar partidos de liguilla
</button>
{mostrarBorrador && (
  <p style={{
    color: listoParaGuardar ? '#166534' : '#b45309',
    fontWeight: 'bold'
  }}>
    {listoParaGuardar
      ? '✓ Requisitos preliminares completos. Falta habilitar el guardado seguro.'
      : '⚠ Guardado bloqueado: faltan resultados, horarios, campos o verificaciones.'}
  </p>
)}
          {errorBorrador && <p style={{ color: '#b42318' }}>{errorBorrador}</p>}
          {mostrarBorrador && <>
            {!completa && <p style={{ color: '#9a6700' }}>
              <strong>Simulación provisional:</strong> todavía hay partidos regulares
              pendientes o marcadores incompletos. Los clasificados pueden cambiar.
            </p>}
            <p><strong>Etapa:</strong> {borrador[0]?.etapa || 'Por definir'}.
              Solo se prepara la primera ronda; las siguientes dependen de sus resultados.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>{['Partido', 'Local', 'Visitante', 'Fecha', 'Hora', 'Campo'].map((titulo) =>
                  <th key={titulo} style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #aaa' }}>{titulo}</th>
                )}</tr></thead>
                <tbody>{borrador.map((partido, indice) => <tr key={partido.numero}>
                  <td style={{ padding: 8 }}>{partido.numero}</td>
                  <td style={{ padding: 8 }}>{partido.local}</td>
                  <td style={{ padding: 8 }}>{partido.visitante}</td>
                  <td style={{ padding: 8 }}><input aria-label={`Fecha partido ${partido.numero}`}
                    type="date" value={partido.fecha}
                    onChange={(e) => actualizarBorrador(indice, 'fecha', e.target.value)} /></td>
                  <td style={{ padding: 8 }}><select aria-label={`Hora partido ${partido.numero}`}
                    value={partido.hora}
                    onChange={(e) => actualizarBorrador(indice, 'hora', e.target.value)}>
                    <option value="">Por asignar</option>
                    {['09:00', '10:00', '11:00', '12:00', '13:00', '15:00'].map((hora) =>
                      <option key={hora} value={hora}>{hora}</option>
                    )}
                  </select></td>
                  <td style={{ padding: 8 }}><select aria-label={`Campo partido ${partido.numero}`}
                    value={partido.campoId}
                    onChange={(e) => actualizarBorrador(indice, 'campoId', e.target.value)}>
                    <option value="">Por asignar</option>
                    {camposDisponibles.map((campo) =>
                      <option key={campo.id} value={String(campo.id)}>
                        {campo.nombre || campo.nombre_campo ||
                          (campo.numero ? `Campo ${campo.numero}` : `Campo ${campo.id}`)}
                      </option>
                    )}
                  </select></td>
                </tr>)}</tbody>
              </table>
            </div>
<p style={{ fontWeight: 'bold' }}>
  {estadoDisponibilidad === 'consultando'
    ? '⏳ Revisando disponibilidad de campos y horarios...'
    : estadoDisponibilidad === 'verificado'
    ? '✓ Consulta terminada. Revisa los conflictos y los horarios asignados.'
    : estadoDisponibilidad === 'error'
    ? '⚠️ No se pudo verificar la disponibilidad.'
    : 'Disponibilidad pendiente de verificar.'}
</p>
            {conflictosBorrador.map((mensaje, indice) =>
  mensaje ? (
    <p
      key={indice}
      style={{ color: '#b42318', fontWeight: 'bold' }}
    >
      ⚠️ Partido {indice + 1}: {mensaje}
    </p>
  ) : null
)}
                    <p style={{ color: '#9a6700' }}><strong>Pendiente:</strong> verificar
              conflictos con otros partidos, validar horarios y crear el guardado
              seguro en Supabase. Esta pantalla todavía no reserva campos.</p>
          </>}
        </div>}
        <p style={{ marginTop: 25 }}><strong>Modo de prueba:</strong> todavía no se crean partidos ni se reservan campos u horarios.</p>
      </>}
    </main>
  )
}
