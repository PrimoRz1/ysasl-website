'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

// YSASL: liguilla oficial 2026. Guardado habilitado tras instalar las RPC oficiales.
// Las RPC de guardado se instalaron en Supabase y usan permisos de administrador,
// validaciones y transacciones; el servidor vuelve a verificar antes de insertar.
const TEMPORADA_OFICIAL = 1
const DIVISIONES_OFICIALES = [1, 2]
const GUARDADO_OFICIAL_HABILITADO = true
const caja = { border: '1px solid #d5dbe2', borderRadius: 10, padding: 18, marginTop: 18 }
const selector = { padding: 10, width: '100%', maxWidth: 580, marginTop: 6 }


// Relaciona fotografías registradas con el podio sin modificar resultados ni fotos anteriores.
function normalizarEtiqueta(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function coincideTemporadaFoto(nombreFoto, nombreTorneo) {
  const foto = normalizarEtiqueta(nombreFoto)
  const torneo = normalizarEtiqueta(nombreTorneo)
  return Boolean(foto && torneo && foto === torneo)
}

function coincideEquipoFoto(nombreFoto, nombreEquipo) {
  const foto = normalizarEtiqueta(nombreFoto)
  const equipo = normalizarEtiqueta(nombreEquipo)
  return Boolean(foto && equipo && foto === equipo)
}

function coincidePosicionFoto(posicionFoto, codigoPodio) {
  const valor = String(posicionFoto || 'campeon').toLowerCase()
  return valor === codigoPodio ||
    (codigoPodio === 'tercer_lugar' && valor === 'tercero')
}

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

// La temporada 2026 tiene dos formatos REALES por división:
// Primera (7 equipos): ida y vuelta, 42 partidos.
// Segunda (14 equipos): una vuelta, 91 partidos.
// No se usa temporadas.formato como único criterio porque figura ida_vuelta
// incluso para la Segunda División, que se disputó a una sola vuelta.
function validarFaseRegular(equipos, partidos) {
  const n = equipos.length
  if (n < 4) return { valida: false, mensaje: 'Se necesitan al menos cuatro equipos.' }
  const unaVuelta = n * (n - 1) / 2
  const idaVuelta = n * (n - 1)
  const formato = partidos.length === unaVuelta ? 'una_vuelta'
    : partidos.length === idaVuelta ? 'ida_vuelta' : null
  if (!formato) {
    return { valida: false, mensaje: `Hay ${partidos.length} partidos regulares. Para ${n} equipos se esperan ${unaVuelta} (una vuelta) o ${idaVuelta} (ida y vuelta).` }
  }
  const ids = new Set(equipos.map((e) => Number(e.id)))
  const enfrentamientos = new Map()
  for (const p of partidos) {
    const local = Number(p.local_id)
    const visitante = Number(p.visitante_id)
    const gl = Number(p.goles_local)
    const gv = Number(p.goles_visitante)
    if (p.estado !== 'finalizado' || p.goles_local == null || p.goles_visitante == null ||
      !Number.isInteger(gl) || !Number.isInteger(gv) || gl < 0 || gv < 0) {
      return { valida: false, mensaje: 'Hay partidos sin resultado final válido.' }
    }
    if (!ids.has(local) || !ids.has(visitante) || local === visitante) {
      return { valida: false, mensaje: 'Hay partidos con equipos incorrectos o no inscritos.' }
    }
    const clave = [Math.min(local, visitante), Math.max(local, visitante)].join('-')
    const cruces = enfrentamientos.get(clave) || []
    cruces.push([local, visitante])
    enfrentamientos.set(clave, cruces)
  }
  if (enfrentamientos.size !== unaVuelta) {
    return { valida: false, mensaje: 'Hay rivales repetidos o faltan enfrentamientos de la fase regular.' }
  }
  for (const cruces of enfrentamientos.values()) {
    if (formato === 'una_vuelta' && cruces.length !== 1) {
      return { valida: false, mensaje: 'Una vuelta requiere exactamente un partido por pareja de equipos.' }
    }
    if (formato === 'ida_vuelta' &&
      (cruces.length !== 2 || cruces[0][0] !== cruces[1][1] || cruces[0][1] !== cruces[1][0])) {
      return { valida: false, mensaje: 'Ida y vuelta requiere dos partidos por pareja, intercambiando local y visitante.' }
    }
  }
  return {
    valida: true, formato,
    mensaje: `Fase regular verificada: ${partidos.length} partidos finalizados (${formato === 'una_vuelta' ? 'una vuelta' : 'ida y vuelta'}).`,
  }
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

// Prepara semifinales siguiendo el CUADRO DE ELIMINACIÓN, no el orden de IDs
// ni el orden en que Supabase devuelve los partidos de cuartos o repechaje.
// Cuartos (8 equipos): (1 vs 8) vs (4 vs 5), (2 vs 7) vs (3 vs 6).
// Repechaje (6 equipos): 1 vs ganador (4 vs 5), 2 vs ganador (3 vs 6).
function crearBorradorSemifinales(preliminares, tabla, cantidad, fecha) {
  const crucesPrevios = cantidad === 8
    ? [[1, 8], [4, 5], [2, 7], [3, 6]]
    : cantidad === 6 ? [[3, 6], [4, 5]] : []
  if (!crucesPrevios.length || preliminares.length !== crucesPrevios.length) return []

  const ganadoresPorCruce = new Map()
  for (const [puestoA, puestoB] of crucesPrevios) {
    const equipoA = tabla[puestoA - 1]
    const equipoB = tabla[puestoB - 1]
    if (!equipoA || !equipoB) {
      throw new Error('Faltan equipos en la clasificación oficial para generar las semifinales.')
    }

    // Local y visitante pueden estar invertidos. Solo importan los dos equipos
    // del cruce original, que se identifican por su posición en la tabla regular.
    const partidosDelCruce = preliminares.filter((p) =>
      (Number(p.local_id) === Number(equipoA.id) &&
        Number(p.visitante_id) === Number(equipoB.id)) ||
      (Number(p.local_id) === Number(equipoB.id) &&
        Number(p.visitante_id) === Number(equipoA.id))
    )
    if (partidosDelCruce.length !== 1) {
      throw new Error(`Se esperaba exactamente un partido de ${puestoA}.º vs ${puestoB}.º (${equipoA.nombre} vs ${equipoB.nombre}). Revisa los cuartos/repechaje guardados; no se modificó ningún resultado.`)
    }

    // Cuartos y repechaje: si hay empate, avanza el mejor clasificado.
    // Esta regla NO usa penales (reservados para final y tercer lugar).
    const partidoPrevio = partidosDelCruce[0]
    const gl = Number(partidoPrevio.goles_local)
    const gv = Number(partidoPrevio.goles_visitante)
    if (partidoPrevio.estado !== 'finalizado' ||
      partidoPrevio.goles_local == null || partidoPrevio.goles_visitante == null ||
      ![gl, gv].every((n) => Number.isSafeInteger(n) && n >= 0)) {
      throw new Error(`Falta el resultado definitivo de ${equipoA.nombre} vs ${equipoB.nombre}.`)
    }

    const ganadorId = gl === gv
      ? Number(equipoA.id) // puestoA siempre es el mejor clasificado del cruce
      : gl > gv
        ? Number(partidoPrevio.local_id)
        : Number(partidoPrevio.visitante_id)
    ganadoresPorCruce.set(`${puestoA}-${puestoB}`, ganadorId)
  }

  const cruces = cantidad === 8
    ? [[ganadoresPorCruce.get('1-8'), ganadoresPorCruce.get('4-5')],
       [ganadoresPorCruce.get('2-7'), ganadoresPorCruce.get('3-6')]]
    : [[tabla[0]?.id, ganadoresPorCruce.get('4-5')],
       [tabla[1]?.id, ganadoresPorCruce.get('3-6')]]

  const usados = cruces.flat().map(Number)
  if (usados.some((id) => !Number.isInteger(id) || id <= 0) ||
      new Set(usados).size !== 4) {
    throw new Error('Los clasificados a semifinales están incompletos o repetidos. Revisa los cruces guardados.')
  }
  const nombre = (id) => tabla.find((e) => Number(e.id) === Number(id))?.nombre || `Equipo ${id}`
  return cruces.map(([localId, visitanteId], indice) => ({
    numero: indice + 1, etapa: 'Semifinales',
    localId, visitanteId, local: nombre(localId), visitante: nombre(visitanteId),
    fecha, hora: '', campoId: '',
  }))
}

// En semifinales, si hay empate avanza el equipo mejor clasificado de la temporada regular.
// Los penales se reservan exclusivamente para la final y el tercer lugar.
function crearBorradorFinales(semifinales, tabla, fecha) {
  if (semifinales.length !== 2) return []
  const posiciones = new Map(tabla.map((equipo, indice) => [Number(equipo.id), indice + 1]))
  const resultados = semifinales.map((p) => {
    if (p.estado !== 'finalizado' || p.goles_local == null || p.goles_visitante == null) return null
    const gl = Number(p.goles_local)
    const gv = Number(p.goles_visitante)
    const localId = Number(p.local_id)
    const visitanteId = Number(p.visitante_id)
    if (![gl, gv, localId, visitanteId].every(Number.isInteger) ||
      gl < 0 || gv < 0 || localId <= 0 || visitanteId <= 0 || localId === visitanteId) return null

    let ganadorId
    if (gl === gv) {
      const puestoLocal = posiciones.get(localId)
      const puestoVisitante = posiciones.get(visitanteId)
      if (!puestoLocal || !puestoVisitante || puestoLocal === puestoVisitante) return null
      ganadorId = puestoLocal < puestoVisitante ? localId : visitanteId
    } else {
      ganadorId = gl > gv ? localId : visitanteId
    }
    return {
      ganadorId,
      perdedorId: ganadorId === localId ? visitanteId : localId,
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

// Determina el podio con los resultados oficiales.
// Solo la final y el tercer lugar empatados se resuelven con penales registrados.
function resolverResultadoEliminatoria(partido) {
  if (!partido || partido.estado !== 'finalizado' ||
    partido.goles_local == null || partido.goles_visitante == null) {
    return { estado: 'pendiente', ganadorId: null, perdedorId: null }
  }
  const golesLocal = Number(partido.goles_local)
  const golesVisitante = Number(partido.goles_visitante)
  if (!Number.isInteger(golesLocal) || !Number.isInteger(golesVisitante) ||
    golesLocal < 0 || golesVisitante < 0 ||
    Number(partido.local_id) === Number(partido.visitante_id)) {
    return { estado: 'pendiente', ganadorId: null, perdedorId: null }
  }
  const localId = Number(partido.local_id)
  const visitanteId = Number(partido.visitante_id)
  if (![localId, visitanteId].every(Number.isInteger) || localId <= 0 || visitanteId <= 0) {
    return { estado: 'pendiente', ganadorId: null, perdedorId: null }
  }
  let ganadorId
  if (golesLocal === golesVisitante) {
    if (!['final', 'tercer_lugar'].includes(String(partido.fase || '').toLowerCase())) {
      return { estado: 'pendiente', ganadorId: null, perdedorId: null }
    }
    const pl = partido.penales_local == null ? null : Number(partido.penales_local)
    const pv = partido.penales_visitante == null ? null : Number(partido.penales_visitante)
    if (!Number.isInteger(pl) || !Number.isInteger(pv) || pl < 0 || pv < 0 || pl === pv) {
      return { estado: 'penales_pendientes', ganadorId: null, perdedorId: null }
    }
    ganadorId = pl > pv ? localId : visitanteId
  } else {
    ganadorId = golesLocal > golesVisitante ? localId : visitanteId
  }
  return {
    estado: 'definido',
    ganadorId,
    perdedorId: ganadorId === localId ? visitanteId : localId,
  }
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
  const [fotosFinalistas, setFotosFinalistas] = useState([])
  const [errorFotos, setErrorFotos] = useState('')

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
          supabase.from('temporadas').select('id,nombre,activa,formato').order('id', { ascending: false }),
          supabase.from('divisiones').select('id,nombre,temporada_id').order('id'),
        ])
        if (!vigente) return
        if (resTemporadas.error || resDivisiones.error) throw new Error('No se pudieron cargar temporadas y divisiones.')
        const lista = resTemporadas.data || []
        setTemporadas(lista)
        setDivisiones(resDivisiones.data || [])
        const oficial = lista.find((t) => Number(t.id) === TEMPORADA_OFICIAL)
        setTemporadaId(String((oficial || lista[0])?.id || ''))
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
  const esTemporadaOficial = Number(temporadaId) === TEMPORADA_OFICIAL &&
    DIVISIONES_OFICIALES.includes(Number(divisionId)) &&
    Number(divisionActual?.temporada_id) === TEMPORADA_OFICIAL

  // Abrir por defecto Segunda División 2026, donde ya terminó la fase regular.
  useEffect(() => {
    const preferida = Number(temporadaId) === TEMPORADA_OFICIAL
      ? divisionesTorneo.find((d) => Number(d.id) === 2) : null
    setDivisionId(String((preferida || divisionesTorneo[0])?.id || ''))
  }, [temporadaId, divisionesTorneo])


  // Lectura solamente: nunca escribe en campeones, temporadas o partidos.
  useEffect(() => {
    let vigente = true
    async function cargarFotos() {
      setFotosFinalistas([])
      setErrorFotos('')
      if (!divisionId || !temporadaId) return
      try {
        const registros = []
        // Paginación para que las fotografías históricas sigan siendo accesibles.
        for (let desde = 0; ; desde += 500) {
          const { data, error: errorConsulta } = await supabase
            .from('campeones')
            .select('id,temporada,division,equipo,posicion,foto_path,created_at')
            .order('created_at', { ascending: false })
            .range(desde, desde + 499)
          if (errorConsulta) throw errorConsulta
          registros.push(...(data || []))
          if ((data || []).length < 500) break
        }
        if (vigente) setFotosFinalistas(registros)
      } catch (err) {
        if (vigente) setErrorFotos('No se pudieron cargar las fotos: ' + (err.message || 'Error desconocido'))
      }
    }
    cargarFotos()
    return () => { vigente = false }
  }, [temporadaId, divisionId])

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
              .select('id,jornada_id,local_id,visitante_id,goles_local,goles_visitante,penales_local,penales_visitante,estado,fecha,hora,campo_id,fase')
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
  const validacionRegular = useMemo(() => validarFaseRegular(equipos, partidos), [equipos, partidos])
  const completa = validacionRegular.valida
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
    if (!esTemporadaOficial || !divisionId || cargando || cargandoCampos || cantidad === 0) return
    if (!validacionRegular.valida) {
      setErrorBorrador(validacionRegular.mensaje)
      return
    }
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
        .in('fase', ['cuartos', 'repechaje', 'semifinal', 'final', 'tercer_lugar'])
        .order('id')
      if (errorEliminatorias) throw errorEliminatorias
      const partidosGuardados = eliminatorias || []
      const semis = partidosGuardados.filter((p) => p.fase === 'semifinal')
      const preliminares = partidosGuardados.filter((p) => ['cuartos', 'repechaje'].includes(p.fase))
      const finales = partidosGuardados.filter((p) => ['final', 'tercer_lugar'].includes(p.fase))
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
        const fechasSemis = semis.map((p) => p.fecha || p.jornadas?.fecha).filter(Boolean).sort()
        if (fechasSemis.length !== 2) throw new Error('Falta la fecha de una semifinal.')
        nuevoBorrador = crearBorradorFinales(semis, tabla, domingoSiguiente(fechasSemis[1]))
        nuevoTipo = 'finales'
      } else if (semis.length === 0) {
        if (cantidad === 4) {
          if (preliminares.length) throw new Error('Se encontraron rondas previas inesperadas.')
          nuevoBorrador = crearBorradorPrimeraRonda(tabla, cantidad, planFechas[0]?.fecha)
          nuevoTipo = 'semifinales'
        } else if (preliminares.length === 0) {
          nuevoBorrador = crearBorradorPrimeraRonda(tabla, cantidad, planFechas[0]?.fecha)
          nuevoTipo = 'preliminar'
        } else {
          const etapaEsperada = cantidad === 8 ? 'cuartos' : 'repechaje'
          const cantidadEsperada = cantidad === 8 ? 4 : 2
          if (preliminares.length !== cantidadEsperada ||
              preliminares.some((p) => p.fase !== etapaEsperada)) {
            throw new Error('Los partidos de la ronda previa están incompletos o duplicados.')
          }
          if (preliminares.some((p) => p.estado !== 'finalizado' ||
            p.goles_local == null || p.goles_visitante == null)) {
            throw new Error('Primero termina todos los partidos de cuartos o repechaje.')
          }
          const fechas = preliminares.map((p) => p.fecha || p.jornadas?.fecha).filter(Boolean).sort()
          if (fechas.length !== cantidadEsperada) throw new Error('Falta la fecha de un partido de la ronda previa.')
          nuevoBorrador = crearBorradorSemifinales(preliminares, tabla, cantidad,
            domingoSiguiente(fechas[fechas.length - 1]))
          nuevoTipo = 'semifinales'
        }
      } else {
        throw new Error('Se encontraron semifinales incompletas o duplicadas. Revisa los partidos existentes.')
      }
      if (!nuevoBorrador.length) throw new Error('Todavía no se pueden preparar estos cruces.')
      setVerificacionId((n) => n + 1)
      setBorrador(nuevoBorrador)
      setTipoBorrador(nuevoTipo)
      setMostrarBorrador(true)
    } catch (err) {
      setErrorBorrador(err.message || 'No se pudo preparar la programación.')
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
    return repetido ? `Conflicto con el partido ${repetido.numero} de la programación` : null
  }), [borrador, partidosOcupados])

  function asignarAutomaticamente() {
    if (!esTemporadaOficial || !mostrarBorrador || !borrador.length) return
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
    ['cuartos', 'repechaje', 'semifinal', 'final', 'tercer_lugar'].includes(p.fase)
  )
  // Podio calculado automáticamente de la final y el partido por tercer lugar.
  // Si hay duplicados o un empate sin ganador por penales, no se adjudica el puesto.
  const finalesRegistradas = rondasGuardadas.filter((p) => p.fase === 'final')
  const tercerosRegistrados = rondasGuardadas.filter((p) => p.fase === 'tercer_lugar')
  const resultadoFinal = resolverResultadoEliminatoria(
    finalesRegistradas.length === 1 ? finalesRegistradas[0] : null
  )
  const resultadoTercerLugar = resolverResultadoEliminatoria(
    tercerosRegistrados.length === 1 ? tercerosRegistrados[0] : null
  )
  const podio = [
    { puesto: 'Campeón', codigo: 'campeon', icono: '🥇', color: '#c99a24', fondo: '#fff9e8',
      equipoId: resultadoFinal.ganadorId },
    { puesto: 'Subcampeón', codigo: 'subcampeon', icono: '🥈', color: '#8b98a8', fondo: '#f6f8fb',
      equipoId: resultadoFinal.perdedorId },
    { puesto: 'Tercer lugar', codigo: 'tercer_lugar', icono: '🥉', color: '#b87949', fondo: '#fff7f0',
      equipoId: resultadoTercerLugar.ganadorId },
  ]
  const podioConFotos = podio.map((puesto) => {
    if (!puesto.equipoId || !temporadaActual || !divisionActual) return { ...puesto, fotoUrl: null }
    const equipoPodio = nombreEquipo(puesto.equipoId)
    const foto = fotosFinalistas.find((registro) =>
      Boolean(registro.foto_path) &&
      coincidePosicionFoto(registro.posicion, puesto.codigo) &&
      coincideTemporadaFoto(registro.temporada, temporadaActual.nombre) &&
      normalizarEtiqueta(registro.division) === normalizarEtiqueta(divisionActual.nombre) &&
      coincideEquipoFoto(registro.equipo, equipoPodio)
    )
    const fotoUrl = foto
      ? supabase.storage.from('fotos-finalistas').getPublicUrl(foto.foto_path).data.publicUrl
      : null
    return { ...puesto, fotoUrl }
  })

  const hayPreviasGuardadas = rondasGuardadas.some((p) =>
    ['cuartos', 'repechaje'].includes(p.fase)
  )
  const haySemisGuardadas = rondasGuardadas.some((p) => p.fase === 'semifinal')
  const hayFinalesGuardadas = rondasGuardadas.some((p) =>
    ['final', 'tercer_lugar'].includes(p.fase)
  )
  const tipoGuardable =
    (tipoBorrador === 'preliminar' && !hayPreviasGuardadas &&
      !haySemisGuardadas && !hayFinalesGuardadas && [6, 8].includes(cantidad)) ||
    (tipoBorrador === 'semifinales' && !haySemisGuardadas && !hayFinalesGuardadas &&
      (cantidad === 4 ? !hayPreviasGuardadas : hayPreviasGuardadas)) ||
    (tipoBorrador === 'finales' && haySemisGuardadas && !hayFinalesGuardadas)
  const cantidadBorradorEsperada = tipoBorrador === 'preliminar' && cantidad === 8 ? 4 : 2
  const idsBorrador = borrador.flatMap((p) => [Number(p.localId), Number(p.visitanteId)])
  const borradorValido = borrador.length === cantidadBorradorEsperada &&
    new Set(idsBorrador).size === idsBorrador.length &&
    borrador.every((p) => p.fecha === borrador[0]?.fecha) &&
    borrador.every((p) =>
      Number.isInteger(Number(p.localId)) && Number(p.localId) > 0 &&
      Number.isInteger(Number(p.visitanteId)) && Number(p.visitanteId) > 0 &&
      Number(p.localId) !== Number(p.visitanteId) &&
      tabla.some((e) => Number(e.id) === Number(p.localId)) &&
      tabla.some((e) => Number(e.id) === Number(p.visitanteId)) &&
      esDomingo(p.fecha) && convertirHoraAMinutos(p.hora) !== null &&
      camposDisponibles.some((c) => Number(c.id) === Number(p.campoId))
    )
  const faseRegularValidada = validacionRegular.valida
  const listoParaConfirmar = esTemporadaOficial && faseRegularValidada &&
    !cargando && !cargandoCampos && !guardando && mostrarBorrador && tipoGuardable &&
    borradorValido && disponibilidadLista && conflictosBorrador.every((m) => !m)
  // El navegador no habilita escrituras oficiales hasta instalar las RPC seguras.
  const listoParaGuardar = GUARDADO_OFICIAL_HABILITADO && listoParaConfirmar

  async function guardarPartidosLiguilla() {
    if (!GUARDADO_OFICIAL_HABILITADO || !listoParaGuardar || !esTemporadaOficial ||
      !DIVISIONES_OFICIALES.includes(Number(divisionId))) {
      setErrorBorrador('No se puede guardar todavía: revisa la programación y sus validaciones.')
      return
    }
    const esFinales = tipoBorrador === 'finales'
    const descripcion = esFinales ? 'la final y el tercer lugar' :
      tipoBorrador === 'preliminar' ?
        (cantidad === 8 ? 'los cuatro cuartos de final' : 'los dos partidos de repechaje') :
        'las dos semifinales'
    if (!window.confirm(`¿Confirmas guardar ${descripcion} de ${temporadaActual?.nombre} — ${divisionActual?.nombre}?\n\nRevisa que fechas, horarios y campos sean correctos.`)) return
    setGuardando(true)
    setErrorBorrador('')
    try {
      const partidosParaGuardar = borrador.map((p) => ({
        etapa: p.etapa === 'Final' ? 'final' :
          p.etapa === 'Tercer lugar' ? 'tercer_lugar' :
            p.etapa === 'Cuartos de final' ? 'cuartos' :
              p.etapa === 'Repechaje' ? 'repechaje' : 'semifinal',
        localId: Number(p.localId),
        visitanteId: Number(p.visitanteId),
        fecha: p.fecha,
        hora: p.hora,
        campoId: Number(p.campoId),
      }))
      const funcion = esFinales ? 'guardar_finales_liguilla_oficial' : 'guardar_liguilla_oficial'
      const { data, error: errorGuardar } = await supabase.rpc(funcion, {
        p_division_id: Number(divisionId),
        p_borrador: partidosParaGuardar,
      })
      if (errorGuardar) throw errorGuardar
      setMensajeGuardado(`Se guardaron ${data?.partidos_creados ?? borrador.length} partidos: ${descripcion}.`)
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
      <p>Consulta las clasificaciones y prepara los cruces de la liguilla oficial de <strong>Verano / Invierno 2026</strong>.</p>
      <p><strong>Etapa actual:</strong> puedes preparar, asignar campos y horarios y guardar los partidos oficialmente. Supabase volverá a validar permisos, cruces y conflictos antes de guardarlos.</p>

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
          {!completa && <p style={{ color: '#9a6700' }}><strong>Fase regular pendiente de validar.</strong> {validacionRegular.mensaje}</p>}
          {completa && <p><strong>{validacionRegular.mensaje}</strong></p>}
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
          <small>{['Repechaje', 'Cuartos de final', 'Semifinales'].includes(ronda.titulo)
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

        {(finalesRegistradas.length > 0 || tercerosRegistrados.length > 0) && <div style={caja}>
          <h2>🏆 Podio de la liguilla</h2>
          <p><strong>{temporadaActual?.nombre || 'Temporada'} — {divisionActual?.nombre || 'División'}</strong></p>
          <p>Los puestos se calculan automáticamente con los resultados guardados.</p>
          {errorFotos && <p style={{ color: '#b42318' }}>{errorFotos}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            {podioConFotos.map((posicion) => <div key={posicion.puesto} style={{
              border: `2px solid ${posicion.color}`, background: posicion.fondo,
              borderRadius: 12, padding: 18, textAlign: 'center', minHeight: 140,
            }}>
              {posicion.fotoUrl && <img
                src={posicion.fotoUrl}
                alt={`Fotografía de ${nombreEquipo(posicion.equipoId)}`}
                loading="lazy"
                style={{ width: '100%', height: 160, objectFit: 'cover',
                  borderRadius: 8, marginBottom: 12 }}
              />}
              <div style={{ fontSize: 34 }} aria-hidden="true">{posicion.icono}</div>
              <h3 style={{ margin: '8px 0' }}>{posicion.puesto}</h3>
              <p style={{ fontSize: 17, fontWeight: 'bold', margin: '10px 0' }}>
                {posicion.equipoId ? nombreEquipo(posicion.equipoId) : 'Por definir'}
              </p>
            </div>)}
          </div>
          {(resultadoFinal.estado === 'penales_pendientes' ||
            resultadoTercerLugar.estado === 'penales_pendientes') &&
            <p style={{ color: '#9a6700', fontWeight: 'bold' }}>
              ⚠ Hay un partido empatado. No se puede determinar el puesto hasta registrar
              quién ganó por penales.
            </p>}
          {(finalesRegistradas.length > 1 || tercerosRegistrados.length > 1) &&
            <p style={{ color: '#b42318', fontWeight: 'bold' }}>
              ⚠ Hay partidos finales duplicados. Revisa los registros antes de asignar el podio.
            </p>}
          <button type="button" disabled={cargando} onClick={() => setRecarga((n) => n + 1)}>
            Actualizar resultados
          </button>
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
            {!completa && <p style={{ color: '#9a6700' }}>{validacionRegular.mensaje}</p>}
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

        {esTemporadaOficial && cantidad > 0 && <div style={caja}>
          <h2>Preparar partidos — {divisionActual?.nombre} 2026</h2>
          <p>Se preparan cuartos o repechaje, después semifinales y por último final y tercer lugar. <strong>Puedes revisar fechas, horarios y campos antes de confirmar la programación. Los resultados oficiales no se modifican.</strong></p>
          <button type="button" disabled={!faseRegularValidada || cargandoCampos || cargando || guardando} onClick={prepararBorrador}>
            {cargandoCampos ? 'Consultando partidos...' : 'Preparar partidos de liguilla'}
          </button>
          <button type="button" onClick={asignarAutomaticamente}
            disabled={!mostrarBorrador || !disponibilidadLista || guardando}
            style={{ marginLeft: 10, padding: '8px 12px' }}>
            Asignar automáticamente
          </button>
          <button type="button" onClick={guardarPartidosLiguilla}
            disabled={!listoParaGuardar}
            title={GUARDADO_OFICIAL_HABILITADO ? 'Revisar y confirmar guardado' : 'Pendiente de instalar y verificar las funciones SQL oficiales en Supabase'}
            style={{ marginLeft: 10, padding: '8px 12px',
              opacity: listoParaGuardar ? 1 : 0.5,
              cursor: listoParaGuardar ? 'pointer' : 'not-allowed' }}>
            {guardando ? 'Guardando...' : 'Guardar partidos de liguilla'}
          </button>
          {!GUARDADO_OFICIAL_HABILITADO && <p style={{ color: '#9a6700', fontWeight: 'bold' }}>
            Guardado oficial pendiente: primero debemos instalar las funciones SQL seguras en Supabase.
          </p>}
          {mostrarBorrador && <p style={{ color: listoParaConfirmar ? '#166534' : '#b45309', fontWeight: 'bold' }}>
            {listoParaConfirmar
              ? '✓ Programación revisada y sin conflictos. Lista para guardar oficialmente.'
              : '⚠ Revisa resultados, horarios, campos y conflictos de la programación.'}
          </p>}
          {errorBorrador && <p style={{ color: '#b42318' }}>{errorBorrador}</p>}
          {mostrarBorrador && <>
            {!completa && <p style={{ color: '#9a6700' }}><strong>Validación pendiente:</strong> {validacionRegular.mensaje}</p>}
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
            <p style={{ color: '#9a6700' }}><strong>Importante:</strong> estas verificaciones son preliminares. El servidor deberá volver a validar fechas, horarios, campos, permisos y partidos antes de guardar.</p>
          </>}
        </div>}
        <p style={{ marginTop: 25 }}><strong>Protección:</strong> el guardado crea nuevos partidos y su jornada, sin cambiar los marcadores oficiales anteriores. Supabase verifica nuevamente permisos, cruces, campos y horarios antes de insertar.</p>
      </>}
    </main>
  )
}
