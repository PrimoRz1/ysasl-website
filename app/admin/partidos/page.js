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
  const [configLiguilla, setConfigLiguilla] = useState(null)
const [equiposClasifican, setEquiposClasifican] = useState(8)
const [formatoLiguilla, setFormatoLiguilla] = useState('top8')
const [horariosSeleccionados, setHorariosSeleccionados] = useState(['09:00', '11:00', '13:00', '15:00'])
  const [preferenciasHorario, setPreferenciasHorario] = useState([])
const [guardandoPreferencia, setGuardandoPreferencia] = useState(false)
  const [equipoPreferenciaId, setEquipoPreferenciaId] = useState('')
const [horaPreferencia, setHoraPreferencia] = useState('09:00')
const [tipoPreferencia, setTipoPreferencia] = useState('preferida')

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
      { data: camposData, error: camposError },
      { data: preferenciasData, error: preferenciasError },
    ] = await Promise.all([
      supabase
  .from('temporadas').select('id, nombre, activa, fecha_inicio, fecha_fin, formato, duracion_partido')
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
        .order('numero'),
supabase
  .from('preferencias_horario_equipo')
  .select('id, equipo_id, temporada_id, hora, tipo, activo')
  .eq('activo', true)
    ])

    if (
      temporadasError ||
      divisionesError ||
      equiposError ||
      inscripcionesError ||
      jornadasError ||
      camposError ||
preferenciasError
    ) {
      console.error({
        temporadasError,
        divisionesError,
        equiposError,
        jornadasError,
        camposError,
        preferenciasError
      })

      setError('No se pudieron cargar los datos.')
      setCargando(false)
      return
    }

    setTemporadas(temporadasData || [])
    const torneoDesdeUrl = new URLSearchParams(window.location.search).get('temporada')

if (
  torneoDesdeUrl &&
  (temporadasData || []).some(
    (t) => String(t.id) === torneoDesdeUrl
  )
) {
  setTemporadaId(torneoDesdeUrl)
}
    setDivisiones(divisionesData || [])
    setEquipos(equiposData || [])
    setInscripciones(inscripcionesData || [])
    setJornadas(jornadasData || [])
    setCampos(camposData || [])
    setPreferenciasHorario(preferenciasData || [])
    setCamposSeleccionados((camposData || []).map((campo) => Number(campo.id)))

    setCargando(false)
  }
  async function cargarConfigLiguilla(idDivision) {
  if (!idDivision) {
    setConfigLiguilla(null)
    return
  }

  const { data, error } = await supabase
    .from('configuracion_liguilla')
    .select('id, division_id, activa, equipos_clasifican, formato')
    .eq('division_id', Number(idDivision))
    .maybeSingle()

  if (error) {
    console.error('Error cargando configuración de liguilla:', error)
    return
  }

  setConfigLiguilla(data || null)

  if (data) {
    setEquiposClasifican(data.equipos_clasifican || 8)
    setFormatoLiguilla(data.formato || 'top8')
  } else {
    setEquiposClasifican(8)
    setFormatoLiguilla('top8')
  }
}
  async function guardarConfigLiguilla() {
  if (!divisionId) {
    alert('Selecciona una división.')
    return
  }

  const datos = {
    division_id: Number(divisionId),
    activa: true,
    equipos_clasifican: Number(equiposClasifican),
    formato: formatoLiguilla
  }

  const { data, error } = await supabase
    .from('configuracion_liguilla')
    .upsert(datos, { onConflict: 'division_id' })
    .select()
    .single()

  if (error) {
    console.error('Error guardando configuración de liguilla:', error)
    alert('No se pudo guardar la configuración de Liguilla.')
    return
  }

  setConfigLiguilla(data)
  alert('Configuración de Liguilla guardada.')
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
  async function guardarPreferenciaHorario() {
  if (!equipoPreferenciaId || !divisionId) {
    setMensaje('Selecciona un equipo.')
    return
  }

  const divisionSeleccionada = divisiones.find(
    (division) => Number(division.id) === Number(divisionId)
  )

  if (!divisionSeleccionada) {
    setMensaje('No se encontró la división seleccionada.')
    return
  }

  setGuardandoPreferencia(true)
  setMensaje('')

  const { data, error } = await supabase
    .from('preferencias_horario_equipo')
    .upsert(
      {
        equipo_id: Number(equipoPreferenciaId),
        temporada_id: Number(divisionSeleccionada.temporada_id),
        hora: horaPreferencia,
        tipo: tipoPreferencia,
        activo: true
      },
      {
        onConflict: 'equipo_id,temporada_id'
      }
    )
    .select()

  if (error) {
    console.error(error)
    setMensaje(`Error al guardar preferencia: ${error.message}`)
    setGuardandoPreferencia(false)
    return
  }

  setPreferenciasHorario((actuales) => {
    const restantes = actuales.filter(
      (item) =>
        !(
          Number(item.equipo_id) === Number(equipoPreferenciaId) &&
          Number(item.temporada_id) === Number(divisionSeleccionada.temporada_id)
        )
    )

    return [...restantes, ...(data || [])]
  })

  setMensaje('Preferencia de horario guardada correctamente.')
  setGuardandoPreferencia(false)
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
}const asignaciones = partidosPendientes.map((partido) => {
  const preferenciaLocal = preferenciasHorario.find(
  (preferencia) =>
    Number(preferencia.equipo_id) === Number(partido.local_id) &&
    Number(preferencia.temporada_id) ===
      Number(
        divisiones.find(
          (division) => Number(division.id) === Number(divisionId)
        )?.temporada_id
      ) &&
    preferencia.activo
)

  const preferenciaVisitante = preferenciasHorario.find(
  (preferencia) =>
    Number(preferencia.equipo_id) === Number(partido.visitante_id) &&
    Number(preferencia.temporada_id) ===
      Number(
        divisiones.find(
          (division) => Number(division.id) === Number(divisionId)
        )?.temporada_id
      ) &&
    preferencia.activo
)

  let indiceEspacio = -1

  if (preferenciaLocal) {
    const horaPreferida = preferenciaLocal.hora.slice(0, 5)

    indiceEspacio = espaciosDisponibles.findIndex(
      (espacio) => espacio.hora === horaPreferida
    )
  }

  if (indiceEspacio === -1 && preferenciaVisitante) {
    const horaPreferida = preferenciaVisitante.hora.slice(0, 5)

    indiceEspacio = espaciosDisponibles.findIndex(
      (espacio) => espacio.hora === horaPreferida
    )
  }

  if (indiceEspacio === -1) {
    indiceEspacio = 0
  }

  const espacio = espaciosDisponibles.splice(indiceEspacio, 1)[0]

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
  
    const { data: jornadasExistentes, error: errorJornadas } = await supabase
  .from('jornadas')
  .select('id')
  .eq('division_id', Number(divisionId))
  .limit(1)

if (errorJornadas) {
  console.error('Error verificando jornadas existentes:', errorJornadas)
  setMensaje('No se pudo verificar si ya existe un calendario.')
  return
}

if (jornadasExistentes && jornadasExistentes.length > 0) {
  setMensaje(
    'Esta división ya tiene un calendario generado. No se crearán jornadas duplicadas.'
  )
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
    const jornadasPorVuelta = totalEquipos - 1
const totalJornadas =
  temporadaSeleccionada.formato === 'ida'
    ? jornadasPorVuelta
    : jornadasPorVuelta * 2
    const partidosPorJornada = totalEquipos / 2
    const duracionPartido = Number(temporadaSeleccionada.duracion_partido || 90)
const intervaloPartidos = duracionPartido + 15

    let rotacion = [...listaEquipos]
const { data: diasConfigurados, error: errorDias } = await supabase
  .from('dias_juego_temporada')
  .select('dia_semana')
  .eq('temporada_id', temporadaSeleccionada.id)
  .eq('activo', true)
  .order('dia_semana')

if (errorDias) {
  console.error(errorDias)
  throw errorDias
}

const diasPermitidos = (diasConfigurados || []).map(
  (item) => Number(item.dia_semana)
)

if (diasPermitidos.length === 0) {
  throw new Error('El torneo no tiene días de juego configurados.')
}
    const fechaInicial = new Date(
      `${temporadaSeleccionada.fecha_inicio}T12:00:00`
    )

    while (!diasPermitidos.includes(fechaInicial.getDay())) {
  fechaInicial.setDate(fechaInicial.getDate() + 1)
}

    for (let numeroJornada = 1; numeroJornada <= totalJornadas; numeroJornada++) {
      const fechaJornada = new Date(fechaInicial)

if (numeroJornada > 1) {
  fechaJornada.setDate(fechaJornada.getDate() + 1)

  while (!diasPermitidos.includes(fechaJornada.getDay())) {
    fechaJornada.setDate(fechaJornada.getDate() + 1)
  }
}

fechaInicial.setTime(fechaJornada.getTime())

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
        const equipoA = rotacion[i]
const equipoB = rotacion[totalEquipos - 1 - i]

const local = numeroJornada <= jornadasPorVuelta ? equipoA : equipoB
const visitante = numeroJornada <= jornadasPorVuelta ? equipoB : equipoA

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
// Al terminar la primera vuelta, reiniciamos la rotación
// para repetir los mismos cruces con localía invertida.
if (numeroJornada === jornadasPorVuelta) {
  rotacion = [...listaEquipos]
} else {
  const fijo = rotacion[0]
  const resto = rotacion.slice(1)
  resto.unshift(resto.pop())
  rotacion = [fijo, ...resto]
}
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
  async function generarHorariosCamposTodaLiga() {
  setMensaje('')

  if (!divisionId) {
    setMensaje('Selecciona una división.')
    return
  }

  if (horariosSeleccionados.length === 0) {
    setMensaje('Selecciona por lo menos un horario.')
    return
  }

  if (camposSeleccionados.length === 0) {
    setMensaje('Selecciona por lo menos un campo.')
    return
  }

  const divisionSeleccionada = divisiones.find(
    (division) => Number(division.id) === Number(divisionId)
  )

  if (!divisionSeleccionada) {
    setMensaje('No se encontró la división seleccionada.')
    return
  }

  const confirmar = window.confirm(
    'Se asignarán automáticamente horarios y campos a todos los partidos pendientes de esta división. ¿Continuar?'
  )

  if (!confirmar) return

  setGuardando(true)

  try {
    // Traer todas las jornadas de esta división.
    const { data: jornadasLiga, error: jornadasError } = await supabase
      .from('jornadas')
      .select('id, numero, fecha')
      .eq('division_id', Number(divisionId))
      .order('numero')

    if (jornadasError) throw jornadasError

    if (!jornadasLiga || jornadasLiga.length === 0) {
      throw new Error('Esta división no tiene jornadas.')
    }

    const jornadaIds = jornadasLiga.map((jornada) => jornada.id)

    // Traer todos los partidos de la división.
    const { data: partidosLiga, error: partidosError } = await supabase
      .from('partidos')
      .select(
        'id, jornada_id, local_id, visitante_id, fecha, hora, campo_id, estado'
      )
      .in('jornada_id', jornadaIds)
      .order('fecha')
      .order('jornada_id')
      .order('id')

    if (partidosError) throw partidosError

    if (!partidosLiga || partidosLiga.length === 0) {
      throw new Error('Esta división no tiene partidos.')
    }

    // Preferencias correspondientes a la temporada de esta división.
    const preferenciasLiga = preferenciasHorario.filter(
      (preferencia) =>
        Number(preferencia.temporada_id) ===
          Number(divisionSeleccionada.temporada_id) &&
        preferencia.activo
    )

    const obtenerPreferencia = (equipoId) =>
      preferenciasLiga.find(
        (preferencia) => Number(preferencia.equipo_id) === Number(equipoId)
      )

    // Contador por equipo y horario para repartir los horarios justamente.
    const contador = {}

    const prepararEquipo = (equipoId) => {
      if (!contador[equipoId]) {
        contador[equipoId] = {}
        horariosSeleccionados.forEach((horario) => {
          contador[equipoId][horario] = 0
        })
      }
    }

    partidosLiga.forEach((partido) => {
      prepararEquipo(partido.local_id)
      prepararEquipo(partido.visitante_id)

      // Contar también horarios que ya fueron asignados manualmente.
      if (
        partido.hora &&
        horariosSeleccionados.includes(partido.hora.slice(0, 5))
      ) {
        const horarioActual = partido.hora.slice(0, 5)
        contador[partido.local_id][horarioActual]++
        contador[partido.visitante_id][horarioActual]++
      }
    })

    let totalActualizados = 0
    const actualizacionesPendientes = []

    // Trabajamos jornada por jornada para no repetir campo/hora.
    for (const jornada of jornadasLiga) {
      const partidosJornadaLiga = partidosLiga.filter(
        (partido) => Number(partido.jornada_id) === Number(jornada.id)
      )

      // Respetar espacios que ya fueron asignados manualmente.
      const espaciosOcupados = new Set(
        partidosJornadaLiga
          .filter((partido) => partido.hora && partido.campo_id)
          .map(
            (partido) =>
              `${partido.hora.slice(0, 5)}-${Number(partido.campo_id)}`
          )
      )

      const pendientes = partidosJornadaLiga.filter(
        (partido) => !partido.hora || !partido.campo_id
      )

      for (const partido of pendientes) {
        prepararEquipo(partido.local_id)
        prepararEquipo(partido.visitante_id)

        const prefLocal = obtenerPreferencia(partido.local_id)
        const prefVisitante = obtenerPreferencia(partido.visitante_id)

        const candidatos = []

        horariosSeleccionados.forEach((horario) => {
          camposSeleccionados.forEach((campoSeleccionado) => {
            const campoNumero = Number(campoSeleccionado)
            const clave = `${horario}-${campoNumero}`

            if (espaciosOcupados.has(clave)) return

            let puntuacion =
              contador[partido.local_id][horario] +
              contador[partido.visitante_id][horario]

            // Preferencia normal: ayuda a escoger ese horario,
            // pero conserva el equilibrio general.
            if (prefLocal?.hora?.slice(0, 5) === horario) {
              puntuacion -=
                prefLocal.tipo === 'obligatoria' ? 10000 : 100
            }

            if (prefVisitante?.hora?.slice(0, 5) === horario) {
              puntuacion -=
                prefVisitante.tipo === 'obligatoria' ? 10000 : 100
            }

            // Una preferencia obligatoria es una regla estricta.
// Si este horario no coincide, no puede ser candidato.
if (
  prefLocal?.tipo === 'obligatoria' &&
  prefLocal.hora?.slice(0, 5) !== horario
) {
  return
}

if (
  prefVisitante?.tipo === 'obligatoria' &&
  prefVisitante.hora?.slice(0, 5) !== horario
) {
  return
}

            candidatos.push({
              hora: horario,
              campo_id: campoNumero,
              puntuacion
            })
          })
        })

        if (candidatos.length === 0) {
  const nombreLocal =
    equipos.find((equipo) => Number(equipo.id) === Number(partido.local_id))
      ?.nombre || 'Equipo local'

  const nombreVisitante =
    equipos.find(
      (equipo) => Number(equipo.id) === Number(partido.visitante_id)
    )?.nombre || 'Equipo visitante'

  if (
    prefLocal?.tipo === 'obligatoria' &&
    prefVisitante?.tipo === 'obligatoria' &&
    prefLocal.hora?.slice(0, 5) !== prefVisitante.hora?.slice(0, 5)
  ) {
    throw new Error(
      `Conflicto de horarios obligatorios en Jornada ${jornada.numero}: ${nombreLocal} requiere ${prefLocal.hora.slice(0, 5)} y ${nombreVisitante} requiere ${prefVisitante.hora.slice(0, 5)}.`
    )
  }

    const horarioObligatorio =
  prefLocal?.tipo === 'obligatoria'
    ? prefLocal.hora?.slice(0, 5)
    : prefVisitante?.tipo === 'obligatoria'
      ? prefVisitante.hora?.slice(0, 5)
      : null

if (horarioObligatorio) {
  throw new Error(
    `No hay suficientes campos disponibles en la Jornada ${jornada.numero} para cumplir el horario obligatorio de las ${horarioObligatorio}.`
  )
}

throw new Error(
  `No hay suficientes campos y horarios disponibles para la Jornada ${jornada.numero}.`
)
}

        candidatos.sort((a, b) => {
          if (a.puntuacion !== b.puntuacion) {
            return a.puntuacion - b.puntuacion
          }

          const indiceHoraA = horariosSeleccionados.indexOf(a.hora)
          const indiceHoraB = horariosSeleccionados.indexOf(b.hora)

          if (indiceHoraA !== indiceHoraB) {
            return indiceHoraA - indiceHoraB
          }

          return a.campo_id - b.campo_id
        })

        const mejor = candidatos[0]

        actualizacionesPendientes.push({
  id: partido.id,
  hora: mejor.hora,
  campo_id: mejor.campo_id
})

        espaciosOcupados.add(`${mejor.hora}-${mejor.campo_id}`)

        contador[partido.local_id][mejor.hora]++
        contador[partido.visitante_id][mejor.hora]++

        totalActualizados++
      }
    }
    for (const actualizacion of actualizacionesPendientes) {
  const { error: actualizarError } = await supabase
    .from('partidos')
    .update({
      hora: actualizacion.hora,
      campo_id: actualizacion.campo_id
    })
    .eq('id', actualizacion.id)

  if (actualizarError) throw actualizarError
}

    setMensaje(
      `Horarios y campos generados para toda la división. ${totalActualizados} partidos actualizados.`
    )

    if (jornadaId) {
      await cargarPartidosJornada(jornadaId)
    }
  } catch (error) {
    console.error(error)
    setMensaje(`Error al generar toda la liga: ${error.message}`)
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
    onClick={generarCalendarioAutomatico}
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
              onChange={(e) => {
  const nuevaDivisionId = e.target.value
  setDivisionId(nuevaDivisionId)
  setConfigLiguilla(null)
  cargarConfigLiguilla(nuevaDivisionId)
}}
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
{/* CONFIGURACIÓN LIGUILLA */}
{divisionId && (
  <div
    style={{
      marginBottom: '20px',
      padding: '15px',
      border: '1px solid #ccc',
      borderRadius: '8px'
    }}
  >
    <h3>Configuración de Liguilla</h3>

    <label>
      <strong>Equipos que clasifican</strong>
    </label>

    <select
      value={equiposClasifican}
      onChange={(e) => {
        const cantidad = Number(e.target.value)
        setEquiposClasifican(cantidad)
        setFormatoLiguilla(cantidad === 6 ? 'top6' : 'top8')
      }}
      style={{
        width: '100%',
        padding: '10px',
        marginTop: '6px',
        marginBottom: '12px'
      }}
    >
      <option value={6}>6 equipos</option>
      <option value={8}>8 equipos</option>
    </select>

    <div style={{ marginBottom: '12px' }}>
      <strong>Formato:</strong>{' '}
      {equiposClasifican === 6
        ? '1.º y 2.º pasan directo; 3.º vs 6.º y 4.º vs 5.º'
        : '1.º vs 8.º, 2.º vs 7.º, 3.º vs 6.º y 4.º vs 5.º'}
    </div>

    <button
      type="button"
      onClick={guardarConfigLiguilla}
      style={{
        padding: '10px 16px',
        fontWeight: 'bold',
        cursor: 'pointer'
      }}
    >
      Guardar configuración de Liguilla
    </button>
  </div>
)}

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
  <div style={{ marginTop: '20px', marginBottom: '20px' }}>
  <strong>Preferencias de horario por equipo:</strong>

  <div style={{ marginTop: '10px' }}>
    <select
      value={equipoPreferenciaId}
      onChange={(e) => {
  const nuevoEquipoId = e.target.value
  setEquipoPreferenciaId(nuevoEquipoId)

  const temporadaIdActual = divisiones.find(
  (division) => Number(division.id) === Number(divisionId)
)?.temporada_id

const preferenciaGuardada = preferenciasHorario.find(
  (preferencia) =>
    Number(preferencia.equipo_id) === Number(nuevoEquipoId) &&
    Number(preferencia.temporada_id) === Number(temporadaIdActual) &&
    preferencia.activo
)

  if (preferenciaGuardada) {
    setHoraPreferencia(preferenciaGuardada.hora.slice(0, 5))
    setTipoPreferencia(preferenciaGuardada.tipo)
  } else {
    setHoraPreferencia('09:00')
    setTipoPreferencia('preferida')
  }
}}
    >
      <option value="">Seleccionar equipo</option>

      {equipos
  .filter((equipo) =>
    inscripciones.some(
      (inscripcion) =>
        Number(inscripcion.equipo_id) === Number(equipo.id) &&
        Number(inscripcion.division_id) === Number(divisionId) &&
        inscripcion.activo
    )
  )
  .map((equipo) => (
        <option key={equipo.id} value={equipo.id}>
          {equipo.nombre}
        </option>
      ))}
    </select>

    <select
      value={horaPreferencia}
      onChange={(e) => setHoraPreferencia(e.target.value)}
      style={{ marginLeft: '10px' }}
    >
      <option value="09:00">9:00 AM</option>
      <option value="11:00">11:00 AM</option>
      <option value="13:00">1:00 PM</option>
      <option value="15:00">3:00 PM</option>
    </select>

    <select
      value={tipoPreferencia}
      onChange={(e) => setTipoPreferencia(e.target.value)}
      style={{ marginLeft: '10px' }}
    >
      <option value="preferida">Preferida</option>
      <option value="obligatoria">Obligatoria</option>
    </select>

    <button
      type="button"
      onClick={guardarPreferenciaHorario}
      disabled={guardandoPreferencia}
      style={{ marginLeft: '10px' }}
    >
      {guardandoPreferencia ? 'Guardando...' : 'Guardar preferencia'}
    </button>
  </div>
</div>
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
<button
  type="button"
  onClick={generarHorariosCamposTodaLiga}
  disabled={guardando}
  style={{
    width: '100%',
    padding: '12px',
    marginTop: '10px',
    fontWeight: 'bold',
    cursor: 'pointer'
  }}
>
  {guardando
    ? 'Generando...'
    : 'Generar horarios y campos de toda la liga'}
</button>

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
