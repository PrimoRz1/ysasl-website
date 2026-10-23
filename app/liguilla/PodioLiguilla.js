'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

// Página pública de SOLO LECTURA. No contiene funciones para guardar o editar.
// La temporada de pruebas se identifica expresamente para no confundirla con la oficial.
const TEMPORADA_PRUEBA = 9
const TEMPORADA_OFICIAL_2026 = 1

function tipoDivision(nombre) {
  const texto = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (texto.includes('primera')) return 'primera'
  if (texto.includes('segunda')) return 'segunda'
  return null
}

const caja = {
  border: '1px solid #d5dbe2', borderRadius: 12, padding: 20,
  background: '#fff', marginTop: 18,
}

function resolverResultado(partido) {
  if (!partido || partido.estado !== 'finalizado' ||
    partido.goles_local == null || partido.goles_visitante == null) {
    return { ganadorId: null, perdedorId: null, empate: false }
  }
  const local = Number(partido.goles_local)
  const visitante = Number(partido.goles_visitante)
  const localId = Number(partido.local_id)
  const visitanteId = Number(partido.visitante_id)
  if (![local, visitante, localId, visitanteId].every(Number.isFinite) ||
    local < 0 || visitante < 0 || localId === visitanteId) {
    return { ganadorId: null, perdedorId: null, empate: false }
  }
  if (local === visitante) {
    // Final y tercer lugar empatados se deciden por penales registrados oficialmente.
    const pl = partido.penales_local == null ? null : Number(partido.penales_local)
    const pv = partido.penales_visitante == null ? null : Number(partido.penales_visitante)
    if (Number.isInteger(pl) && Number.isInteger(pv) && pl >= 0 && pv >= 0 && pl !== pv) {
      return {
        ganadorId: pl > pv ? localId : visitanteId,
        perdedorId: pl > pv ? visitanteId : localId,
        empate: false,
      }
    }
    return { ganadorId: null, perdedorId: null, empate: true }
  }
  return {
    ganadorId: local > visitante ? localId : visitanteId,
    perdedorId: local > visitante ? visitanteId : localId,
    empate: false,
  }
}

export default function PodioLiguilla({ temporadaInicial = 1, divisionIdInicial = 0, children }) {
  const router = useRouter()

  // Los selectores conservan todas las temporadas/divisiones existentes.
  // Al cambiar se navega a la misma ruta para sincronizar el cuadro del servidor.
  function cambiarSeleccion(temporadaNueva, divisionNueva) {
    const params = new URLSearchParams({ temporada: String(temporadaNueva) })
    if (divisionNueva) params.set('divisionId', String(divisionNueva))
    window.location.assign(`/liguilla?${params.toString()}`)
  }

  const [temporadas, setTemporadas] = useState([])
  const [divisiones, setDivisiones] = useState([])
  const [temporadaId, setTemporadaId] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [partidos, setPartidos] = useState([])
  const [equipos, setEquipos] = useState([])
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true)
  const [cargandoResultados, setCargandoResultados] = useState(false)
  const [error, setError] = useState('')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    async function cargarCatalogo() {
      try {
        const [resTemporadas, resDivisiones] = await Promise.all([
          supabase.from('temporadas').select('id,nombre,activa').order('id', { ascending: false }),
          supabase.from('divisiones').select('id,nombre,temporada_id').order('id'),
        ])
        if (resTemporadas.error) throw resTemporadas.error
        if (resDivisiones.error) throw resDivisiones.error
        if (!vigente) return
        const lista = resTemporadas.data || []
        const listaDivisiones = resDivisiones.data || []
        setTemporadas(lista)
        setDivisiones(listaDivisiones)
        // Respeta el torneo elegido en la URL y evita seleccionar una prueba por defecto.
        const inicial = lista.find((t) => Number(t.id) === Number(temporadaInicial)) ||
          lista.find((t) => t.activa === true && Number(t.id) !== TEMPORADA_PRUEBA) ||
          lista.find((t) => Number(t.id) !== TEMPORADA_PRUEBA) || lista[0]
        const disponibles = listaDivisiones.filter((d) => Number(d.temporada_id) === Number(inicial?.id))
        const preferida = disponibles.find((d) => Number(d.id) === Number(divisionIdInicial)) ||
          (Number(inicial?.id) === TEMPORADA_OFICIAL_2026
            ? disponibles.find((d) => tipoDivision(d.nombre) === 'segunda') : null) ||
          disponibles[0]
        setTemporadaId(inicial ? String(inicial.id) : '')
        setDivisionId(preferida ? String(preferida.id) : '')
      } catch (err) {
        if (vigente) setError('No se pudieron cargar las temporadas. Intenta actualizar la página.')
      } finally {
        if (vigente) setCargandoCatalogo(false)
      }
    }
    cargarCatalogo()
    return () => { vigente = false }
  }, [])

  const divisionesTorneo = useMemo(() => divisiones.filter((d) =>
    Number(d.temporada_id) === Number(temporadaId)
  ), [divisiones, temporadaId])

  useEffect(() => {
    setDivisionId((actual) => divisionesTorneo.some((d) => String(d.id) === actual)
      ? actual : String(divisionesTorneo[0]?.id || ''))
  }, [divisionesTorneo])

  useEffect(() => {
    let vigente = true
    async function cargarResultados() {
      setPartidos([])
      setEquipos([])
      setError('')
      if (!divisionId) return
      const division = divisiones.find((d) => Number(d.id) === Number(divisionId))
      if (!division || Number(division.temporada_id) !== Number(temporadaId)) return
      setCargandoResultados(true)
      try {
        const resJornadas = await supabase.from('jornadas').select('id')
          .eq('division_id', Number(divisionId))
        if (resJornadas.error) throw resJornadas.error
        const ids = (resJornadas.data || []).map((j) => Number(j.id))
        const encontrados = []
        for (let i = 0; i < ids.length; i += 40) {
          const lote = ids.slice(i, i + 40)
          for (let desde = 0; ; desde += 500) {
            const res = await supabase.from('partidos')
              .select('id,local_id,visitante_id,goles_local,goles_visitante,penales_local,penales_visitante,estado,fase,fecha,hora')
              .in('jornada_id', lote)
              .in('fase', ['final', 'tercer_lugar'])
              .order('id').range(desde, desde + 499)
            if (res.error) throw res.error
            encontrados.push(...(res.data || []))
            if ((res.data || []).length < 500) break
          }
        }
        const idsEquipos = [...new Set(encontrados.flatMap((p) => [p.local_id, p.visitante_id])
          .map(Number).filter((n) => Number.isInteger(n) && n > 0))]
        let nombres = []
        if (idsEquipos.length) {
          const resEquipos = await supabase.from('equipos').select('id,nombre').in('id', idsEquipos)
          if (resEquipos.error) throw resEquipos.error
          nombres = resEquipos.data || []
        }
        if (vigente) {
          setPartidos(encontrados)
          setEquipos(nombres)
        }
      } catch (err) {
        if (vigente) setError('No se pudieron consultar los resultados. Intenta actualizar la página.')
      } finally {
        if (vigente) setCargandoResultados(false)
      }
    }
    cargarResultados()
    return () => { vigente = false }
  }, [divisionId, temporadaId, divisiones, recarga])

  const temporada = temporadas.find((t) => Number(t.id) === Number(temporadaId))
  const division = divisionesTorneo.find((d) => Number(d.id) === Number(divisionId))
  const esPrueba = Number(temporadaId) === TEMPORADA_PRUEBA
  const finales = partidos.filter((p) => p.fase === 'final')
  const terceros = partidos.filter((p) => p.fase === 'tercer_lugar')
  const final = finales.length === 1 ? finales[0] : null
  const tercerPartido = terceros.length === 1 ? terceros[0] : null
  const resultadoFinal = resolverResultado(final)
  const resultadoTercero = resolverResultado(tercerPartido)
  const nombres = new Map(equipos.map((e) => [Number(e.id), e.nombre]))
  const nombre = (id) => nombres.get(Number(id)) || 'Equipo por confirmar'
  const puestos = [
    { titulo: 'Campeón', medalla: '🥇', equipoId: resultadoFinal.ganadorId, borde: '#c99a24', fondo: '#fff9e8' },
    { titulo: 'Subcampeón', medalla: '🥈', equipoId: resultadoFinal.perdedorId, borde: '#8b98a8', fondo: '#f6f8fb' },
    { titulo: 'Tercer lugar', medalla: '🥉', equipoId: resultadoTercero.ganadorId, borde: '#b87949', fondo: '#fff7f0' },
  ]

  function marcador(partido) {
    if (!partido) return 'Por programar'
    if (partido.estado !== 'finalizado' || partido.goles_local == null || partido.goles_visitante == null) {
      return `${nombre(partido.local_id)} vs ${nombre(partido.visitante_id)} — Pendiente`
    }
    const empatado = Number(partido.goles_local) === Number(partido.goles_visitante)
    const tienePenales = empatado && partido.penales_local != null && partido.penales_visitante != null
    const detalle = tienePenales ? ` (penales ${partido.penales_local}–${partido.penales_visitante})` : ''
    return `${nombre(partido.local_id)} ${partido.goles_local} – ${partido.goles_visitante} ${nombre(partido.visitante_id)}${detalle}`
  }

  return (
    <main style={{ maxWidth: 1050, margin: '24px auto', padding: '0 16px 36px' }}>
      <a href="/" style={{ color: '#12385b', fontWeight: 600 }}>← Volver al inicio</a>
      <h1 style={{ marginTop: 22 }}>🏆 Liguilla YSASL</h1>
      <p>Consulta los resultados y el podio de cada temporada y división.</p>

      <section style={caja}>
        <h2 style={{ marginTop: 0 }}>Selecciona tu torneo</h2>
        {cargandoCatalogo ? <p>Cargando temporadas…</p> : <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14,
        }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <strong>Temporada</strong>
            <select aria-label="Temporada" value={temporadaId}
              onChange={(e) => {
                const siguiente = e.target.value
                const disponibles = divisiones.filter((d) => String(d.temporada_id) === siguiente)
                const tipoActual = tipoDivision(division?.nombre)
                const preferida = disponibles.find((d) => tipoDivision(d.nombre) === tipoActual) || disponibles[0]
                cambiarSeleccion(siguiente, preferida?.id)
              }}
              style={{ padding: 10, width: '100%' }}>
              {temporadas.map((t) => <option key={t.id} value={String(t.id)}>
                {t.nombre}{Number(t.id) === TEMPORADA_PRUEBA ? ' — PRUEBA' : ''}
              </option>)}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 6 }}>
            <strong>División</strong>
            <select aria-label="División" value={divisionId}
              onChange={(e) => cambiarSeleccion(temporadaId, e.target.value)}
              style={{ padding: 10, width: '100%' }}>
              {divisionesTorneo.length === 0 && <option value="">Sin divisiones</option>}
              {divisionesTorneo.map((d) => <option key={d.id} value={String(d.id)}>{d.nombre}</option>)}
            </select>
          </label>
        </div>}
        {esPrueba && <p role="status" style={{ padding: 12, background: '#fff3cd',
          color: '#713f12', border: '1px solid #f4c46b', borderRadius: 8, fontWeight: 700 }}>
          ⚠ TEMPORADA DE PRUEBA 2027. Estos resultados son ficticios y NO son oficiales.
        </p>}
      </section>

      {children}

      {error && <p role="alert" style={{ color: '#b42318', fontWeight: 700 }}>{error}</p>}
      {!error && !cargandoCatalogo && <section style={caja}>
        <h2 style={{ marginTop: 0 }}>Podio de la liguilla</h2>
        <p><strong>{temporada?.nombre || 'Temporada'} — {division?.nombre || 'División'}</strong></p>
        {cargandoResultados ? <p>Cargando resultados…</p> : <>
          {finales.length === 0 && terceros.length === 0 &&
            <p>La final y el partido por tercer lugar todavía no tienen resultados registrados.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {puestos.map((puesto) => <article key={puesto.titulo} style={{
              border: `2px solid ${puesto.borde}`, background: puesto.fondo,
              borderRadius: 12, padding: 20, textAlign: 'center', minHeight: 150,
            }}>
              <div aria-hidden="true" style={{ fontSize: 36 }}>{puesto.medalla}</div>
              <h3 style={{ margin: '8px 0' }}>{puesto.titulo}</h3>
              <p style={{ fontSize: 17, fontWeight: 700 }}>{puesto.equipoId ? nombre(puesto.equipoId) : 'Por definir'}</p>
            </article>)}
          </div>
          {(finales.length > 1 || terceros.length > 1) &&
            <p role="alert" style={{ color: '#b42318' }}>Hay partidos finales duplicados; no se puede determinar el podio.</p>}
          {(resultadoFinal.empate || resultadoTercero.empate) &&
            <p role="status" style={{ color: '#9a6700' }}>Hay un empate pendiente de definirse por penales.</p>}
          {(final || tercerPartido) && <div style={{ marginTop: 18 }}>
            <h3>Marcadores</h3>
            <p><strong>Final:</strong> {marcador(final)}</p>
            <p><strong>Tercer lugar:</strong> {marcador(tercerPartido)}</p>
          </div>}
          <button type="button" onClick={() => { setRecarga((n) => n + 1); router.refresh() }}
            disabled={cargandoResultados} style={{ padding: '9px 14px', marginTop: 8 }}>
            Actualizar resultados
          </button>
        </>}
      </section>}
      <p style={{ fontSize: 13, color: '#64748b', marginTop: 18 }}>
        Información pública de solo lectura. Los resultados se actualizan desde la administración de YSASL.
      </p>
    </main>
  )
}
