'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

// Página pública de SOLO LECTURA: no inserta ni modifica campeones ni resultados.
// La temporada 9 y las divisiones 12/13 son exclusivamente de simulación.
const TEMPORADA_PRUEBA = 9
const DIVISIONES_PRUEBA = new Set([12, 13])

const posiciones = [
  { id: 'campeon', nombre: '🥇 Campeón' },
  { id: 'subcampeon', nombre: '🥈 Subcampeón' },
  { id: 'tercer_lugar', nombre: '🥉 Tercer lugar' },
]

function esPrueba(texto) {
  return /prueba|simulaci[oó]n|test/i.test(String(texto || ''))
}

function normalizar(texto) {
  return String(texto || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function normalizarPosicion(posicion) {
  return posicion === 'tercero' ? 'tercer_lugar' : (posicion || 'campeon')
}

function claveGrupo(registro) {
  return JSON.stringify([normalizar(registro.temporada), normalizar(registro.division)])
}

// No inventar un ganador si el partido no terminó o quedó empatado.
// Los penales requieren un ganador registrado explícitamente.
function resolverPartido(partido) {
  if (!partido || partido.estado !== 'finalizado' ||
      partido.goles_local == null || partido.goles_visitante == null) return null

  const local = Number(partido.goles_local)
  const visitante = Number(partido.goles_visitante)
  const localId = Number(partido.local_id)
  const visitanteId = Number(partido.visitante_id)
  if (![local, visitante, localId, visitanteId].every(Number.isInteger) ||
      local < 0 || visitante < 0 || localId <= 0 || visitanteId <= 0 ||
      localId === visitanteId || local === visitante) return null

  return {
    ganadorId: local > visitante ? localId : visitanteId,
    perdedorId: local > visitante ? visitanteId : localId,
  }
}

export default function CampeonesPage() {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [temporada, setTemporada] = useState('todas')
  const [division, setDivision] = useState('todas')

  useEffect(() => {
    let activo = true

    async function cargar() {
      setCargando(true)
      setError('')
      let historicosSeguros = []
      try {
        // Conservamos las fotografías y el historial que ya están en campeones.
        const [resFotos, resTemporadas, resDivisiones] = await Promise.all([
          supabase.from('campeones')
            .select('id,temporada,division,equipo,posicion,foto_path,created_at')
            .order('created_at', { ascending: false }),
          supabase.from('temporadas').select('id,nombre,activa')
            .order('id', { ascending: false }),
          supabase.from('divisiones').select('id,nombre,temporada_id'),
        ])
        if (resFotos.error) throw resFotos.error
        const fotos = (resFotos.data || []).filter(r =>
          !esPrueba(r.temporada) && !esPrueba(r.division) && !esPrueba(r.equipo)
        )
        historicosSeguros = fotos
        if (resTemporadas.error) throw resTemporadas.error
        if (resDivisiones.error) throw resDivisiones.error

        const temporadasOficiales = (resTemporadas.data || []).filter(t =>
          Number(t.id) !== TEMPORADA_PRUEBA && !esPrueba(t.nombre)
        )
        const temporadasPorId = new Map(temporadasOficiales.map(t => [Number(t.id), t]))
        const divisionesOficiales = (resDivisiones.data || []).filter(d =>
          !DIVISIONES_PRUEBA.has(Number(d.id)) &&
          temporadasPorId.has(Number(d.temporada_id)) && !esPrueba(d.nombre)
        )
        const idsDivisiones = divisionesOficiales.map(d => Number(d.id))

        const partidos = []
        if (idsDivisiones.length) {
          // Filtramos EN SUPABASE por divisiones oficiales: no consultamos
          // resultados de la simulación 2027 para mostrarlos públicamente.
          for (let desde = 0; ; desde += 500) {
            const resPartidos = await supabase.from('partidos')
              .select('id,local_id,visitante_id,goles_local,goles_visitante,estado,fase,jornadas!inner(division_id)')
              .in('fase', ['final', 'tercer_lugar'])
              .in('jornadas.division_id', idsDivisiones)
              .order('id').range(desde, desde + 499)
            if (resPartidos.error) throw resPartidos.error
            const lote = resPartidos.data || []
            partidos.push(...lote)
            if (lote.length < 500) break
          }
        }

        const idsEquipos = [...new Set(partidos.flatMap(p => [p.local_id, p.visitante_id])
          .map(Number).filter(n => Number.isInteger(n) && n > 0))]
        const equipos = []
        for (let i = 0; i < idsEquipos.length; i += 200) {
          const resEquipos = await supabase.from('equipos').select('id,nombre')
            .in('id', idsEquipos.slice(i, i + 200))
          if (resEquipos.error) throw resEquipos.error
          equipos.push(...(resEquipos.data || []))
        }
        const nombresPorId = new Map(equipos.map(e => [Number(e.id), e.nombre]))

        const automaticos = []
        for (const d of divisionesOficiales) {
          const t = temporadasPorId.get(Number(d.temporada_id))
          const deDivision = partidos.filter(p => Number(p.jornadas?.division_id) === Number(d.id))
          const finales = deDivision.filter(p => p.fase === 'final')
          const terceros = deDivision.filter(p => p.fase === 'tercer_lugar')
          // Si hay finales duplicadas, no adivinamos cuál es la correcta.
          if (finales.length !== 1 || terceros.length > 1) continue

          const resultadoFinal = resolverPartido(finales[0])
          if (!resultadoFinal) continue
          const resultadoTercero = terceros.length === 1 ? resolverPartido(terceros[0]) : null
          const puestos = [
            ['campeon', resultadoFinal.ganadorId],
            ['subcampeon', resultadoFinal.perdedorId],
            ['tercer_lugar', resultadoTercero?.ganadorId],
          ]

          for (const [posicion, equipoId] of puestos) {
            if (!equipoId) continue
            const nombreEquipo = nombresPorId.get(equipoId)
            if (!nombreEquipo) continue
            // Una foto histórica solo se reutiliza si corresponde al equipo ganador.
            const foto = fotos.find(r =>
              normalizar(r.temporada) === normalizar(t.nombre) &&
              normalizar(r.division) === normalizar(d.nombre) &&
              normalizarPosicion(r.posicion) === posicion &&
              normalizar(r.equipo) === normalizar(nombreEquipo)
            )
            automaticos.push({
              id: `auto-${d.id}-${posicion}`,
              temporada: t.nombre,
              division: d.nombre,
              equipo: nombreEquipo,
              posicion,
              foto_path: foto?.foto_path || null,
            })
          }
        }

        // Si una división ya tiene podio calculado, manda el resultado real
        // del partido; las entradas manuales quedan como historial en las demás.
        const gruposAutomaticos = new Set(automaticos.map(claveGrupo))
        const historicos = fotos.filter(r => !gruposAutomaticos.has(claveGrupo(r)))
        if (activo) setRegistros([...automaticos, ...historicos])
      } catch (err) {
        if (activo) {
          // Si falla la consulta automática, las fotos históricas siguen visibles.
          setRegistros(historicosSeguros)
          setError('No se pudo completar la consulta automática: ' + (err.message || 'Error desconocido'))
        }
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [])

  const temporadas = [...new Set(registros.map(r => r.temporada).filter(Boolean))]
  const divisiones = [...new Set(
    registros.filter(r => temporada === 'todas' || r.temporada === temporada)
      .map(r => r.division).filter(Boolean)
  )]
  const filtrados = registros.filter(r =>
    (temporada === 'todas' || r.temporada === temporada) &&
    (division === 'todas' || r.division === division)
  )

  const grupos = []
  for (const registro of filtrados) {
    let grupo = grupos.find(g =>
      g.temporada === registro.temporada && g.division === registro.division
    )
    if (!grupo) {
      grupo = { temporada: registro.temporada, division: registro.division, registros: [] }
      grupos.push(grupo)
    }
    grupo.registros.push(registro)
  }

  const estiloSelector = {
    padding: 10, border: '1px solid #ccc', borderRadius: 8,
    width: '100%', marginTop: 6,
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1>🏆 Campeones de YSASL</h1>
      <p>Conoce a nuestros campeones, subcampeones y terceros lugares.</p>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16, margin: '28px 0',
      }}>
        <label>
          Temporada
          <select style={estiloSelector} value={temporada}
            onChange={e => { setTemporada(e.target.value); setDivision('todas') }}>
            <option value="todas">Todas las temporadas</option>
            {temporadas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          División
          <select style={estiloSelector} value={division}
            onChange={e => setDivision(e.target.value)}>
            <option value="todas">Todas las divisiones</option>
            {divisiones.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>

      {cargando && <p>Cargando campeones...</p>}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      {!cargando && !error && grupos.length === 0 && (
        <p>Los campeones aparecerán automáticamente al registrar los resultados definitivos de la final.</p>
      )}

      {grupos.map(grupo => (
        <section key={`${grupo.temporada}-${grupo.division}`} style={{ marginBottom: 40 }}>
          <h2 style={{ borderBottom: '2px solid #166534', paddingBottom: 10 }}>
            {grupo.temporada} — {grupo.division}
          </h2>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 18, marginTop: 20,
          }}>
            {posiciones.map(lugar => {
              const equipo = grupo.registros.find(r => normalizarPosicion(r.posicion) === lugar.id)
              const fotoUrl = equipo?.foto_path
                ? supabase.storage.from('fotos-finalistas').getPublicUrl(equipo.foto_path).data.publicUrl
                : null

              return (
                <article key={lugar.id} style={{
                  border: '1px solid #ddd', borderRadius: 12, overflow: 'hidden',
                  textAlign: 'center', background: '#fff',
                }}>
                  <h3 style={{ padding: '16px 12px 0' }}>{lugar.nombre}</h3>
                  {fotoUrl ? (
                    <img src={fotoUrl} alt={`Fotografía de ${equipo.equipo}`}
                      style={{ width: '100%', height: 210, objectFit: 'cover' }} />
                  ) : (
                    <div style={{
                      height: 210, background: '#f3f4f6', display: 'grid',
                      placeItems: 'center', color: '#666',
                    }}>📷 Fotografía pendiente</div>
                  )}
                  <p style={{ padding: '0 12px 16px', fontWeight: 'bold' }}>
                    {equipo?.equipo || 'Por definir'}
                  </p>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
