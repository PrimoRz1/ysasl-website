import { supabase } from '../lib/supabase'

export const dynamic = 'force-dynamic'

// Campeones oficiales: se prioriza el resultado definitivo de una final
// y se conserva el historial de fotografías guardadas en Supabase.
function normalizar(texto) {
  return String(texto || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function esPrueba(texto) {
  return /prueba|simulaci[oó]n|test/i.test(String(texto || ''))
}

function tipoDivision(nombre) {
  const nombreNormalizado = normalizar(nombre)
  if (nombreNormalizado.includes('primera')) return 'primera'
  if (nombreNormalizado.includes('segunda')) return 'segunda'
  return null
}

function anioTemporada(nombre) {
  const coincidencia = String(nombre || '').match(/20\d{2}/)
  return coincidencia ? Number(coincidencia[0]) : 0
}

function resolverCampeonFinal(partido) {
  if (!partido || partido.estado !== 'finalizado') return null
  if (partido.goles_local == null || partido.goles_visitante == null) return null

  const golesLocal = Number(partido.goles_local)
  const golesVisitante = Number(partido.goles_visitante)
  const localId = Number(partido.local_id)
  const visitanteId = Number(partido.visitante_id)

  if (![golesLocal, golesVisitante, localId, visitanteId].every(Number.isInteger)) return null
  if (golesLocal < 0 || golesVisitante < 0 || localId <= 0 || visitanteId <= 0) return null
  if (localId === visitanteId || golesLocal === golesVisitante) return null

  return golesLocal > golesVisitante ? localId : visitanteId
}

async function cargarCampeonesVigentes() {
  const vacios = [
    { tipo: 'primera', division: 'Primera División', equipo: null },
    { tipo: 'segunda', division: 'Segunda División', equipo: null }
  ]

  const [respuestaHistorial, respuestaTemporadas, respuestaDivisiones] = await Promise.all([
    supabase.from('campeones')
      .select('id,temporada,division,equipo,posicion,foto_path,created_at')
      .order('created_at', { ascending: false }),
    supabase.from('temporadas').select('id,nombre,activa'),
    supabase.from('divisiones').select('id,nombre,temporada_id')
  ])

  // No afectamos el resto de la página si falta algún registro de campeones.
  const historial = (respuestaHistorial.data || []).filter((registro) =>
    (registro.posicion == null || normalizar(registro.posicion) === 'campeon') &&
    !esPrueba(registro.temporada) &&
    !esPrueba(registro.division) &&
    !esPrueba(registro.equipo)
  )

  const temporadas = (respuestaTemporadas.data || []).filter((t) =>
    Number(t.id) !== 9 && !esPrueba(t.nombre)
  )
  const temporadasPorId = new Map(temporadas.map((t) => [Number(t.id), t]))
  const divisiones = (respuestaDivisiones.data || []).filter((d) =>
    ![12, 13].includes(Number(d.id)) &&
    temporadasPorId.has(Number(d.temporada_id)) &&
    !esPrueba(d.nombre)
  )

  const candidatos = historial.map((registro) => {
    const temporadaRegistrada = temporadas.find(
      (t) => normalizar(t.nombre) === normalizar(registro.temporada)
    )
    return {
      ...registro,
      tipo: tipoDivision(registro.division),
      temporadaId: Number(temporadaRegistrada?.id || 0),
      automatico: false
    }
  })

  // Igual que la página de Campeones: el ganador de una final finalizada
  // prevalece sobre un registro manual de esa misma temporada/división.
  if (!respuestaTemporadas.error && !respuestaDivisiones.error && divisiones.length > 0) {
    try {
      const idsDivisiones = divisiones.map((d) => Number(d.id))
      const respuestaFinales = await supabase.from('partidos')
        .select('id,local_id,visitante_id,goles_local,goles_visitante,estado,fase,jornadas!inner(division_id)')
        .eq('fase', 'final')
        .in('jornadas.division_id', idsDivisiones)

      if (respuestaFinales.error) throw respuestaFinales.error
      const finales = respuestaFinales.data || []
      const idsEquipos = [...new Set(finales.flatMap((p) => [p.local_id, p.visitante_id])
        .map(Number).filter((id) => Number.isInteger(id) && id > 0))]

      const nombresPorId = new Map()
      for (let i = 0; i < idsEquipos.length; i += 200) {
        const respuestaEquipos = await supabase.from('equipos')
          .select('id,nombre').in('id', idsEquipos.slice(i, i + 200))
        if (respuestaEquipos.error) throw respuestaEquipos.error
        for (const equipo of respuestaEquipos.data || []) {
          nombresPorId.set(Number(equipo.id), equipo.nombre)
        }
      }

      for (const division of divisiones) {
        const finalesDivision = finales.filter(
          (p) => Number(p.jornadas?.division_id) === Number(division.id)
        )
        // No deducir ganadores de finales duplicadas, incompletas o empatadas.
        if (finalesDivision.length !== 1) continue
        const ganadorId = resolverCampeonFinal(finalesDivision[0])
        const equipo = nombresPorId.get(ganadorId)
        if (!equipo) continue

        const temporada = temporadasPorId.get(Number(division.temporada_id))
        const foto = historial.find((r) =>
          normalizar(r.temporada) === normalizar(temporada?.nombre) &&
          normalizar(r.division) === normalizar(division.nombre) &&
          normalizar(r.equipo) === normalizar(equipo)
        )

        candidatos.push({
          id: `final-${division.id}`,
          tipo: tipoDivision(division.nombre),
          division: division.nombre,
          temporada: temporada?.nombre || '',
          temporadaId: Number(temporada?.id || 0),
          equipo,
          foto_path: foto?.foto_path || null,
          automatico: true,
          created_at: null
        })
      }
    } catch (error) {
      // Si fallan las consultas de finales, mantenemos los campeones históricos.
      console.error('No se pudieron consultar las finales para la portada:', error.message)
    }
  }

  const ordenados = candidatos.filter((c) => c.tipo).sort((a, b) => {
    const diferenciaAnio = anioTemporada(b.temporada) - anioTemporada(a.temporada)
    if (diferenciaAnio) return diferenciaAnio
    const diferenciaTemporada = b.temporadaId - a.temporadaId
    if (diferenciaTemporada) return diferenciaTemporada
    if (a.automatico !== b.automatico) return a.automatico ? -1 : 1
    return String(b.created_at || '').localeCompare(String(a.created_at || ''))
  })

  return vacios.map((division) =>
    ordenados.find((c) => c.tipo === division.tipo) || division
  )
}

function urlFotoCampeon(fotoPath) {
  if (!fotoPath) return null
  if (/^https?:\/\//i.test(fotoPath)) return fotoPath
  return supabase.storage.from('fotos-finalistas').getPublicUrl(fotoPath).data.publicUrl
}


function fechaHoyCalifornia() {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())
  const valor = (tipo) => partes.find((p) => p.type === tipo)?.value || ''
  return `${valor('year')}-${valor('month')}-${valor('day')}`
}

function fechaVisible(fecha) {
  if (!fecha) return 'Fecha pendiente'
  const [anio, mes, dia] = String(fecha).split('-')
  return `${mes}/${dia}/${anio}`
}

function horaVisible(hora) {
  if (!hora) return 'Hora pendiente'
  const [horas, minutos] = String(hora).split(':').map(Number)
  if (!Number.isFinite(horas) || !Number.isFinite(minutos)) return hora
  return `${horas % 12 || 12}:${String(minutos).padStart(2, '0')} ${horas >= 12 ? 'PM' : 'AM'}`
}


// Los cupos se ajustan automáticamente al número de equipos de cada división.
// Verde significa zona de clasificación; no modifica ni confirma resultados.
function cantidadClasificados(totalEquipos) {
  if (totalEquipos >= 10) return 8
  if (totalEquipos >= 7) return 6
  if (totalEquipos >= 4) return 4
  return 0
}

// Selecciona hasta tres partidos de la fecha más próxima usando la clasificación.
// No cambia partidos ni requiere tablas nuevas en Supabase.
function elegirPartidosDestacados(partidos, clasificacion, divisiones) {
  const futuros = (partidos || []).filter(p => p.fecha && p.local && p.visitante)
  if (!futuros.length) return []
  const fechaProxima = futuros.reduce((min, p) => p.fecha < min ? p.fecha : min, futuros[0].fecha)
  const tablaPorDivision = new Map()
  for (const fila of clasificacion || []) {
    const clave = String(fila.division_id)
    if (!tablaPorDivision.has(clave)) tablaPorDivision.set(clave, [])
    tablaPorDivision.get(clave).push(fila)
  }
  for (const tabla of tablaPorDivision.values()) {
    tabla.sort((a, b) => Number(b.pts || 0) - Number(a.pts || 0) || Number(b.dg || 0) - Number(a.dg || 0) || Number(b.gf || 0) - Number(a.gf || 0))
  }
  const nombresDivisiones = new Map((divisiones || []).map(d => [String(d.id), d.nombre]))
  return futuros.filter(p => p.fecha === fechaProxima).map(p => {
    const tabla = tablaPorDivision.get(String(p.division_id)) || []
    const localPos = tabla.findIndex(f => normalizar(f.equipo) === normalizar(p.local))
    const visitantePos = tabla.findIndex(f => normalizar(f.equipo) === normalizar(p.visitante))
    const ambos = localPos >= 0 && visitantePos >= 0
    const cercania = ambos ? Math.abs(localPos - visitantePos) : 99
    const top = ambos && localPos < 4 && visitantePos < 4
    const puntuacion = top ? 100 - cercania * 10 : ambos ? 50 - cercania * 4 : 0
    const motivo = top ? 'Duelo entre los primeros lugares' : ambos && cercania <= 2 ? 'Rivales cercanos en la clasificación' : 'Partido de la próxima jornada'
    return { ...p, divisionNombre: nombresDivisiones.get(String(p.division_id)) || 'División', motivo, puntuacion }
  }).sort((a, b) => b.puntuacion - a.puntuacion || String(a.hora || '').localeCompare(String(b.hora || '')) || Number(a.id) - Number(b.id)).slice(0, 3)
}

export default async function Home() {
  const campeonesVigentes = await cargarCampeonesVigentes()

  const { data: divisiones, error: errorDivisiones } = await supabase
    .from('divisiones')
    .select('id, nombre')
    .order('orden')

  const { data: clasificacion, error: errorClasificacion } = await supabase
    .from('clasificacion')
    .select('division_id, equipo, pj, pg, pe, pp, gf, gc, dg, pts')
    .order('pts', { ascending: false })
    .order('dg', { ascending: false })
    .order('gf', { ascending: false })

  // Solo los partidos programados a partir de hoy: la portada no repite
  // todas las jornadas ni los resultados que ya están en /calendario.
  const { data: partidos, error: errorPartidos } = await supabase
    .from('calendario_partidos')
    .select('id, jornada, division_id, fecha, hora, campo, local, visitante, estado')
    .eq('estado', 'programado')
    .gte('fecha', fechaHoyCalifornia())
    .order('fecha', { ascending: true })
    .order('hora', { ascending: true })

  const { data: patrocinadores, error: errorPatrocinadores } = await supabase
  .from('patrocinadores')
  .select('id, nombre, enlace, imagen_url, fecha_inicio, fecha_fin')
  .eq('activo', true)
  .eq('tipo', 'principal')
  .order('nombre')

  const { data: destacados, error: errorDestacados } = await supabase
  .from('patrocinadores')
  .select('id, nombre, enlace, imagen_url, fecha_inicio, fecha_fin')
  .eq('activo', true)
  .eq('tipo', 'destacado')
  .order('nombre')

  const { data: normales, error: errorNormales } = await supabase
  .from('patrocinadores')
  .select('id, nombre, enlace, imagen_url, fecha_inicio, fecha_fin')
  .eq('activo', true)
  .eq('tipo', 'normal')
  .order('nombre')
  const partidosDestacados = elegirPartidosDestacados(partidos, clasificacion, divisiones)

  const hayError =
  errorDivisiones || errorClasificacion || errorPartidos || errorPatrocinadores || errorDestacados || errorNormales

  return (
    <main
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '30px 20px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <header style={{
        background: 'linear-gradient(135deg, #0b2341, #174d7a)',
        color: 'white',
        padding: '35px 25px',
        borderRadius: '18px',
        textAlign: 'center',
        marginBottom: '35px'
      }}>
        <p style={{ letterSpacing: '3px', fontWeight: 'bold', margin: '0 0 10px' }}>
          YSASL
        </p>
        <h1 style={{ fontSize: 'clamp(25px, 4vw, 40px)', margin: '0 0 12px' }}>
          Yuba Sutter Adult Soccer League
        </h1>
        <p style={{ margin: '0 0 22px', color: '#e1ecf6' }}>
          La pasión por el fútbol nos une
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <a href="/calendario" style={{
            background: 'white', color: '#0b2341', textDecoration: 'none',
            fontWeight: 'bold', padding: '11px 18px', borderRadius: '9px'
          }}>Ver calendario</a>
          <a href="/clasificacion" style={{
            border: '1px solid #dbeafe', color: 'white', textDecoration: 'none',
            fontWeight: 'bold', padding: '11px 18px', borderRadius: '9px'
          }}>Ver clasificación</a>
        </div>
      </header>

      <section style={{ marginTop: '35px', marginBottom: '45px' }}>
        <h2 style={{ marginBottom: '8px' }}>🔥 Partidos Destacados</h2>
        <p style={{ marginTop: 0, color: '#555' }}>Los tres encuentros más interesantes de la próxima fecha programada.</p>
        {partidosDestacados.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginTop: '20px' }}>
            {partidosDestacados.map(partido => (
              <article key={partido.id} style={{ border: '1px solid #dbe3eb', borderRadius: '14px', padding: '20px', background: '#f8fafc', textAlign: 'center' }}>
                <p style={{ margin: '0 0 12px', color: '#174d7a', fontWeight: 'bold' }}>{partido.divisionNombre}</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '18px' }}>
                  <strong style={{ flex: 1 }}>{partido.local}</strong>
                  <span style={{ color: '#64748b' }}>VS</span>
                  <strong style={{ flex: 1 }}>{partido.visitante}</strong>
                </div>
                <p style={{ marginBottom: '5px' }}>{fechaVisible(partido.fecha)} · {horaVisible(partido.hora)}</p>
                <p style={{ margin: '5px 0' }}>{partido.campo ? `Campo ${partido.campo}` : 'Campo pendiente'}</p>
                <p style={{ fontWeight: 'bold', color: '#0b4a84', marginBottom: 0 }}>{partido.motivo}</p>
              </article>
            ))}
          </div>
        ) : (
          <p style={{ padding: '15px', background: '#f3f4f6', borderRadius: '10px' }}>No hay partidos próximos programados por el momento.</p>
        )}
      </section>

      <section style={{ marginTop: '35px', marginBottom: '45px' }}>
        <h2 style={{ marginBottom: '8px' }}>🏆 Campeones vigentes</h2>
        <p style={{ color: '#555', marginTop: 0 }}>
          Los últimos campeones oficiales registrados de cada división.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          marginTop: '22px'
        }}>
          {campeonesVigentes.map((campeon) => {
            const fotoUrl = urlFotoCampeon(campeon.foto_path)
            return (
              <article key={campeon.tipo} style={{
                border: '1px solid #ddd',
                borderRadius: '14px',
                overflow: 'hidden',
                background: '#fff',
                textAlign: 'center',
                boxShadow: '0 3px 10px rgba(0,0,0,0.06)'
              }}>
                <div style={{ padding: '18px 15px 8px' }}>
                  <h3 style={{ margin: 0 }}>{campeon.division}</h3>
                </div>
                {fotoUrl ? (
                  <img
                    src={fotoUrl}
                    alt={`Fotografía de ${campeon.equipo}`}
                    style={{ width: '100%', height: '220px', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{
                    height: '190px',
                    display: 'grid',
                    placeItems: 'center',
                    background: '#f3f4f6',
                    fontSize: '52px'
                  }}>🏆</div>
                )}
                <div style={{ padding: '12px 16px 22px' }}>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '4px 0' }}>
                    {campeon.equipo || 'Campeón por definir'}
                  </p>
                  {campeon.temporada && (
                    <p style={{ color: '#555', margin: '8px 0 0' }}>
                      {campeon.temporada}
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px' }}>
          <a href="/campeones" style={{ color: '#0b4a84', fontWeight: 'bold' }}>
            Ver todos los campeones y el historial →
          </a>
        </p>
      </section>


      {hayError && (
        <div
          style={{
            padding: '15px',
            background: '#ffe8e8',
            marginBottom: '25px'
          }}
        >
          Error conectando con Supabase:{' '}
          {errorDivisiones?.message ||
            errorClasificacion?.message ||
            errorPartidos?.message ||
            errorPatrocinadores?.message ||
            errorDestacados?.message ||
            errorNormales?.message}
        </div>
      )}

      <section style={{ marginTop: '40px', marginBottom: '55px' }}>
        <h2 style={{ marginBottom: '8px' }}>⚽ Próximos partidos</h2>
        <p style={{ marginTop: 0, color: '#555' }}>
          Los encuentros más cercanos de cada división.
        </p>

        {(divisiones || []).map((division) => {
          const proximos = (partidos || [])
            .filter((partido) => Number(partido.division_id) === Number(division.id))
            .slice(0, 4)

          if (proximos.length === 0) return null

          return (
            <div key={division.id} style={{ marginTop: '25px' }}>
              <h3 style={{ color: '#0b2341' }}>{division.nombre}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                {proximos.map((partido) => (
                  <article key={partido.id} style={{
                    border: '1px solid #dbe3eb', borderRadius: '12px',
                    padding: '16px', background: '#f8fafc'
                  }}>
                    <p style={{ fontSize: '13px', color: '#555', margin: '0 0 12px' }}>
                      Jornada {partido.jornada} · {fechaVisible(partido.fecha)} · {horaVisible(partido.hora)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                      <strong style={{ flex: 1, textAlign: 'center' }}>{partido.local}</strong>
                      <span style={{ fontWeight: 'bold', color: '#64748b' }}>VS</span>
                      <strong style={{ flex: 1, textAlign: 'center' }}>{partido.visitante}</strong>
                    </div>
                    <p style={{ textAlign: 'center', margin: '12px 0 0', fontSize: '13px', color: '#555' }}>
                      {partido.campo ? `Campo ${partido.campo}` : 'Campo pendiente'}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )
        })}

        {!errorPartidos && !(partidos || []).some((p) =>
          (divisiones || []).some((d) => Number(d.id) === Number(p.division_id))
        ) && (
          <p style={{ padding: '15px', background: '#f3f4f6', borderRadius: '10px' }}>
            No hay partidos próximos programados por el momento.
          </p>
        )}

        <p style={{ textAlign: 'center', marginTop: '22px' }}>
          <a href="/calendario" style={{ color: '#0b4a84', fontWeight: 'bold' }}>
            Ver calendario y resultados completos →
          </a>
        </p>
      </section>

      <section style={{ marginTop: '40px', marginBottom: '60px' }}>
        <h2 style={{ marginBottom: '8px' }}>📊 Clasificación completa</h2>
        <p style={{ color: '#555', marginTop: 0 }}>
          Todas las posiciones y estadísticas oficiales de cada división.
        </p>

        {(divisiones || []).map((division) => {
          const tabla = (clasificacion || []).filter(
            (fila) => Number(fila.division_id) === Number(division.id)
          )
          const cupos = cantidadClasificados(tabla.length)

          return (
            <div key={division.id} style={{ marginTop: '30px', marginBottom: '40px' }}>
              <h3 style={{ color: '#0b2341' }}>{division.nombre}</h3>
              {cupos > 0 && (
                <p style={{ fontSize: '14px', color: '#166534', margin: '5px 0 14px' }}>
                  <span aria-hidden="true" style={{
                    display: 'inline-block', width: '13px', height: '13px',
                    background: '#dcfce7', border: '1px solid #86b99a',
                    borderRadius: '3px', verticalAlign: 'middle', marginRight: '7px'
                  }} />
                  Verde claro: zona de liguilla (primeros {cupos} de {tabla.length} equipos).
                </p>
              )}
              <div style={{ overflowX: 'auto', borderRadius: '10px' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead style={{ background: '#0b2341', color: 'white' }}>
                    <tr>
                      <th style={celda}>#</th>
                      <th style={{ ...celda, textAlign: 'left' }}>Equipo</th>
                      <th style={celda}>PJ</th>
                      <th style={celda}>PG</th>
                      <th style={celda}>PE</th>
                      <th style={celda}>PP</th>
                      <th style={celda}>GF</th>
                      <th style={celda}>GC</th>
                      <th style={celda}>DG</th>
                      <th style={celda}>PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabla.map((fila, index) => (
                      <tr key={`${division.id}-${fila.equipo}`} style={{ background: index < cupos ? '#dcfce7' : (index % 2 ? '#f8fafc' : 'white') }}>
                        <td style={celda}>{index + 1}</td>
                        <td style={{ ...celda, textAlign: 'left', fontWeight: 'bold' }}>{fila.equipo}</td>
                        <td style={celda}>{fila.pj}</td>
                        <td style={celda}>{fila.pg}</td>
                        <td style={celda}>{fila.pe}</td>
                        <td style={celda}>{fila.pp}</td>
                        <td style={celda}>{fila.gf}</td>
                        <td style={celda}>{fila.gc}</td>
                        <td style={celda}>{fila.dg}</td>
                        <td style={celda}><strong>{fila.pts}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </section>

      {patrocinadores && patrocinadores.length > 0 && (
        <section
          style={{
            marginTop: '60px',
            textAlign: 'center'
          }}
        >
          <h2>Patrocinadores Principales</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 650px))',
justifyContent: 'center',
              gap: '20px',
              marginTop: '25px'
            }}
          >
            {patrocinadores.map((patrocinador) => (
              <div
                key={patrocinador.id}
                style={{
  border: '2px solid #0b2341',
  borderRadius: '12px',
  padding: '18px',
  background: 'white',
  maxWidth: '650px',
  width: '100%',
  boxSizing: 'border-box',
  margin: '0 auto',
  textAlign: 'center'
}}
              >
                {patrocinador.imagen_url && (
                  <img
                    src={patrocinador.imagen_url}
                    alt={patrocinador.nombre}
                    style={{
                      maxWidth: '400px',
                      maxHeight: '220px',
                      objectFit: 'contain'
                    }}
                  />
                )}

                <h3>{patrocinador.nombre}</h3>
              </div>
            ))}
          </div>
        </section>
      )}

        {normales?.length > 0 && (
  <section style={{ marginTop: '50px' }}>
    <h2 style={{ textAlign: 'center', marginBottom: '25px' }}>
      Patrocinadores
    </h2>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 220px))',
justifyContent: 'center',
        gap: '20px'
      }}
    >
      {normales.map((patrocinador) => (
        <div
          key={patrocinador.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: '10px',
            padding: '20px',
            textAlign: 'center',
            background: 'white'
          }}
        >
          {patrocinador.imagen_url && (
            <img
              src={patrocinador.imagen_url}
              alt={patrocinador.nombre}
              style={{
                maxWidth: '180px',
                maxHeight: '110px',
                objectFit: 'contain'
              }}
            />
          )}

          <h3>{patrocinador.nombre}</h3>
        </div>
      ))}
    </div>
  </section>
)}
  {destacados?.length > 0 && (
  <section
    style={{
      marginTop: '50px',
      marginBottom: '50px'
    }}
  >
    <h2 style={{ textAlign: 'center' }}>
      Patrocinadores destacados
    </h2>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 320px))',
justifyContent: 'center',
        gap: '20px',
        marginTop: '25px'
      }}
    >
      {destacados.map((patrocinador) => (
        <div
          key={patrocinador.id}
          style={{
            border: '1px solid #ddd',
            borderRadius: '10px',
            padding: '20px',
            textAlign: 'center',
            background: 'white'
          }}
        >
          {patrocinador.imagen_url && (
            <img
              src={patrocinador.imagen_url}
              alt={patrocinador.nombre}
              style={{
                maxWidth: '180px',
                maxHeight: '110px',
                objectFit: 'contain'
              }}
            />
          )}

          <h3>{patrocinador.nombre}</h3>
        </div>
      ))}
    </div>
  </section>
)}
    </main>
  )
}

const celda = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'center'
}
