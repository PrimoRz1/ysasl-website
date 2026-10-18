'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

const celda = {
  border: '1px solid #ddd',
  padding: '9px',
  textAlign: 'center'
}

const estiloSelector = {
  display: 'block',
  width: '100%',
  padding: '12px',
  marginTop: '8px',
  border: '1px solid #ccc',
  borderRadius: '8px',
  background: '#fff',
  fontSize: '16px'
}

function esPrueba(nombre) {
  return /prueba|simulaci[oó]n|test/i.test(String(nombre || ''))
}

function hoyPacifico() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const parte = (tipo) => partes.find((p) => p.type === tipo)?.value || ''
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

function mostrarFecha(fecha) {
  if (!fecha) return 'Pendiente'
  const [anio, mes, dia] = String(fecha).slice(0, 10).split('-')
  return `${mes}/${dia}/${anio}`
}

function mostrarHora(hora) {
  if (!hora) return 'Pendiente'
  const [horas, minutos] = String(hora).split(':').map(Number)
  if (!Number.isFinite(horas) || !Number.isFinite(minutos)) return 'Pendiente'
  const hora12 = horas % 12 || 12
  return `${hora12}:${String(minutos).padStart(2, '0')} ${horas >= 12 ? 'PM' : 'AM'}`
}

function fechaYHora(partido) {
  return `${partido.fecha || '9999-12-31'} ${partido.hora || '23:59'}`
}

function agruparPorJornada(partidos, orden = 'ascendente') {
  const grupos = new Map()
  for (const partido of partidos) {
    const jornada = partido.jornada ?? 'Pendiente'
    if (!grupos.has(jornada)) grupos.set(jornada, [])
    grupos.get(jornada).push(partido)
  }

  const lista = [...grupos].map(([jornada, juegos]) => ({
    jornada,
    juegos: [...juegos].sort((a, b) => fechaYHora(a).localeCompare(fechaYHora(b)))
  }))

  if (orden === 'descendente') {
    return lista.sort((a, b) => {
      const jornadaA = Number(a.jornada)
      const jornadaB = Number(b.jornada)
      if (Number.isFinite(jornadaA) && Number.isFinite(jornadaB)) {
        return jornadaB - jornadaA
      }
      return fechaYHora(b.juegos[b.juegos.length - 1])
        .localeCompare(fechaYHora(a.juegos[a.juegos.length - 1]))
    })
  }

  return lista.sort((a, b) =>
    fechaYHora(a.juegos[0]).localeCompare(fechaYHora(b.juegos[0]))
  )
}

function normalizarNombre(texto) {
  return String(texto || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function EscudoEquipo({ nombre, divisionId, escudos }) {
  const equipo = escudos.find((e) =>
    normalizarNombre(e.nombre) === normalizarNombre(nombre) &&
    String(e.division_id) === String(divisionId)
  )
  const ruta = equipo?.escudo_url || equipo?.logo_url || equipo?.escudo_path || null
  const url = ruta && /^https?:\/\//i.test(ruta)
    ? ruta
    : ruta ? supabase.storage.from('escudos-equipos').getPublicUrl(ruta).data.publicUrl : null

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
      {url ? (
        <img src={url} alt={`Escudo de ${nombre}`} loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }} />
      ) : (
        <span aria-hidden="true" style={{ width: 34, height: 34, borderRadius: '50%',
          background: '#e2e8f0', display: 'grid', placeItems: 'center', flexShrink: 0 }}>⚽</span>
      )}
      <span>{nombre}</span>
    </span>
  )
}

function TablaJornada({ partidos, escudos }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={celda}>Fecha</th>
            <th style={celda}>Hora</th>
            <th style={celda}>Campo</th>
            <th style={celda}>Local</th>
            <th style={celda}>Resultado</th>
            <th style={celda}>Visitante</th>
            <th style={celda}>Estado</th>
          </tr>
        </thead>
        <tbody>
          {partidos.map((partido) => {
            const resultado =
              partido.estado === 'finalizado' &&
              partido.goles_local != null && partido.goles_visitante != null
                ? `${partido.goles_local} - ${partido.goles_visitante}`
                : 'vs'

            const estado =
              partido.estado === 'finalizado' ? 'Finalizado' :
              partido.estado === 'programado' ? 'Programado' :
              partido.estado === 'pospuesto' ? 'Pospuesto' :
              partido.estado === 'cancelado' ? 'Cancelado' :
              partido.estado || 'Pendiente'

            return (
              <tr key={partido.id}>
                <td style={celda}>{mostrarFecha(partido.fecha)}</td>
                <td style={celda}>{mostrarHora(partido.hora)}</td>
                <td style={celda}>
                  {partido.campo ? `Campo ${partido.campo}` : 'Pendiente'}
                </td>
                <td style={{ ...celda, textAlign: 'left' }}><EscudoEquipo nombre={partido.local} divisionId={partido.division_id} escudos={escudos} /></td>
                <td style={celda}><strong>{resultado}</strong></td>
                <td style={{ ...celda, textAlign: 'left' }}><EscudoEquipo nombre={partido.visitante} divisionId={partido.division_id} escudos={escudos} /></td>
                <td style={celda}>{estado}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SeccionJornadas({ titulo, descripcion, partidos, orden, escudos }) {
  if (partidos.length === 0) return null
  const grupos = agruparPorJornada(partidos, orden)

  return (
    <section style={{ marginTop: '35px', marginBottom: '45px' }}>
      <h2>{titulo}</h2>
      {descripcion && <p style={{ color: '#555' }}>{descripcion}</p>}
      {grupos.map((grupo) => (
        <div key={String(grupo.jornada)} style={{ marginBottom: '32px' }}>
          <h3>Jornada {grupo.jornada}</h3>
          <TablaJornada partidos={grupo.juegos} escudos={escudos} />
        </div>
      ))}
    </section>
  )
}

export default function Calendario() {
  const [temporadas, setTemporadas] = useState([])
  const [divisiones, setDivisiones] = useState([])
  const [partidos, setPartidos] = useState([])
  const [escudos, setEscudos] = useState([])
  const [temporadaId, setTemporadaId] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true

    async function cargar() {
      try {
        const [respuestaTemporadas, respuestaDivisiones] = await Promise.all([
          supabase.from('temporadas')
            .select('id,nombre,activa')
            .order('id', { ascending: false }),
          supabase.from('divisiones')
            .select('id,nombre,temporada_id,orden')
            .order('orden')
        ])

        if (respuestaTemporadas.error) throw respuestaTemporadas.error
        if (respuestaDivisiones.error) throw respuestaDivisiones.error

        const temporadasOficiales = (respuestaTemporadas.data || []).filter(
          (t) => Number(t.id) !== 9 && !esPrueba(t.nombre)
        )
        const idsTemporadas = new Set(temporadasOficiales.map((t) => Number(t.id)))
        const divisionesOficiales = (respuestaDivisiones.data || []).filter(
          (d) => idsTemporadas.has(Number(d.temporada_id)) &&
            ![12, 13].includes(Number(d.id)) && !esPrueba(d.nombre)
        )
        const idsDivisiones = new Set(divisionesOficiales.map((d) => Number(d.id)))

        // Paginación: Supabase suele limitar cada respuesta a 1000 registros.
        const partidosCargados = []
        for (let desde = 0; ; desde += 500) {
          const respuestaPartidos = await supabase.from('calendario_partidos')
            .select('id,jornada,division_id,division,fecha,hora,campo,local,visitante,goles_local,goles_visitante,estado')
            .order('id')
            .range(desde, desde + 499)
          if (respuestaPartidos.error) throw respuestaPartidos.error
          const lote = respuestaPartidos.data || []
          partidosCargados.push(...lote.filter(
            (p) => idsDivisiones.has(Number(p.division_id))
          ))
          if (lote.length < 500) break
        }

        // Los escudos son opcionales: si falla su consulta, el calendario sigue funcionando.
        const respuestaEscudos = await supabase.from('equipos').select('*')
        if (respuestaEscudos.error) {
          console.error('No se pudieron cargar los escudos:', respuestaEscudos.error.message)
        }

        const conPartidos = (t) => divisionesOficiales.some((d) =>
          Number(d.temporada_id) === Number(t.id) &&
          partidosCargados.some((p) => Number(p.division_id) === Number(d.id))
        )
        const temporadaInicial =
          temporadasOficiales.find((t) => t.activa && conPartidos(t)) ||
          temporadasOficiales.find(conPartidos) ||
          temporadasOficiales.find((t) => t.activa) ||
          temporadasOficiales[0]

        const divisionesIniciales = divisionesOficiales.filter(
          (d) => Number(d.temporada_id) === Number(temporadaInicial?.id)
        )
        const hoy = hoyPacifico()
        const divisionInicial = divisionesIniciales.find((d) =>
          partidosCargados.some((p) =>
            Number(p.division_id) === Number(d.id) &&
            p.estado === 'programado' && p.fecha && p.fecha >= hoy
          )
        ) || divisionesIniciales[0]

        if (activo) {
          setTemporadas(temporadasOficiales)
          setDivisiones(divisionesOficiales)
          setPartidos(partidosCargados)
          setEscudos(respuestaEscudos.data || [])
          setTemporadaId(temporadaInicial ? String(temporadaInicial.id) : '')
          setDivisionId(divisionInicial ? String(divisionInicial.id) : '')
        }
      } catch (err) {
        if (activo) setError(err.message || 'No se pudo cargar el calendario.')
      } finally {
        if (activo) setCargando(false)
      }
    }

    cargar()
    return () => { activo = false }
  }, [])

  const divisionesTemporada = useMemo(() =>
    divisiones.filter((d) => String(d.temporada_id) === temporadaId),
    [divisiones, temporadaId]
  )

  const partidosDivision = useMemo(() =>
    partidos.filter((p) => String(p.division_id) === divisionId),
    [partidos, divisionId]
  )

  const hoy = hoyPacifico()
  const proximos = partidosDivision.filter(
    (p) => p.estado === 'programado' && p.fecha && p.fecha >= hoy
  )
  const resultados = partidosDivision.filter((p) => p.estado === 'finalizado')
  const otros = partidosDivision.filter(
    (p) => p.estado !== 'finalizado' && !proximos.includes(p)
  )

  const temporadaSeleccionada = temporadas.find((t) => String(t.id) === temporadaId)
  const divisionSeleccionada = divisionesTemporada.find((d) => String(d.id) === divisionId)

  function cambiarTemporada(nuevoId) {
    setTemporadaId(nuevoId)
    const disponibles = divisiones.filter((d) => String(d.temporada_id) === nuevoId)
    const hoy = hoyPacifico()
    const preferida = disponibles.find((d) => partidos.some((p) =>
      String(p.division_id) === String(d.id) &&
      p.estado === 'programado' && p.fecha && p.fecha >= hoy
    )) || disponibles[0]
    setDivisionId(preferida ? String(preferida.id) : '')
  }

  return (
    <main style={{
      maxWidth: '1200px', margin: '0 auto', padding: '30px 20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>Calendario</h1>
      <p>Yuba Sutter Adult Soccer League</p>

      {cargando && <p>Cargando calendario...</p>}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>
        Error conectando con Supabase: {error}
      </p>}

      {!cargando && !error && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '20px', marginTop: '30px', marginBottom: '30px'
          }}>
            <label style={{ fontWeight: 'bold' }}>
              Temporada
              <select value={temporadaId} onChange={(e) => cambiarTemporada(e.target.value)}
                style={estiloSelector}>
                {temporadas.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.nombre}</option>
                ))}
              </select>
            </label>
            <label style={{ fontWeight: 'bold' }}>
              División
              <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)}
                style={estiloSelector} disabled={divisionesTemporada.length === 0}>
                {divisionesTemporada.length === 0 && <option value="">Sin divisiones</option>}
                {divisionesTemporada.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.nombre}</option>
                ))}
              </select>
            </label>
          </div>

          {divisionSeleccionada ? (
            <>
              <h2 style={{ borderBottom: '2px solid #0b2341', paddingBottom: '12px' }}>
                {divisionSeleccionada.nombre}
              </h2>
              <p style={{ color: '#555' }}>{temporadaSeleccionada?.nombre}</p>

              <SeccionJornadas
                titulo="Próximos partidos"
                descripcion="Partidos programados a partir de hoy, en orden de fecha y hora."
                partidos={proximos}
                orden="ascendente"
                escudos={escudos}
              />
              <SeccionJornadas
                titulo="Resultados anteriores"
                descripcion="Primero las jornadas más recientes."
                partidos={resultados}
                orden="descendente"
                escudos={escudos}
              />
              <SeccionJornadas
                titulo="Otros partidos"
                descripcion="Partidos pendientes de actualización, sin fecha, pospuestos o cancelados."
                partidos={otros}
                orden="descendente"
                escudos={escudos}
              />

              {partidosDivision.length === 0 && (
                <p>No hay partidos registrados para esta división y temporada.</p>
              )}
            </>
          ) : (
            <p>No hay divisiones disponibles para esta temporada.</p>
          )}
        </>
      )}
    </main>
  )
}
