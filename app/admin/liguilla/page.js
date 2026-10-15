'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

// YSASL: consulta de cualquier temporada; escritura EXCLUSIVA para la prueba 2027.
// Las funciones SQL deben comprobar la misma protección: no basta con el navegador.
const TEMPORADA_PRUEBA = 9
const DIVISIONES_PRUEBA = [12, 13]
const caja = { border: '1px solid #d5dbe2', borderRadius: 10, padding: 18, marginTop: 18 }
const selector = { padding: 10, width: '100%', maxWidth: 580, marginTop: 6 }

function obtenerClasificados(total) {
  if (total >= 10) return 8
  if (total >= 7) return 6
  if (total >= 4) return 4
  return 0
}

function domingoSiguiente(fechaISO, semanas = 1) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaISO || ''))) return ''
  const fecha = new Date(`${fechaISO}T12:00:00Z`)
  if (Number.isNaN(fecha.getTime())) return ''
  const diasHastaDomingo = (7 - fecha.getUTCDay()) || 7
  fecha.setUTCDate(fecha.getUTCDate() + diasHastaDomingo + (semanas - 1) * 7)
  return fecha.toISOString().slice(0, 10)
}

function esDomingo(fechaISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(fechaISO || ''))) return false
  const fecha = new Date(`${fechaISO}T12:00:00Z`)
  return !Number.isNaN(fecha.getTime()) &&
    fecha.toISOString().slice(0, 10) === fechaISO && fecha.getUTCDay() === 0
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
      ...etapa,
      fecha: domingoSiguiente(ultimaFecha, etapa.semana),
      horario: 'Por asignar según disponibilidad',
    })),
    { nombre: 'Tercer lugar', partidos: 1,
      fecha: domingoSiguiente(ultimaFecha, semanaFinal), horario: '10:00 AM (propuesto)' },
    { nombre: 'Final', partidos: 1,
      fecha: domingoSiguiente(ultimaFecha, semanaFinal), horario: '12:00 PM (propuesto)' },
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
    if (!Number.isInteger(gl) || !Number.isInteger(gv) || gl < 0 || gv < 0) continue
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

function crearBorradorPrimeraRonda(tabla, cantidad, fecha) {
  const cruces = cantidad === 4 ? [[1, 4], [2, 3]]
    : cantidad === 6 ? [[3, 6], [4, 5]]
    : cantidad === 8 ? [[1, 8], [4, 5], [2, 7], [3, 6]] : []
  const etapa = cantidad === 4 ? 'Semifinales'
    : cantidad === 6 ? 'Repechaje' : 'Cuartos de final'
  return cruces.map(([posLocal, posVisitante], indice) => ({
    numero: indice + 1, etapa,
    localId: tabla[posLocal - 1]?.id || null,
    visitanteId: tabla[posVisitante - 1]?.id || null,
    local: `${posLocal}. ${tabla[posLocal - 1]?.nombre || 'Por definir'}`,
    visitante: `${posVisitante}. ${tabla[posVisitante - 1]?.nombre || 'Por definir'}`,
    fecha: fecha || '', hora: '', campoId: '',
  }))
}

// El resultado de penales no se puede deducir de un empate: se bloquea hasta registrarlo.
function crearBorradorFinales(semifinales, tabla, fecha) {
  if (semifinales.length !== 2) return []
  const resultados = semifinales.map((p) => {
    if (p.estado !== 'finalizado' || p.goles_local == null || p.goles_visitante == null) return null
    const local = Number(p.goles_local)
    const visitante = Number(p.goles_visitante)
    if (!Number.isInteger(local) || !Number.isInteger(visitante) ||
      local < 0 || visitante < 0 || local === visitante) return null
    return {
      ganadorId: Number(local > visitante ? p.local_id : p.visitante_id),
      perdedorId: Number(local > visitante ? p.visitante_id : p.local_id),
    }
  })
  if (resultados.some((r) => !r)) return []
  const nombre = (id) => tabla.find((e) => Number(e.id) === id)?.nombre || `Equipo ${id}`
  const crear = (numero, etapa, localId, visitanteId, hora) => ({
    numero, etapa, localId, visitanteId,
    local: nombre(localId), visitante: nombre(visitanteId),
    fecha, hora, campoId: '',
  })
  return [
    crear(1, 'Tercer lugar', resultados[0].perdedorId, resultados[1].perdedorId, '10:00'),
    crear(2, 'Final', resultados[0].ganadorId, resultados[1].ganadorId, '12:00'),
  ]
}

function convertirHoraAMinutos(hora) {
  if (!hora) return null
  const partes = String(hora).split(':')
  if (partes.length < 2) return null
  const horas = Number(partes[0])
  const minutos = Number(partes[1])
  if (!Number.isInteger(horas) || !Number.isInteger(minutos) ||
    horas < 0 || horas > 23 || minutos < 0 || minutos > 59) return null
  return horas * 60 + minutos
}

function hayConflictoHorario(hora1, hora2) {
  const inicio1 = convertirHoraAMinutos(hora1)
  const inicio2 = convertirHoraAMinutos(hora2)
  return inicio1 !== null && inicio2 !== null && Math.abs(inicio1 - inicio2) < 120
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
  const [partidosLiguilla, setPartidosLiguilla] = useState([])
  const [jornadas, setJornadas] = useState([])
  const [mostrarPlan, setMostrarPlan] = useState(false)
  const [configuracion, setConfiguracion] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const [borrador, setBorrador] = useState([])
  const [tipoBorrador, setTipoBorrador] = useState('')
  const [mostrarBorrador, setMostrarBorrador] = useState(false)
  const [camposDisponibles, setCamposDisponibles] = useState([])
  const [cargandoCampos, setCargandoCampos] = useState(false)
  const [errorBorrador, setErrorBorrador] = useState('')
  const [partidosOcupados, setPartidosOcupados] = useState([])
  const [estadoDisponibilidad, setEstadoDisponibilidad] = useState('sin_consultar')
  const [fechasVerificadas, setFechasVerificadas] = useState('')
  const [verificacionId, setVerificacionId] = useState(0)
  const [guardando, setGuardando] = useState(false)
  const [mensajeGuardado, setMensajeGuardado] = useState('')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    async function iniciar() {
      try {
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
        if (resTemporadas.error || resDivisiones.error) throw new Error('No se pudieron cargar temporadas y divisiones.')
        const lista = resTemporadas.data || []
        setTemporadas(lista)
        setDivisiones(resDivisiones.data || [])
        const prueba = lista.find((t) => Number(t.id) === TEMPORADA_PRUEBA)
        setTemporadaId(String((prueba || lista[0])?.id || ''))
      } catch (err) {
        if (vigente) setError(err.message || 'No se pudo comprobar el acceso.')
      } finally {
        if (vigente) setVerificando(false)
      }
    }
    iniciar()
    return () => { vigente = false }
  }, [router])

  const divisionesTorneo = useMemo(() => divisiones.filter(
    (d) => Number(d.temporada_id) === Number(temporadaId)
  ), [divisiones, temporadaId])

  const divisionActual = divisiones.find((d) => Number(d.id) === Number(divisionId))
  const temporadaActual = temporadas.find((t) => Number(t.id) === Number(temporadaId))
  const esTemporadaPrueba = Number(temporadaId) === TEMPORADA_PRUEBA &&
    DIVISIONES_PRUEBA.includes(Number(divisionId)) &&
    Number(divisionActual?.temporada_id) === TEMPORADA_PRUEBA &&
    temporadaActual?.activa === false

  useEffect(() => { setDivisionId('') }, [temporadaId])

  useEffect(() => {
    let vigente = true
    async function cargarDivision() {
      setEquipos([])
      setPartidos([])
      setPartidosLiguilla([])
      setJornadas([])
      setMostrarPlan(false)
      setConfiguracion(null)
      setBorrador([])
      setTipoBorrador('')
      setMostrarBorrador(false)
      setErrorBorrador('')
      setEstadoDisponibilidad('sin_consultar')
      setFechasVerificadas('')
      setError('')
      if (!divisionId) return
      const division = divisiones.find((d) => Number(d.id) === Number(divisionId))
      if (!division || Number(division.temporada_id) !== Number(temporadaId)) {
        setError('La división no corresponde a la temporada seleccionada.')
        return
      }
      setCargando(true)
      try {
        const [inscritosRes, jornadasRes, configRes] = await Promise.all([
          supabase.from('inscripciones_equipo').select('equipo_id')
            .eq('division_id', Number(divisionId)).eq('activo', true),
          supabase.from('jornadas').select('id,numero,fecha')
            .eq('division_id', Number(divisionId)).order('numero'),
          supabase.from('configuracion_liguilla').select('equipos_clasifican,formato,activa')
            .eq('division_id', Number(divisionId)).maybeSingle(),
        ])
        if (inscritosRes.error) throw inscritosRes.error
        if (jornadasRes.error) throw jornadasRes.error
        if (configRes.error) throw configRes.error
        const idsEquipos = [...new Set((inscritosRes.data || []).map((r) => Number(r.equipo_id)))]
        const idsJornadas = (jornadasRes.data || []).map((j) => Number(j.id))
        let equiposData = []
        const todosPartidos = []
        if (idsEquipos.length) {
          const res = await supabase.from('equipos').select('id,nombre').in('id', idsEquipos)
          if (res.error) throw res.error
          equiposData = res.data || []
        }
        for (let i = 0; i < idsJornadas.length; i += 40) {
          const lote = idsJornadas.slice(i, i + 40)
          for (let desde = 0; ; desde += 500) {
            const res = await supabase.from('partidos')
              .select('id,jornada_id,local_id,visitante_id,goles_local,goles_visitante,estado,fecha,hora,campo_id,fase')
              .in('jornada_id', lote).order('id').range(desde, desde + 499)
            if (res.error) throw res.error
            todosPartidos.push(...(res.data || []))
            if ((res.data || []).length < 500) break
          }
        }
        if (!vigente) return
        setEquipos(equiposData)
        setPartidos(todosPartidos.filter((p) => p.fase === 'regular'))
        setPartidosLiguilla(todosPartidos.filter((p) => p.fase && p.fase !== 'regular'))
        setJornadas(jornadasRes.data || [])
        setConfiguracion(configRes.data || null)
      } catch (err) {
        if (vigente) setError(`No se pudo cargar la liguilla: ${err.message}`)
      } finally {
        if (vigente) setCargando(false)
      }
    }
    cargarDivision()
    return () => { vigente = false }
  }, [divisionId, temporadaId, divisiones, recarga])

  const tabla = useMemo(() => crearTabla(equipos, partidos), [equipos, partidos])
  const cantidad = obtenerClasificados(tabla.length)
  const finalizados = partidos.filter((p) => p.estado === 'finalizado').length
  const pendientes = partidos.filter((p) => p.estado !== 'finalizado').length
  const rondas = crearRondas(tabla, cantidad)
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
  const nombreEquipo = (id) => equipos.find((e) => Number(e.id) === Number(id))?.nombre || `Equipo ${id}`

  async function prepararBorrador() {
    if (!esTemporadaPrueba || !divisionId || cargando || cargandoCampos || cantidad === 0) return
    setErrorBorrador('')
    setMensajeGuardado('')
    setBorrador([])
    setMostrarBorrador(false)
    setTipoBorrador('')
    setCargandoCampos(true)
    try {
      const { data: camposData, error: errorCampos } = await supabase.from('campos')
        .select('id,nombre,numero,activo').eq('activo', true).order('id')
      if (errorCampos) throw errorCampos
      setCamposDisponibles(camposData || [])
      if (!camposData?.length) throw new Error('No hay campos activos disponibles.')

      const { data: eliminatorias, error: errorEliminatorias } = await supabase
        .from('partidos')
        .select('id,local_id,visitante_id,goles_local,goles_visitante,estado,fecha,fase,jornadas!inner(division_id,fecha)')
        .eq('jornadas.division_id', Number(divisionId))
        .in('fase', ['semifinal', 'final', 'tercer_lugar'])
        .order('id')
      if (errorEliminatorias) throw errorEliminatorias
      const semis = (eliminatorias || []).filter((p) => p.fase === 'semifinal')
      const finales = (eliminatorias || []).filter((p) => ['final', 'tercer_lugar'].includes(p.fase))
      if (finales.length) {
        throw new Error('La final o el tercer lugar ya existen. No se crearán partidos duplicados.')
      }
      let nuevoBorrador = []
      let nuevoTipo = ''
      if (semis.length === 2) {
        if (semis.some((p) => p.estado !== 'finalizado' ||
          p.goles_local == null || p.goles_visitante == null)) {
          throw new Error('Primero deben terminar las dos semifinales y registrar sus marcadores.')
        }
        if (semis.some((p) => Number(p.goles_local) === Number(p.goles_visitante))) {
          throw new Error('Hay una semifinal empatada. Debe registrarse el ganador por penales antes de crear la final.')
        }
        const fechasSemis = semis.map((p) => p.fecha || p.jornadas?.fecha).filter(Boolean).sort()
        if (fechasSemis.length !== 2) throw new Error('Falta la fecha de una semifinal.')
        const fechaFinal = domingoSiguiente(fechasSemis[1])
        nuevoBorrador = crearBorradorFinales(semis, tabla, fechaFinal)
        nuevoTipo = 'finales'
      } else if (semis.length === 0) {
        nuevoBorrador = crearBorradorPrimeraRonda(tabla, cantidad, planFechas[0]?.fecha)
        nuevoTipo = cantidad === 4 ? 'semifinales' : 'preliminar'
      } else {
        throw new Error('Se encontraron semifinales incompletas o duplicadas. Revisa los partidos existentes.')
      }
      if (!nuevoBorrador.length) throw new Error('Todavía no se pueden preparar estos cruces.')
      setVerificacionId((n) => n + 1)
      setBorrador(nuevoBorrador)
      setTipoBorrador(nuevoTipo)
      setMostrarBorrador(true)
    } catch (err) {
      setErrorBorrador(err.message || 'No se pudo preparar el borrador.')
    } finally {
      setCargandoCampos(false)
    }
  }

  function actualizarBorrador(indice, campo, valor) {
    setBorrador((actual) => actual.map((partido, i) =>
      i === indice ? { ...partido, [campo]: valor } : partido
    ))
  }

  const fechasBorrador = [...new Set(borrador.map((p) => p.fecha).filter(Boolean))].sort().join(',')

  useEffect(() => {
    let vigente = true
    async function consultarOcupados() {
      setPartidosOcupados([])
      setFechasVerificadas('')
      setEstadoDisponibilidad('sin_consultar')
      if (!mostrarBorrador || !fechasBorrador) return
      setEstadoDisponibilidad('consultando')
      try {
        const fechas = fechasBorrador.split(',')
        const resultados = []
        for (let desde = 0; ; desde += 500) {
          const { data, error: errorConsulta } = await supabase.from('partidos')
            .select('id,fecha,hora,campo_id,estado,jornadas(fecha)')
            .neq('estado', 'cancelado').order('id').range(desde, desde + 499)
          if (errorConsulta) throw errorConsulta
          resultados.push(...(data || []))
          if ((data || []).length < 500) break
        }
        if (!vigente) return
        setPartidosOcupados(resultados.filter((p) => fechas.includes(p.fecha || p.jornadas?.fecha)))
        setFechasVerificadas(fechasBorrador)
        setEstadoDisponibilidad('verificado')
      } catch (err) {
        if (vigente) {
          setEstadoDisponibilidad('error')
          setErrorBorrador(`No se pudo comprobar disponibilidad: ${err.message}`)
        }
      }
    }
    consultarOcupados()
    return () => { vigente = false }
  }, [mostrarBorrador, fechasBorrador, verificacionId])

  const disponibilidadLista = estadoDisponibilidad === 'verificado' &&
    fechasVerificadas === fechasBorrador && Boolean(fechasBorrador)

  const conflictosBorrador = useMemo(() => borrador.map((partido, indice) => {
    if (!partido.fecha || !partido.hora || !partido.campoId) return null
    const ocupado = partidosOcupados.find((p) =>
      (p.fecha || p.jornadas?.fecha) === partido.fecha &&
      Number(p.campo_id) === Number(partido.campoId) &&
      hayConflictoHorario(p.hora, partido.hora)
    )
    if (ocupado) return `Conflicto con el partido existente #${ocupado.id}`
    const repetido = borrador.find((otro, i) => i !== indice &&
      otro.fecha === partido.fecha && otro.campoId &&
      Number(otro.campoId) === Number(partido.campoId) &&
      hayConflictoHorario(otro.hora, partido.hora)
    )
    return repetido ? `Conflicto con el partido ${repetido.numero} del borrador` : null
  }), [borrador, partidosOcupados])

  function asignarAutomaticamente() {
    if (!esTemporadaPrueba || !mostrarBorrador || !borrador.length) return
    if (!disponibilidadLista) {
      setErrorBorrador('Espera a que termine la verificación de campos.')
      return
    }
    const campos = [...camposDisponibles].filter((c) => c.id != null && c.activo !== false)
      .sort((a, b) => Number(a.id) - Number(b.id))
    const nuevos = []
    for (const partido of borrador) {
      if (!esDomingo(partido.fecha)) {
        setErrorBorrador(`La fecha del partido ${partido.numero} debe ser domingo.`)
        return
      }
      const horas = partido.etapa === 'Tercer lugar'
        ? ['10:00', '11:00', '13:00', '15:00', '09:00', '12:00']
        : partido.etapa === 'Final'
          ? ['12:00', '13:00', '15:00', '11:00', '09:00', '10:00']
          : ['09:00', '11:00', '13:00', '15:00', '10:00', '12:00']
      let asignado = null
      for (const hora of horas) {
        for (const campo of campos) {
          const ocupado = partidosOcupados.some((p) =>
            (p.fecha || p.jornadas?.fecha) === partido.fecha &&
            Number(p.campo_id) === Number(campo.id) &&
            hayConflictoHorario(p.hora, hora)
          )
          const repetido = nuevos.some((p) => p.fecha === partido.fecha &&
            Number(p.campoId) === Number(campo.id) && hayConflictoHorario(p.hora, hora))
          if (!ocupado && !repetido) {
            asignado = { ...partido, hora, campoId: String(campo.id) }
            break
          }
        }
        if (asignado) break
      }
      if (!asignado) {
        setErrorBorrador(`No hay horario y campo disponible para el partido ${partido.numero}.`)
        return
      }
      nuevos.push(asignado)
    }
    setErrorBorrador('')
    setBorrador(nuevos)
  }

  const rondasGuardadas = partidosLiguilla.filter((p) =>
    ['semifinal', 'final', 'tercer_lugar'].includes(p.fase)
  )
  const haySemisGuardadas = rondasGuardadas.some((p) => p.fase === 'semifinal')
  const hayFinalesGuardadas = rondasGuardadas.some((p) =>
    ['final', 'tercer_lugar'].includes(p.fase)
  )
  const tipoGuardable = (tipoBorrador === 'semifinales' && !haySemisGuardadas) ||
    (tipoBorrador === 'finales' && haySemisGuardadas && !hayFinalesGuardadas)
  const borradorValido = borrador.length === 2 &&
    (tipoBorrador !== 'finales' || borrador.every((p) => p.fecha === borrador[0]?.fecha)) &&
    borrador.every((p) =>
    Number.isInteger(Number(p.localId)) && Number(p.localId) > 0 &&
    Number.isInteger(Number(p.visitanteId)) && Number(p.visitanteId) > 0 &&
    Number(p.localId) !== Number(p.visitanteId) &&
    esDomingo(p.fecha) && convertirHoraAMinutos(p.hora) !== null &&
    camposDisponibles.some((c) => Number(c.id) === Number(p.campoId))
  )
  const listoParaGuardar = esTemporadaPrueba && completa && partidos.length === 30 &&
    !cargando && !cargandoCampos && !guardando && mostrarBorrador && tipoGuardable &&
    borradorValido && disponibilidadLista && conflictosBorrador.every((m) => !m)

  async function guardarPartidosLiguilla() {
    if (!listoParaGuardar || !esTemporadaPrueba ||
      !DIVISIONES_PRUEBA.includes(Number(divisionId))) {
      setErrorBorrador('No se cumplen las condiciones de seguridad para guardar.')
      return
    }
    const esFinales = tipoBorrador === 'finales'
    const descripcion = esFinales ? 'la final y el tercer lugar' : 'las dos semifinales'
    if (!window.confirm(`¿Confirmas guardar ${descripcion} de PRUEBA YSASL 2027?\n\nRevisa que fechas, horarios y campos sean correctos.`)) return
    setGuardando(true)
    setErrorBorrador('')
    try {
      const partidosParaGuardar = borrador.map((p) => ({
        etapa: p.etapa === 'Final' ? 'final' :
          p.etapa === 'Tercer lugar' ? 'tercer_lugar' : 'semifinal',
        localId: Number(p.localId),
        visitanteId: Number(p.visitanteId),
        fecha: p.fecha,
        hora: p.hora,
        campoId: Number(p.campoId),
      }))
      const funcion = esFinales ? 'guardar_finales_liguilla_prueba' : 'guardar_liguilla_prueba'
      const { data, error: errorGuardar } = await supabase.rpc(funcion, {
        p_division_id: Number(divisionId),
        p_borrador: partidosParaGuardar,
      })
      if (errorGuardar) throw errorGuardar
      setMensajeGuardado(`Se guardaron ${data?.partidos_creados ?? 2} partidos: ${descripcion}.`)
      setBorrador([])
      setMostrarBorrador(false)
      setTipoBorrador('')
      setRecarga((n) => n + 1)
    } catch (err) {
      setErrorBorrador(`No se pudieron guardar los partidos: ${err.message}`)
    } finally {
      setGuardando(false)
    }
  }

  if (verificando) return <main style={{ padding: 30 }}>Verificando acceso...</main>

  return (
    <main style={{ maxWidth: 1100, margin: '35px auto', padding: '0 20px' }}>
      <button type="button" onClick={() => router.push('/admin/configurar-torneo')}>
        ← Volver a configurar torneo
      </button>
      <h1>Administrar liguilla</h1>
      <p>Consulta las clasificaciones y cruces de cualquier temporada. <strong>El guardado está limitado a PRUEBA YSASL 2027.</strong></p>
      <p><strong>Verano / Invierno 2026:</strong> únicamente vista previa. No se modifican sus partidos ni resultados.</p>

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
      {mensajeGuardado && <p style={{ color: '#166534', fontWeight: 'bold' }}>{mensajeGuardado}</p>}
      {!cargando && divisionId && !error && <>
        <div style={caja}>
          <h2>Clasificación de la fase regular</h2>
          <p><strong>{tabla.length} equipos inscritos.</strong> Clasifican automáticamente {cantidad || 'ninguno todavía'}.</p>
          <p>Partidos: {finalizados} finalizados, {pendientes} pendientes.</p>
          {configuracion && Number(configuracion.equipos_clasifican) !== cantidad &&
            <p style={{ color: '#9a6700' }}>La configuración guardada indica {configuracion.equipos_clasifican} clasificados; la regla automática indica {cantidad}. No se ha cambiado la configuración.</p>}
          {!completa && <p style={{ color: '#9a6700' }}><strong>Clasificación provisional.</strong> Termina todos los partidos regulares antes de guardar la liguilla.</p>}
          {completa && <p><strong>La fase regular aparece completa.</strong></p>}
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

        {rondasGuardadas.length > 0 && <div style={caja}>
          <h2>Partidos de liguilla ya guardados</h2>
          {rondasGuardadas.map((p) => <p key={p.id}>
            <strong>{p.fase === 'semifinal' ? 'Semifinal' : p.fase === 'tercer_lugar' ? 'Tercer lugar' : p.fase === 'final' ? 'Final' : p.fase}</strong>
            {' — '}{nombreEquipo(p.local_id)} vs {nombreEquipo(p.visitante_id)}
            {' — '}{p.fecha || fechaPorJornada.get(Number(p.jornada_id)) || 'Sin fecha'}
            {p.hora ? `, ${String(p.hora).slice(0, 5)}` : ''}
            {p.estado === 'finalizado' ? ` — ${p.goles_local} a ${p.goles_visitante}` : ' — Pendiente'}
          </p>)}
        </div>}

        {cantidad === 0 && <p>Se necesitan al menos 4 equipos inscritos para preparar una liguilla.</p>}
        {planFechas.length > 0 && <div style={caja}>
          <h2>Programación propuesta de liguilla</h2>
          <p>Último partido regular programado: <strong>{ultimaFechaRegular}</strong>.</p>
          <button type="button" onClick={() => setMostrarPlan((anterior) => !anterior)}>
            {mostrarPlan ? 'Ocultar propuesta de fechas' : 'Ver propuesta de fechas y horarios'}
          </button>
          {mostrarPlan && <>
            <p><strong>Fechas tentativas:</strong> todavía no se han comprobado campos disponibles ni otros partidos.</p>
            {!completa && <p style={{ color: '#9a6700' }}>Hay {pendientes} partidos regulares pendientes.</p>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>{['Etapa', 'Fecha propuesta', 'Partidos', 'Horario'].map((titulo) =>
                  <th key={titulo} style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #aaa' }}>{titulo}</th>)}</tr></thead>
                <tbody>{planFechas.map((etapa) => <tr key={etapa.nombre}>
                  {[etapa.nombre, etapa.fecha, etapa.partidos, etapa.horario].map((valor, indice) =>
                    <td key={indice} style={{ padding: 8, borderBottom: '1px solid #eee' }}>{valor}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </>}
        </div>}

        {esTemporadaPrueba && cantidad > 0 && <div style={caja}>
          <h2>Preparar partidos — PRUEBA YSASL 2027</h2>
          <p>Se preparan semifinales o, cuando ambas hayan terminado, la final y el tercer lugar. <strong>Nada se guarda hasta confirmar.</strong></p>
          <button type="button" disabled={cargandoCampos || cargando || guardando} onClick={prepararBorrador}>
            {cargandoCampos ? 'Consultando partidos...' : 'Preparar borrador de partidos'}
          </button>
          <button type="button" onClick={asignarAutomaticamente}
            disabled={!mostrarBorrador || !disponibilidadLista || guardando}
            style={{ marginLeft: 10, padding: '8px 12px' }}>
            Asignar automáticamente
          </button>
          <button type="button" onClick={guardarPartidosLiguilla}
            disabled={!listoParaGuardar}
            title={listoParaGuardar ? 'Revisar y confirmar guardado' : 'Se requieren resultados completos, campos disponibles y validaciones'}
            style={{ marginLeft: 10, padding: '8px 12px',
              opacity: listoParaGuardar ? 1 : 0.5,
              cursor: listoParaGuardar ? 'pointer' : 'not-allowed' }}>
            {guardando ? 'Guardando...' : 'Guardar partidos de liguilla'}
          </button>
          {mostrarBorrador && <p style={{ color: listoParaGuardar ? '#166534' : '#b45309', fontWeight: 'bold' }}>
            {listoParaGuardar
              ? '✓ Partidos listos para revisar y confirmar.'
              : tipoBorrador === 'preliminar'
                ? '⚠ Repechaje y cuartos de final: borrador de vista previa. El guardado de esas etapas aún no está habilitado.'
                : '⚠ Guardado bloqueado: faltan resultados, horarios, campos o verificaciones.'}
          </p>}
          {errorBorrador && <p style={{ color: '#b42318' }}>{errorBorrador}</p>}
          {mostrarBorrador && <>
            {!completa && <p style={{ color: '#9a6700' }}><strong>Simulación provisional:</strong> todavía faltan resultados regulares.</p>}
            <p><strong>Etapa:</strong> {tipoBorrador === 'finales' ? 'Tercer lugar y final' : borrador[0]?.etapa}.</p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead><tr>{['Partido', 'Etapa', 'Local', 'Visitante', 'Fecha', 'Hora', 'Campo'].map((titulo) =>
                  <th key={titulo} style={{ padding: 8, textAlign: 'left', borderBottom: '1px solid #aaa' }}>{titulo}</th>)}</tr></thead>
                <tbody>{borrador.map((p, indice) => <tr key={`${p.etapa}-${p.numero}`}>
                  <td style={{ padding: 8 }}>{p.numero}</td>
                  <td style={{ padding: 8 }}>{p.etapa}</td>
                  <td style={{ padding: 8 }}>{p.local}</td>
                  <td style={{ padding: 8 }}>{p.visitante}</td>
                  <td style={{ padding: 8 }}><input aria-label={`Fecha partido ${p.numero}`}
                    type="date" value={p.fecha}
                    onChange={(e) => actualizarBorrador(indice, 'fecha', e.target.value)} /></td>
                  <td style={{ padding: 8 }}><select aria-label={`Hora partido ${p.numero}`}
                    value={p.hora} onChange={(e) => actualizarBorrador(indice, 'hora', e.target.value)}>
                    <option value="">Por asignar</option>
                    {['09:00', '10:00', '11:00', '12:00', '13:00', '15:00'].map((hora) =>
                      <option key={hora} value={hora}>{hora}</option>)}
                  </select></td>
                  <td style={{ padding: 8 }}><select aria-label={`Campo partido ${p.numero}`}
                    value={p.campoId} onChange={(e) => actualizarBorrador(indice, 'campoId', e.target.value)}>
                    <option value="">Por asignar</option>
                    {camposDisponibles.map((campo) =>
                      <option key={campo.id} value={String(campo.id)}>
                        {campo.nombre || (campo.numero ? `Campo ${campo.numero}` : `Campo ${campo.id}`)}
                      </option>)}
                  </select></td>
                </tr>)}</tbody>
              </table>
            </div>
            <p style={{ fontWeight: 'bold' }}>
              {estadoDisponibilidad === 'consultando' || !disponibilidadLista
                ? '⏳ Comprobando disponibilidad de campos y horarios...'
                : estadoDisponibilidad === 'verificado'
                  ? '✓ Consulta terminada. Revisa los conflictos.'
                  : estadoDisponibilidad === 'error'
                    ? '⚠ No se pudo verificar la disponibilidad.'
                    : 'Disponibilidad pendiente de verificar.'}
            </p>
            {conflictosBorrador.map((mensaje, indice) => mensaje &&
              <p key={indice} style={{ color: '#b42318', fontWeight: 'bold' }}>
                ⚠ Partido {indice + 1}: {mensaje}
              </p>)}
            <p style={{ color: '#9a6700' }}><strong>Importante:</strong> Revisa fechas, horarios y campos antes de confirmar. Supabase volverá a validar el guardado.</p>
          </>}
        </div>}
        <p style={{ marginTop: 25 }}><strong>Protección:</strong> la temporada oficial 2026 permanece en modo consulta. Solo las divisiones de prueba 12 y 13 pueden usar el guardado.</p>
      </>}
    </main>
  )
}
