'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

// Configuración de torneos nuevos. No modifica calendarios ya existentes.
// La temporada oficial Verano / Invierno 2026 (id 1) queda excluida.
const TEMPORADA_PROTEGIDA = 1
const HORARIOS = [
  ['09:00', '9:00 AM'],
  ['11:00', '11:00 AM'],
  ['13:00', '1:00 PM'],
  ['15:00', '3:00 PM'],
]

const caja = { border: '1px solid #ddd', borderRadius: 10, padding: 20, marginTop: 20 }
const control = { padding: '9px', margin: '6px 10px 8px 0', maxWidth: '100%' }
const boton = { padding: '10px 15px', cursor: 'pointer', margin: '6px 8px 6px 0' }

function siguienteDomingo(fechaTexto) {
  const fecha = new Date(`${fechaTexto}T12:00:00Z`)
  if (Number.isNaN(fecha.getTime())) throw new Error('La fecha de inicio no es válida.')
  const dias = (7 - fecha.getUTCDay()) || 7 // Siempre el domingo posterior
  fecha.setUTCDate(fecha.getUTCDate() + dias)
  return fecha
}

function sumarSemanas(fecha, semanas) {
  const nueva = new Date(fecha)
  nueva.setUTCDate(nueva.getUTCDate() + semanas * 7)
  return nueva.toISOString().slice(0, 10)
}
function seTraslapan(horaA, horaB) {
  const [hA, mA] = String(horaA).slice(0, 5).split(':').map(Number)
  const [hB, mB] = String(horaB).slice(0, 5).split(':').map(Number)

  const minutosA = hA * 60 + mA
  const minutosB = hB * 60 + mB

  return Math.abs(minutosA - minutosB) < 120
}
function crearCruces(ids, formato) {
  const original = [...ids]
  if (original.length % 2) original.push(null) // Descanso para división impar
  const cantidad = original.length
  const porVuelta = cantidad - 1
  const vueltas = formato === 'ida' ? 1 : 2
  const jornadas = []

  for (let vuelta = 0; vuelta < vueltas; vuelta++) {
    let rotacion = [...original]
    for (let ronda = 0; ronda < porVuelta; ronda++) {
      const partidos = []
      for (let i = 0; i < cantidad / 2; i++) {
        const a = rotacion[i]
        const b = rotacion[cantidad - 1 - i]
        if (a !== null && b !== null) {
          partidos.push({
            local_id: vuelta === 0 ? a : b,
            visitante_id: vuelta === 0 ? b : a,
          })
        }
      }
      jornadas.push(partidos)
      const fijo = rotacion[0]
      const resto = rotacion.slice(1)
      resto.unshift(resto.pop())
      rotacion = [fijo, ...resto]
    }
  }
  return jornadas
}

export default function ConfigurarTorneoPage() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [temporadas, setTemporadas] = useState([])
  const [divisiones, setDivisiones] = useState([])
  const [equipos, setEquipos] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [campos, setCampos] = useState([])
  const [preferencias, setPreferencias] = useState([])
  const [temporadaId, setTemporadaId] = useState('')
  const [nombre, setNombre] = useState('')
  const [fechaInicio, setFechaInicio] = useState('')
  const [formato, setFormato] = useState('ida_vuelta')
  const [duracion, setDuracion] = useState('90')
  const [fechaCorregida, setFechaCorregida] = useState('')
  const [fechasDivisiones, setFechasDivisiones] = useState({})
  const [nombreDivision, setNombreDivision] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [nombreEquipo, setNombreEquipo] = useState('')
  const [equipoExistenteId, setEquipoExistenteId] = useState('')
  const [horariosElegidos, setHorariosElegidos] = useState(['09:00', '11:00', '13:00', '15:00'])
  const [camposElegidos, setCamposElegidos] = useState(null)
  const [plan, setPlan] = useState(null)

  useEffect(() => {
    async function iniciar() {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user) {
        router.replace('/login')
        return
      }
      const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).maybeSingle()
      if (perfil?.rol !== 'admin') {
        router.replace('/admin')
        return
      }
      setAutorizado(true)
      await cargarDatos()
      setVerificando(false)
    }
    iniciar()
  }, [router])

  async function cargarDatos() {
    const resultados = await Promise.all([
      supabase.from('temporadas').select('id, nombre, activa, fecha_inicio, formato').order('id', { ascending: false }),
      supabase.from('divisiones').select('id, nombre, temporada_id, orden, fecha_inicio').order('orden'),
      supabase.from('equipos').select('id, nombre, activo').order('nombre'),
      supabase.from('inscripciones_equipo').select('id, equipo_id, division_id, activo'),
      supabase.from('campos').select('id, nombre, numero, activo').eq('activo', true).order('numero'),
      supabase.from('preferencias_horario_equipo').select('equipo_id, temporada_id, hora, tipo, activo').eq('activo', true),
    ])
    const fallo = resultados.find((r) => r.error)
    if (fallo) {
      setMensaje(`No se pudieron cargar los datos: ${fallo.error.message}`)
      return
    }
    const [ts, ds, es, ins, cs, prefs] = resultados.map((r) => r.data || [])
    setTemporadas(ts)
    setDivisiones(ds)
    setEquipos(es)
    setInscripciones(ins)
    setCampos(cs)
    setPreferencias(prefs)
    setCamposElegidos((actuales) => actuales === null ? cs.map((c) => Number(c.id)) : actuales)
  }

  const disponibles = temporadas.filter((t) => Number(t.id) !== TEMPORADA_PROTEGIDA && !t.activa)
  const temporada = disponibles.find((t) => String(t.id) === temporadaId)
  const divisionesTorneo = divisiones.filter((d) => Number(d.temporada_id) === Number(temporada?.id))
  const divisionActual = divisionesTorneo.find((d) => String(d.id) === divisionId)

  const equiposDivision = (idDivision) => {
    const ids = new Set(inscripciones.filter((i) => i.activo && Number(i.division_id) === Number(idDivision)).map((i) => Number(i.equipo_id)))
    return equipos.filter((e) => ids.has(Number(e.id)) && e.activo !== false)
  }

  const inscritosEnTorneo = useMemo(() => {
    const idsDivisiones = new Set(divisionesTorneo.map((d) => Number(d.id)))
    return new Set(inscripciones.filter((i) => i.activo && idsDivisiones.has(Number(i.division_id))).map((i) => Number(i.equipo_id)))
  }, [inscripciones, divisionesTorneo])

  const equiposReutilizables = equipos.filter((e) => e.activo !== false && !inscritosEnTorneo.has(Number(e.id)))

  function elegirTorneo(id) {
    setTemporadaId(id)
    setDivisionId('')
    setPlan(null)
    setMensaje('')
    const elegido = disponibles.find((t) => String(t.id) === id)
    setFechaCorregida(elegido?.fecha_inicio || '')
  }

  async function crearTorneo(e) {
    e.preventDefault()
    if (trabajando) return
    if (!nombre.trim() || !fechaInicio) return setMensaje('Escribe el nombre y la fecha de inicio.')
    if (temporadas.some((t) => t.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())) {
      return setMensaje('Ya existe un torneo con ese nombre. Selecciónalo en la lista para continuar.')
    }
    setTrabajando(true)
    setMensaje('')
    try {
      const { data, error } = await supabase.from('temporadas').insert({
        nombre: nombre.trim(), fecha_inicio: fechaInicio,
        formato, duracion_partido: Number(duracion), activa: false,
      }).select('id').single()
      if (error) throw error
      const { error: diasError } = await supabase.from('dias_juego_temporada').insert({
        temporada_id: data.id, dia_semana: 0, activo: true,
      })
      await cargarDatos()
      elegirTorneo(String(data.id))
      setFechaCorregida(fechaInicio)
      if (diasError) {
        setMensaje(`El torneo ID ${data.id} se creó, pero no se guardó el domingo como día de juego: ${diasError.message}. No lo crees de nuevo.`)
      } else {
        setMensaje('Torneo creado. Ahora agrega sus divisiones y equipos.')
      }
      setNombre('')
      setFechaInicio('')
    } catch (error) {
      setMensaje(`No se pudo crear el torneo: ${error.message}`)
    } finally {
      setTrabajando(false)
    }
  }

  async function guardarFecha() {
    if (!temporada || !fechaCorregida || trabajando) return
    setTrabajando(true)
    setMensaje('')
    try {
      const ids = divisionesTorneo.map((d) => d.id)
      if (ids.length) {
        const { data, error } = await supabase.from('jornadas').select('id').in('division_id', ids).limit(1)
        if (error) throw error
        if (data?.length) throw new Error('Este torneo ya tiene jornadas. No cambiaremos su fecha de inicio.')
      }
      const { data: actualizadas, error } = await supabase.from('temporadas').update({ fecha_inicio: fechaCorregida }).eq('id', temporada.id).select('id')
      if (error) throw error
      if (!actualizadas?.length) throw new Error('No se guardó la fecha. Revisa permisos de Supabase.')
      await cargarDatos()
      setPlan(null)
      setMensaje('Fecha de inicio actualizada.')
    } catch (error) {
      setMensaje(error.message)
    } finally {
      setTrabajando(false)
    }
  }
async function guardarFechaDivision(idDivision) {
  if (!temporada || trabajando || Number(temporada.id) === TEMPORADA_PROTEGIDA) return

  const division = divisionesTorneo.find(d => Number(d.id) === Number(idDivision))
  if (!division) return

  const fecha = fechasDivisiones[idDivision] ?? division.fecha_inicio ?? ''
  if (!fecha) return setMensaje('Selecciona una fecha para la división.')

  setTrabajando(true)
  setMensaje('')

  try {
    const { data: jornadas, error: errorJornadas } = await supabase
      .from('jornadas')
      .select('id')
      .eq('division_id', idDivision)
      .limit(1)

    if (errorJornadas) throw errorJornadas

    if (jornadas?.length) {
      throw new Error('Esta división ya tiene jornadas. No se puede cambiar su fecha de inicio.')
    }

    const { data, error } = await supabase
      .from('divisiones')
      .update({ fecha_inicio: fecha })
      .eq('id', idDivision)
      .eq('temporada_id', temporada.id)
      .select('id')

    if (error) throw error
    if (!data?.length) throw new Error('No se pudo guardar la fecha.')

    await cargarDatos()
    setPlan(null)
    setMensaje(`Fecha de ${division.nombre} guardada correctamente.`)
  } catch (error) {
    setMensaje(`Error: ${error.message}`)
  } finally {
    setTrabajando(false)
  }
}
  async function agregarDivision() {
    if (!temporada || !nombreDivision.trim() || trabajando) return
    if (divisionesTorneo.some((d) => d.nombre.toLowerCase() === nombreDivision.trim().toLowerCase())) {
      return setMensaje('Esa división ya existe en este torneo.')
    }
    setTrabajando(true)
    try {
      const orden = Math.max(0, ...divisionesTorneo.map((d) => Number(d.orden) || 0)) + 1
      const { error } = await supabase.from('divisiones').insert({
        temporada_id: temporada.id, nombre: nombreDivision.trim(), orden,
      }).select('id').single()
      if (error) throw error
      setNombreDivision('')
      setPlan(null)
      await cargarDatos()
      setMensaje('División agregada.')
    } catch (error) {
      setMensaje(`Error al agregar división: ${error.message}`)
    } finally {
      setTrabajando(false)
    }
  }

  async function agregarEquipo() {
    if (!divisionActual || trabajando) return
    const nombreLimpio = nombreEquipo.trim()
    if (!nombreLimpio && !equipoExistenteId) return setMensaje('Escribe un equipo nuevo o selecciona uno existente.')
    if (nombreLimpio && equipoExistenteId) return setMensaje('Elige una sola opción: nuevo o existente.')
    if (nombreLimpio && equipos.some((e) => e.nombre.toLowerCase() === nombreLimpio.toLowerCase())) {
      return setMensaje('Ese nombre ya existe. Selecciona el equipo existente para evitar duplicarlo.')
    }
    if (equipoExistenteId && inscritosEnTorneo.has(Number(equipoExistenteId))) {
      return setMensaje('Ese equipo ya está inscrito en una división de este torneo.')
    }
    setTrabajando(true)
    setMensaje('')
    try {
      let id = Number(equipoExistenteId)
      if (nombreLimpio) {
        const { data, error } = await supabase.from('equipos').insert({ nombre: nombreLimpio, activo: true }).select('id').single()
        if (error) throw error
        id = data.id
      }
      const { error } = await supabase.from('inscripciones_equipo').insert({
        equipo_id: id, division_id: divisionActual.id, activo: true,
      }).select('id').single()
      if (error) throw new Error(`No se pudo inscribir el equipo ID ${id}: ${error.message}. Si lo acabas de crear, no vuelvas a crearlo.`)
      setNombreEquipo('')
      setEquipoExistenteId('')
      setPlan(null)
      await cargarDatos()
      setMensaje('Equipo inscrito correctamente.')
    } catch (error) {
      setMensaje(error.message)
    } finally {
      setTrabajando(false)
    }
  }

  function cambiarHorario(hora) {
    setHorariosElegidos((actuales) => actuales.includes(hora) ? actuales.filter((h) => h !== hora) : [...actuales, hora])
    setPlan(null)
  }
  function cambiarCampo(id) {
    setCamposElegidos((actuales) => (actuales || []).includes(id) ? actuales.filter((x) => x !== id) : [...(actuales || []), id])
    setPlan(null)
  }

  async function prepararCalendario() {
    if (!temporada || trabajando) return
    setPlan(null)
    setMensaje('')
    setTrabajando(true)
    try {
      if (!temporada.fecha_inicio) throw new Error('El torneo necesita una fecha de inicio. Corrígela arriba.')
      if (fechaCorregida !== temporada.fecha_inicio) throw new Error('Primero guarda el cambio de fecha de inicio.')
      for (const division of divisionesTorneo) {
  const fechaEnPantalla = fechasDivisiones[division.id] ?? division.fecha_inicio ?? ''
  const fechaGuardada = division.fecha_inicio ?? ''

  if (fechaEnPantalla !== fechaGuardada) {
    throw new Error(`Primero guarda la fecha de inicio de ${division.nombre}.`)
  }
}
      if (!divisionesTorneo.length) throw new Error('Agrega por lo menos una división.')
      if (!horariosElegidos.length || !(camposElegidos || []).length) throw new Error('Selecciona horarios y campos.')

      const definiciones = []
      const equipoEnDivision = new Set()
      for (const division of divisionesTorneo) {
        const lista = equiposDivision(division.id)
        if (lista.length < 2) throw new Error(`${division.nombre} necesita por lo menos 2 equipos.`)
        for (const equipo of lista) {
          if (equipoEnDivision.has(equipo.id)) throw new Error(`${equipo.nombre} aparece en dos divisiones de este torneo.`)
          equipoEnDivision.add(equipo.id)
        }
        const { data: yaExiste, error } = await supabase.from('jornadas').select('id').eq('division_id', division.id).limit(1)
        if (error) throw error
        if (yaExiste?.length) throw new Error(`${division.nombre} ya tiene jornadas. No generaremos un calendario duplicado.`)
        const cruces = crearCruces(lista.map((e) => e.id), temporada.formato)
        const fechaBaseDivision = siguienteDomingo(division.fecha_inicio || temporada.fecha_inicio)
        cruces.forEach((partidos, indice) => definiciones.push({
          division_id: division.id, division_nombre: division.nombre,
          numero: indice + 1, fecha: sumarSemanas(fechaBaseDivision, indice),
          partidos: partidos.map((p) => ({ ...p })),
        }))
      }

      // Se respetan los espacios ya ocupados por cualquier torneo/división.
      const fechas = [...new Set(definiciones.map((j) => j.fecha))]
      const { data: ocupados, error: errorOcupados } = await supabase.from('partidos')
        .select('fecha, hora, campo_id').in('fecha', fechas).not('hora', 'is', null).not('campo_id', 'is', null)
        .limit(10000)
      if (errorOcupados) throw errorOcupados
      const espaciosOcupados = new Map()
      for (const partido of ocupados || []) {
  if (!espaciosOcupados.has(partido.fecha)) {
    espaciosOcupados.set(partido.fecha, [])
  }

  espaciosOcupados.get(partido.fecha).push({
    hora: String(partido.hora).slice(0, 5),
    campo_id: Number(partido.campo_id)
  })
}
      const horariosOrdenados = [...horariosElegidos].sort()
      const camposOrdenados = campos.filter((c) => (camposElegidos || []).includes(Number(c.id)))
      const preferenciaDe = (equipoId) => preferencias.find((p) => Number(p.equipo_id) === Number(equipoId) && Number(p.temporada_id) === Number(temporada.id) && p.activo)

      // Agrupamos por fecha: evita que Primera y Segunda usen el mismo campo/hora.
      definiciones.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.division_id - b.division_id || a.numero - b.numero)
      for (const jornada of definiciones) {
        if (!espaciosOcupados.has(jornada.fecha)) espaciosOcupados.set(jornada.fecha, [])
        const usados = espaciosOcupados.get(jornada.fecha)
        for (const partido of jornada.partidos) {
          const preferenciasPartido = [preferenciaDe(partido.local_id), preferenciaDe(partido.visitante_id)].filter(Boolean)
          const obligatorias = preferenciasPartido.filter((p) => p.tipo === 'obligatoria').map((p) => String(p.hora).slice(0, 5))
          if (new Set(obligatorias).size > 1) throw new Error(`Dos equipos tienen horarios obligatorios incompatibles el ${jornada.fecha}.`)
          const opciones = []
          horariosOrdenados.forEach((hora, indiceHora) => {
            if (obligatorias.length && hora !== obligatorias[0]) return
            camposOrdenados.forEach((campo, indiceCampo) => {
              const clave = `${hora}-${campo.id}`
              if (usados.some((ocupado) =>
  Number(ocupado.campo_id) === Number(campo.id) &&
  seTraslapan(ocupado.hora, hora)
)) return
              const preferenciasSuaves = preferenciasPartido.filter((p) => p.tipo !== 'obligatoria' && String(p.hora).slice(0, 5) === hora).length
              opciones.push({ hora, campo_id: campo.id, clave, puntuacion: indiceHora * 10 + indiceCampo - preferenciasSuaves * 2 })
            })
          })
          opciones.sort((a, b) => a.puntuacion - b.puntuacion)
          if (!opciones.length) throw new Error(`No hay campo/hora disponible para ${jornada.division_nombre}, Jornada ${jornada.numero} (${jornada.fecha}). Revisa horarios, campos y preferencias obligatorias.`)
          const elegido = opciones[0]
          partido.hora = elegido.hora
          partido.campo_id = elegido.campo_id
          usados.push({
  hora: elegido.hora,
  campo_id: Number(elegido.campo_id)
})
        }
      }

      const totalPartidos = definiciones.reduce((n, j) => n + j.partidos.length, 0)
      setPlan({ temporada_id: temporada.id, definiciones, totalPartidos })
      setMensaje('Vista previa lista. Revisa las cantidades antes de confirmar.')
    } catch (error) {
      setMensaje(`No se pudo preparar el calendario: ${error.message}`)
    } finally {
      setTrabajando(false)
    }
  }

  async function confirmarCalendario() {
    if (!plan || !temporada || trabajando || Number(plan.temporada_id) !== Number(temporada.id)) return
    const ok = window.confirm(`Crear ${plan.definiciones.length} jornadas y ${plan.totalPartidos} partidos en ${temporada.nombre}? No se modificarán partidos existentes.`)
    if (!ok) return
    setTrabajando(true)
    setMensaje('')
    try {
      // Nueva verificación antes de escribir, por si otro administrador creó jornadas.
      for (const division of divisionesTorneo) {
        const { data, error } = await supabase.from('jornadas').select('id').eq('division_id', division.id).limit(1)
        if (error) throw error
        if (data?.length) throw new Error(`${division.nombre} ya tiene jornadas. Vuelve a preparar la vista previa.`)
      }
      const fechas = [...new Set(plan.definiciones.map((j) => j.fecha))]
      const { data: ocupados, error: errorOcupados } = await supabase.from('partidos')
        .select('fecha, hora, campo_id').in('fecha', fechas).not('hora', 'is', null).not('campo_id', 'is', null)
        .limit(10000)
      if (errorOcupados) throw errorOcupados
      const ocupacion = new Map()

for (const partido of ocupados || []) {
  if (!ocupacion.has(partido.fecha)) {
    ocupacion.set(partido.fecha, [])
  }

  ocupacion.get(partido.fecha).push({
    hora: String(partido.hora).slice(0, 5),
    campo_id: Number(partido.campo_id)
  })
}

for (const jornada of plan.definiciones) {
  if (!ocupacion.has(jornada.fecha)) {
    ocupacion.set(jornada.fecha, [])
  }

  const usados = ocupacion.get(jornada.fecha)

  for (const partido of jornada.partidos) {
    const conflicto = usados.some((ocupado) =>
      Number(ocupado.campo_id) === Number(partido.campo_id) &&
      seTraslapan(ocupado.hora, partido.hora)
    )

    if (conflicto) {
      throw new Error(
        `Conflicto detectado: Campo ${partido.campo_id}, ` +
        `${jornada.fecha}, ${partido.hora}. ` +
        `Vuelve a generar la vista previa.`
      )
    }

    usados.push({
      hora: String(partido.hora).slice(0, 5),
      campo_id: Number(partido.campo_id)
    })
  }
}
      let creadas = 0
      for (const j of plan.definiciones) {
        const { data, error } = await supabase.from('jornadas').insert({
          division_id: j.division_id, numero: j.numero, fecha: j.fecha,
        }).select('id').single()
        if (error) throw error
        const partidos = j.partidos.map((p) => ({
          jornada_id: data.id, local_id: p.local_id, visitante_id: p.visitante_id,
          fecha: j.fecha, hora: p.hora, campo_id: p.campo_id, estado: 'programado',
        }))
        if (partidos.length) {
          const { error: errorPartidos } = await supabase.from('partidos').insert(partidos)
          if (errorPartidos) throw errorPartidos
        }
        creadas++
      }
      setPlan(null)
      setMensaje(`Calendario creado correctamente: ${creadas} jornadas y ${plan.totalPartidos} partidos, con campos y horarios.`)
    } catch (error) {
      setPlan(null)
      setMensaje(`Se detuvo la generación: ${error.message}. IMPORTANTE: podrían haberse creado algunas jornadas. Revisa los datos antes de intentar otra vez; no borres nada automáticamente.`)
    } finally {
      setTrabajando(false)
    }
  }

  if (verificando) return <main style={{ padding: 30 }}>Verificando acceso...</main>
  if (!autorizado) return null

  return (
    <main style={{ maxWidth: 1050, margin: '35px auto', padding: '0 20px 50px' }}>
      <Link href="/admin">← Volver al panel</Link>
      <h1>Configurar torneo completo</h1>
      <p>Un solo lugar para preparar un torneo nuevo. La temporada oficial 2026 está protegida.</p>
      {mensaje && <p role="status" style={{ border: '1px solid #bbb', borderRadius: 6, padding: 12, fontWeight: 600 }}>{mensaje}</p>}

      <section style={caja}>
        <h2>1. Crear o seleccionar torneo</h2>
        <select value={temporadaId} onChange={(e) => elegirTorneo(e.target.value)} style={control} disabled={trabajando}>
          <option value="">Selecciona un torneo en preparación</option>
          {disponibles.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <form onSubmit={crearTorneo} style={{ marginTop: 15 }}>
          <strong>O crear un torneo nuevo</strong>
          <div>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre, ej. Primavera 2027" style={control} />
            <label>Fecha de inicio <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={control} /></label>
          </div>
          <div>
            <label>Formato <select value={formato} onChange={(e) => setFormato(e.target.value)} style={control}>
              <option value="ida">Ida</option><option value="ida_vuelta">Ida y vuelta</option>
            </select></label>
            <label>Duración <select value={duracion} onChange={(e) => setDuracion(e.target.value)} style={control}>
              {[40, 45, 50, 55, 60, 90].map((n) => <option key={n} value={n}>{n} minutos</option>)}
            </select></label>
            <span>Se juega los domingos.</span>
          </div>
          <button style={boton} disabled={trabajando}>+ Crear torneo</button>
        </form>
      </section>

      {temporada && <>
        <section style={caja}>
          <h2>2. Fecha y divisiones de {temporada.nombre}</h2>
          <p>La primera jornada será el domingo posterior a la fecha de inicio.</p>
          <label>Fecha de inicio <input type="date" value={fechaCorregida} onChange={(e) => setFechaCorregida(e.target.value)} style={control} /></label>
          <button type="button" style={boton} onClick={guardarFecha} disabled={trabajando || !fechaCorregida || fechaCorregida === temporada.fecha_inicio}>Guardar fecha</button>
          <h3>Divisiones</h3>
          {divisionesTorneo.length ? (
  <ul>
    {divisionesTorneo.map((d) => (
      <li key={d.id} style={{ marginBottom: 15 }}>
        <strong>{d.nombre}</strong> — {equiposDivision(d.id).length} equipos

        <div>
          <label>
            Fecha de inicio de esta división:
            <input
              type="date"
              value={fechasDivisiones[d.id] ?? d.fecha_inicio ?? ''}
              onChange={(e) => {
                setFechasDivisiones((actuales) => ({
                  ...actuales,
                  [d.id]: e.target.value
                }))
                setPlan(null)
              }}
              style={control}
            />
          </label>

          <button
            type="button"
            style={boton}
            onClick={() => guardarFechaDivision(d.id)}
            disabled={
              trabajando ||
              !(fechasDivisiones[d.id] ?? d.fecha_inicio) ||
              (fechasDivisiones[d.id] ?? d.fecha_inicio) === (d.fecha_inicio ?? '')
            }
          >
            Guardar fecha
          </button>
        </div>
      </li>
    ))}
  </ul>
) : (
  <p>Agrega la primera división.</p>
)}
          <input value={nombreDivision} onChange={(e) => setNombreDivision(e.target.value)} placeholder="Ej. Primera División" style={control} />
          <button type="button" style={boton} onClick={agregarDivision} disabled={trabajando || !nombreDivision.trim()}>+ Agregar división</button>
        </section>

        <section style={caja}>
          <h2>3. Inscribir equipos</h2>
          <select value={divisionId} onChange={(e) => { setDivisionId(e.target.value); setPlan(null) }} style={control}>
            <option value="">Selecciona una división</option>
            {divisionesTorneo.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
          {divisionActual && <>
            <p><strong>{equiposDivision(divisionActual.id).length} equipos inscritos</strong></p>
            <p>{equiposDivision(divisionActual.id).map((e) => e.nombre).join(', ') || 'Sin equipos todavía'}</p>
            <p>Crear un equipo nuevo:</p>
            <input value={nombreEquipo} onChange={(e) => { setNombreEquipo(e.target.value); setEquipoExistenteId('') }} placeholder="Nombre del equipo" style={control} />
            <p>O reutilizar un equipo existente de otra temporada:</p>
            <select value={equipoExistenteId} onChange={(e) => { setEquipoExistenteId(e.target.value); setNombreEquipo('') }} style={control}>
              <option value="">Selecciona un equipo existente</option>
              {equiposReutilizables.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <div><button type="button" style={boton} onClick={agregarEquipo} disabled={trabajando || (!nombreEquipo.trim() && !equipoExistenteId)}>+ Inscribir equipo</button></div>
          </>}
        </section>

        <section style={caja}>
          <h2>4. Campos y horarios</h2>
          <p>El sistema utilizará primero los horarios más tempranos disponibles y evitará duplicar campo y hora entre divisiones.</p>
          <strong>Horarios</strong>
          <div>{HORARIOS.map(([valor, etiqueta]) => <label key={valor} style={{ display: 'inline-block', margin: '8px 16px 8px 0' }}>
            <input type="checkbox" checked={horariosElegidos.includes(valor)} onChange={() => cambiarHorario(valor)} /> {etiqueta}
          </label>)}</div>
          <strong>Campos</strong>
          <div>{campos.map((c) => <label key={c.id} style={{ display: 'inline-block', margin: '8px 16px 8px 0' }}>
            <input type="checkbox" checked={(camposElegidos || []).includes(Number(c.id))} onChange={() => cambiarCampo(Number(c.id))} /> Campo {c.numero}
          </label>)}</div>
        </section>

        <section style={caja}>
          <h2>5. Generar calendario completo</h2>
          <p>Se crearán todas las jornadas y partidos de las divisiones de este torneo, con horarios y campos asignados.</p>
          <button type="button" style={boton} onClick={prepararCalendario} disabled={trabajando}>
            {trabajando ? 'Procesando...' : 'Ver vista previa (sin guardar)'}
          </button>
          {plan && <div style={{ marginTop: 15, borderTop: '1px solid #ddd', paddingTop: 12 }}>
            <p><strong>Vista previa:</strong> {plan.definiciones.length} jornadas de división, {plan.totalPartidos} partidos.</p>
            <p>Primer domingo: {plan.definiciones[0]?.fecha}. Último domingo: {plan.definiciones[plan.definiciones.length - 1]?.fecha}.</p>
            <p>{divisionesTorneo.map((d) => `${d.nombre}: ${plan.definiciones.filter((j) => j.division_id === d.id).length} jornadas`).join(' | ')}</p>
            <button type="button" style={{ ...boton, fontWeight: 'bold' }} onClick={confirmarCalendario} disabled={trabajando}>
              Confirmar y crear calendario
            </button>
          </div>}
        </section>
      </>}
    </main>
  )
}
