// YSASL: cuadro público de eliminación directa, SOLO LECTURA.
// Lee la temporada oficial 2026; no crea ni cambia partidos o resultados.
import { supabase } from '../lib/supabase'

const TEMPORADA_OFICIAL_2026 = 1
const FASES = new Set(['cuartos', 'repechaje', 'semifinal', 'final', 'tercer_lugar'])

function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function tipoDivision(nombre) {
  const valor = normalizar(nombre)
  if (valor.includes('primera')) return 'primera'
  if (valor.includes('segunda')) return 'segunda'
  return null
}

function cupos(total) {
  if (total >= 10) return 8
  if (total >= 7) return 6
  if (total >= 4) return 4
  return 0
}

function tablaRegular(regulares, equiposPorId) {
  // Incluye todos los equipos que disputaron la fase regular, incluso si
  // posteriormente dejaron de estar activos en la inscripción.
  const ids = [...new Set(regulares.flatMap((p) => [Number(p.local_id), Number(p.visitante_id)])
    .filter((id) => Number.isInteger(id) && id > 0))]
  const tabla = new Map(ids.map((id) => [id, {
    id, nombre: equiposPorId.get(id)?.nombre || `Equipo ${id}`,
    pts: 0, gf: 0, gc: 0, dg: 0,
  }]))
  for (const p of regulares) {
    if (p.estado !== 'finalizado' || p.goles_local == null || p.goles_visitante == null) continue
    const a = tabla.get(Number(p.local_id))
    const b = tabla.get(Number(p.visitante_id))
    const gl = Number(p.goles_local)
    const gv = Number(p.goles_visitante)
    if (!a || !b || a.id === b.id || !Number.isInteger(gl) || !Number.isInteger(gv) || gl < 0 || gv < 0) continue
    a.gf += gl; a.gc += gv
    b.gf += gv; b.gc += gl
    if (gl > gv) a.pts += 3
    else if (gv > gl) b.pts += 3
    else { a.pts += 1; b.pts += 1 }
  }
  return [...tabla.values()].map((e) => ({ ...e, dg: e.gf - e.gc }))
    .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf ||
      a.nombre.localeCompare(b.nombre) || a.id - b.id)
}

function ganadorPartido(partido, posiciones) {
  if (!partido || partido.estado !== 'finalizado' ||
    partido.goles_local == null || partido.goles_visitante == null) return null
  const gl = Number(partido.goles_local)
  const gv = Number(partido.goles_visitante)
  const local = Number(partido.local_id)
  const visitante = Number(partido.visitante_id)
  if (![gl, gv, local, visitante].every(Number.isInteger) ||
    gl < 0 || gv < 0 || local <= 0 || visitante <= 0 || local === visitante) return null
  if (gl !== gv) return gl > gv ? local : visitante
  // En cuartos y repechaje, el empate favorece al mejor sembrado.
  if (partido.fase === 'cuartos' || partido.fase === 'repechaje') {
    const a = posiciones.get(local)
    const b = posiciones.get(visitante)
    return a && b && a !== b ? (a < b ? local : visitante) : null
  }
  // Semifinal, final y tercer lugar: solamente penales registrados oficialmente.
  if (partido.penales_local == null || partido.penales_visitante == null) return null
  const pl = Number(partido.penales_local)
  const pv = Number(partido.penales_visitante)
  if (![pl, pv].every(Number.isInteger) || pl < 0 || pv < 0 || pl === pv) return null
  return pl > pv ? local : visitante
}

function perdedorPartido(partido, posiciones) {
  const ganador = ganadorPartido(partido, posiciones)
  if (!ganador) return null
  return ganador === Number(partido.local_id) ? Number(partido.visitante_id) : Number(partido.local_id)
}

function encontrarCruce(partidos, fase, a, b) {
  if (!a || !b) return null
  const encontrados = partidos.filter((p) => p.fase === fase &&
    ((Number(p.local_id) === Number(a) && Number(p.visitante_id) === Number(b)) ||
     (Number(p.local_id) === Number(b) && Number(p.visitante_id) === Number(a))))
  return encontrados.length === 1 ? encontrados[0] : null
}

function encontrarSemifinal(partidos, origen1, origen2, a, b) {
  if (origen1?.id && origen2?.id) {
    const porOrigen = partidos.filter((p) => p.fase === 'semifinal' &&
      [Number(p.partido_origen_1), Number(p.partido_origen_2)].includes(Number(origen1.id)) &&
      [Number(p.partido_origen_1), Number(p.partido_origen_2)].includes(Number(origen2.id)))
    if (porOrigen.length === 1) return porOrigen[0]
  }
  return encontrarCruce(partidos, 'semifinal', a, b)
}

function crearDuelo(partido, localId, visitanteId, localPendiente, visitantePendiente, etiqueta) {
  return {
    partido: partido || null,
    localId: partido ? Number(partido.local_id) : localId || null,
    visitanteId: partido ? Number(partido.visitante_id) : visitanteId || null,
    localPendiente, visitantePendiente, etiqueta,
  }
}

function crearCuadro(tabla, eliminatorias) {
  const cantidad = cupos(tabla.length)
  const posiciones = new Map(tabla.map((equipo, i) => [equipo.id, i + 1]))
  const semis = eliminatorias.filter((p) => p.fase === 'semifinal')
  const porSembrado = (n) => tabla[n - 1]?.id || null
  const nombreGanador = (p) => ganadorPartido(p, posiciones)
  const nombrePerdedor = (p) => perdedorPartido(p, posiciones)
  const rondas = []
  let semisConstruidas = []

  if (cantidad === 8) {
    // Orden oficial de llaves: (1-8 vs 4-5) y (2-7 vs 3-6).
    const cruces = [[1, 8], [4, 5], [2, 7], [3, 6]]
    const cuartos = cruces.map(([a, b], i) => {
      const localId = porSembrado(a)
      const visitanteId = porSembrado(b)
      const partido = encontrarCruce(eliminatorias, 'cuartos', localId, visitanteId)
      return crearDuelo(partido, localId, visitanteId, `Clasificado ${a}`, `Clasificado ${b}`, `Cuarto ${i + 1}`)
    })
    rondas.push({ nombre: 'Cuartos de final', duelos: cuartos })
    semisConstruidas = [[0, 1], [2, 3]].map(([a, b], i) => {
      const localId = nombreGanador(cuartos[a].partido)
      const visitanteId = nombreGanador(cuartos[b].partido)
      const partido = encontrarSemifinal(semis, cuartos[a].partido, cuartos[b].partido, localId, visitanteId)
      return crearDuelo(partido, localId, visitanteId, `Ganador cuarto ${a + 1}`, `Ganador cuarto ${b + 1}`, `Semifinal ${i + 1}`)
    })
  } else if (cantidad === 6) {
    const repechaje = [[3, 6], [4, 5]].map(([a, b], i) => {
      const localId = porSembrado(a)
      const visitanteId = porSembrado(b)
      const partido = encontrarCruce(eliminatorias, 'repechaje', localId, visitanteId)
      return crearDuelo(partido, localId, visitanteId, `Clasificado ${a}`, `Clasificado ${b}`, `Reclasificación ${i + 1}`)
    })
    rondas.push({ nombre: 'Reclasificación', duelos: repechaje })
    semisConstruidas = [
      crearDuelo(
        encontrarCruce(semis, 'semifinal', porSembrado(1), nombreGanador(repechaje[1].partido)),
        porSembrado(1), nombreGanador(repechaje[1].partido), '1.º (pase directo)', 'Ganador 4.º vs 5.º', 'Semifinal 1',
      ),
      crearDuelo(
        encontrarCruce(semis, 'semifinal', porSembrado(2), nombreGanador(repechaje[0].partido)),
        porSembrado(2), nombreGanador(repechaje[0].partido), '2.º (pase directo)', 'Ganador 3.º vs 6.º', 'Semifinal 2',
      ),
    ]
  } else if (cantidad === 4) {
    semisConstruidas = [[1, 4], [2, 3]].map(([a, b], i) => {
      const localId = porSembrado(a)
      const visitanteId = porSembrado(b)
      const partido = encontrarCruce(semis, 'semifinal', localId, visitanteId)
      return crearDuelo(partido, localId, visitanteId, `Clasificado ${a}`, `Clasificado ${b}`, `Semifinal ${i + 1}`)
    })
  }

  if (semisConstruidas.length !== 2) return { rondas: [], tercero: null, posiciones, cantidad }
  rondas.push({ nombre: 'Semifinales', duelos: semisConstruidas })
  const finalGuardada = eliminatorias.filter((p) => p.fase === 'final')
  const terceroGuardado = eliminatorias.filter((p) => p.fase === 'tercer_lugar')
  const final = crearDuelo(
    finalGuardada.length === 1 ? finalGuardada[0] : null,
    nombreGanador(semisConstruidas[0].partido), nombreGanador(semisConstruidas[1].partido),
    'Ganador semifinal 1', 'Ganador semifinal 2', 'Gran final',
  )
  const tercero = crearDuelo(
    terceroGuardado.length === 1 ? terceroGuardado[0] : null,
    nombrePerdedor(semisConstruidas[0].partido), nombrePerdedor(semisConstruidas[1].partido),
    'Perdedor semifinal 1', 'Perdedor semifinal 2', 'Tercer lugar',
  )
  rondas.push({ nombre: 'Final', duelos: [final] })
  return { rondas, tercero, posiciones, cantidad }
}

function fechaVisible(fecha) {
  if (!fecha) return ''
  const [anio, mes, dia] = String(fecha).split('-')
  return `${dia}/${mes}/${anio}`
}

function horaVisible(hora) {
  if (!hora) return ''
  const [h, m] = String(hora).split(':').map(Number)
  if (!Number.isInteger(h) || !Number.isInteger(m)) return ''
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function urlEscudo(equipo) {
  const ruta = equipo?.escudo_url || equipo?.logo_url || equipo?.escudo_path || ''
  if (!ruta) return null
  if (/^https?:\/\//i.test(ruta)) return ruta
  return supabase.storage.from('escudos-equipos').getPublicUrl(ruta).data.publicUrl
}

function TarjetaPartido({ duelo, equiposPorId, posiciones, camposPorId, camposVista }) {
  const p = duelo.partido
  const ganador = ganadorPartido(p, posiciones)
  const finalizado = p?.estado === 'finalizado'
  const golesValidos = finalizado && p.goles_local != null && p.goles_visitante != null
  const empatado = golesValidos && Number(p.goles_local) === Number(p.goles_visitante)
  const penales = empatado && p.penales_local != null && p.penales_visitante != null &&
    Number.isInteger(Number(p.penales_local)) && Number.isInteger(Number(p.penales_visitante))
  const campo = p ? (camposPorId.get(Number(p.campo_id)) || camposVista.get(Number(p.id))) : null
  const equipos = [
    { id: duelo.localId, pendiente: duelo.localPendiente, goles: p?.goles_local },
    { id: duelo.visitanteId, pendiente: duelo.visitantePendiente, goles: p?.goles_visitante },
  ]
  return (
    <article className="ysasl-ll-partido">
      <div className="ysasl-ll-etiqueta">
        <span>{duelo.etiqueta}</span>
        <span className="ysasl-ll-estado">{p ? (finalizado ? 'Finalizado' : p.estado === 'programado' ? 'Programado' : p.estado) : 'Por definir'}</span>
      </div>
      {equipos.map((fila, i) => {
        const equipo = fila.id ? equiposPorId.get(Number(fila.id)) : null
        const escudo = urlEscudo(equipo)
        const esGanador = ganador != null && Number(fila.id) === ganador
        return (
          <div key={i} className={`ysasl-ll-equipo${esGanador ? ' ysasl-ll-ganador' : ''}`}>
            <div className="ysasl-ll-identidad">
              {escudo ? <img src={escudo} alt="" loading="lazy" /> : <span className="ysasl-ll-escudo">⚽</span>}
              <div>
                <span className="ysasl-ll-nombre">{equipo?.nombre || fila.pendiente}</span>
                {fila.id && posiciones.get(Number(fila.id)) &&
                  <small>#{posiciones.get(Number(fila.id))} en temporada regular</small>}
              </div>
            </div>
            <strong className="ysasl-ll-marcador">{golesValidos ? fila.goles : '–'}</strong>
          </div>
        )
      })}
      {p && (
        <div className="ysasl-ll-detalle">
          {p.fecha ? fechaVisible(p.fecha) : 'Fecha pendiente'}
          {p.hora ? ` · ${horaVisible(p.hora)}` : ''}
          {p.campo_id ? ` · ${campo || 'Campo por confirmar'}` : ''}
        </div>
      )}
      {finalizado && empatado && (
        <div className="ysasl-ll-desempate">
          {['cuartos', 'repechaje'].includes(p.fase)
            ? 'Desempate: avanza el mejor clasificado'
            : penales ? `Penales: ${p.penales_local}–${p.penales_visitante}` : 'Ganador por penales pendiente'}
        </div>
      )}
    </article>
  )
}

async function obtenerDatos(divisionSolicitada) {
  const { data: divisiones, error: errorDivisiones } = await supabase.from('divisiones')
    .select('id,nombre,temporada_id,orden')
    .eq('temporada_id', TEMPORADA_OFICIAL_2026)
    .order('orden')
  if (errorDivisiones) throw errorDivisiones
  const division = (divisiones || []).find((d) => tipoDivision(d.nombre) === divisionSolicitada)
  if (!division) return null

  const [respuestaPartidos, respuestaEquipos, respuestaCampos] = await Promise.all([
    supabase.from('partidos')
      .select('id,jornada_id,local_id,visitante_id,fecha,hora,campo_id,goles_local,goles_visitante,penales_local,penales_visitante,estado,fase,partido_origen_1,partido_origen_2,jornadas!inner(division_id)')
      .eq('jornadas.division_id', Number(division.id)).order('id'),
    supabase.from('equipos').select('*'),
    supabase.from('campos').select('id,nombre,numero'),
  ])
  if (respuestaPartidos.error) throw respuestaPartidos.error
  if (respuestaEquipos.error) throw respuestaEquipos.error

  const partidos = respuestaPartidos.data || []
  const eliminatorias = partidos.filter((p) => FASES.has(p.fase))
  const regulares = partidos.filter((p) => p.fase === 'regular')
  const equiposPorId = new Map((respuestaEquipos.data || []).map((e) => [Number(e.id), e]))
  const camposPorId = new Map((respuestaCampos.data || []).map((c) => [Number(c.id), c.nombre]))
  const camposVista = new Map()
  if (eliminatorias.length) {
    const ids = eliminatorias.map((p) => Number(p.id))
    const respuestaVista = await supabase.from('calendario_partidos').select('id,campo').in('id', ids)
    if (!respuestaVista.error) {
      for (const fila of respuestaVista.data || []) {
        if (fila.campo) {
          const etiqueta = String(fila.campo)
          camposVista.set(Number(fila.id), /^campo\b/i.test(etiqueta) ? etiqueta : `Campo ${etiqueta}`)
        }
      }
    }
  }
  const tabla = tablaRegular(regulares, equiposPorId)
  return { division, eliminatorias, equiposPorId, camposPorId, camposVista, tabla }
}

export default async function LiguillaCuadro({ division = 'segunda', compacto = false }) {
  let datos
  try {
    datos = await obtenerDatos(division === 'primera' ? 'primera' : 'segunda')
  } catch (error) {
    console.error('No se pudo cargar el cuadro público de liguilla:', error.message)
    return compacto ? null : <p role="alert">No se pudo cargar el cuadro de liguilla. Intenta nuevamente más tarde.</p>
  }
  if (!datos) return compacto ? null : <p>No se encontró esta división en la temporada oficial.</p>
  if (compacto && !datos.eliminatorias.length) return null
  const cuadro = crearCuadro(datos.tabla, datos.eliminatorias)
  const sinLiguilla = !datos.eliminatorias.length

  return (
    <section className={`ysasl-ll-contenedor${compacto ? ' ysasl-ll-compacto' : ''}`} aria-label={`Cuadro de liguilla de ${datos.division.nombre}`}>
      <style>{`
        .ysasl-ll-contenedor{background:linear-gradient(145deg,#091b33,#12385c);color:#fff;border-radius:20px;padding:24px;margin:24px 0 42px;box-shadow:0 14px 35px rgba(6,22,43,.14)}
        .ysasl-ll-cabecera{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:20px}
        .ysasl-ll-cabecera h2{font-size:clamp(22px,3vw,31px);margin:0 0 7px}
        .ysasl-ll-cabecera p{margin:0;color:#c7d8ea}
        .ysasl-ll-enlace{display:inline-block;border:1px solid #f5c862;color:#ffe49c;text-decoration:none;font-weight:700;padding:11px 15px;border-radius:10px}
        .ysasl-ll-enlace:hover{background:rgba(245,200,98,.12)}
        .ysasl-ll-desplazar{overflow-x:auto;padding:2px 2px 15px;scrollbar-color:#8aa2b9 transparent}
        .ysasl-ll-grid{display:grid;grid-template-columns:repeat(3,minmax(225px,1fr));gap:18px;min-width:755px;align-items:stretch}
        .ysasl-ll-grid.dos{grid-template-columns:repeat(2,minmax(235px,1fr));min-width:510px}
        .ysasl-ll-columna{display:flex;flex-direction:column;gap:16px}
        .ysasl-ll-ronda{font-size:14px;text-transform:uppercase;letter-spacing:1.2px;color:#f8d887;text-align:center;font-weight:800;padding:8px 4px;border-bottom:1px solid rgba(255,255,255,.2)}
        .ysasl-ll-duelos{display:flex;flex-direction:column;justify-content:space-around;gap:20px;flex:1;padding:8px 0}
        .ysasl-ll-partido{position:relative;border:1px solid rgba(218,232,246,.24);background:#fff;color:#162a40;border-radius:13px;padding:12px;box-shadow:0 6px 14px rgba(0,0,0,.12)}
        .ysasl-ll-columna:not(:last-child) .ysasl-ll-partido:after{content:'';position:absolute;right:-19px;top:50%;width:18px;border-top:2px solid #e6c56d}
        .ysasl-ll-columna:last-child .ysasl-ll-partido{border:2px solid #e6c56d}
        .ysasl-ll-etiqueta{display:flex;justify-content:space-between;gap:8px;color:#54708a;font-size:11px;font-weight:800;text-transform:uppercase;margin-bottom:9px}
        .ysasl-ll-estado{color:#23614c}
        .ysasl-ll-equipo{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 5px;border-radius:7px}
        .ysasl-ll-equipo+.ysasl-ll-equipo{border-top:1px solid #e5ebf2}
        .ysasl-ll-ganador{background:#fff2c2;border-left:4px solid #d5a42a}
        .ysasl-ll-identidad{display:flex;align-items:center;gap:8px;min-width:0}
        .ysasl-ll-identidad img,.ysasl-ll-escudo{width:30px;height:30px;object-fit:contain;flex-shrink:0}
        .ysasl-ll-escudo{display:grid;place-items:center;font-size:20px}
        .ysasl-ll-nombre{font-weight:800;font-size:13px;display:block;overflow-wrap:anywhere}
        .ysasl-ll-identidad small{font-size:10px;color:#6a7888;display:block}
        .ysasl-ll-marcador{font-size:20px;flex-shrink:0}
        .ysasl-ll-detalle{font-size:11px;color:#566e82;margin-top:10px;border-top:1px solid #e5ebf2;padding-top:8px;text-align:center}
        .ysasl-ll-desempate{font-size:11px;font-weight:700;color:#925b0b;text-align:center;margin-top:5px}
        .ysasl-ll-tercero{max-width:330px;margin:20px auto 0}
        .ysasl-ll-tercero h3{font-size:14px;text-align:center;color:#f8d887;letter-spacing:1px}
        .ysasl-ll-ayuda{color:#cbd9e8;font-size:12px;margin:12px 0 0}
        .ysasl-ll-vacio{background:rgba(255,255,255,.09);border-radius:12px;padding:20px;color:#dbe7f5}
        @media(max-width:700px){.ysasl-ll-contenedor{padding:17px 12px}.ysasl-ll-grid{gap:12px}.ysasl-ll-cabecera{align-items:flex-start}}
      `}</style>
      <div className="ysasl-ll-cabecera">
        <div>
          <h2>🏆 Camino al campeonato</h2>
          <p>{datos.division.nombre} · Verano / Invierno 2026</p>
        </div>
        {compacto && <a className="ysasl-ll-enlace" href="/liguilla?division=segunda">Ver cuadro completo →</a>}
      </div>
      {sinLiguilla ? (
        <div className="ysasl-ll-vacio">Todavía no hay partidos de liguilla guardados oficialmente para esta división.</div>
      ) : cuadro.rondas.length === 0 ? (
        <div className="ysasl-ll-vacio">La liguilla está registrada, pero falta información para construir las llaves. No se mostrarán cruces supuestos.</div>
      ) : (
        <>
          <div className="ysasl-ll-desplazar" role="region" tabIndex={0} aria-label="Cuadro de eliminación directa, desliza horizontalmente en pantallas pequeñas">
            <div className={`ysasl-ll-grid${cuadro.rondas.length === 2 ? ' dos' : ''}`}>
              {cuadro.rondas.map((ronda) => (
                <div className="ysasl-ll-columna" key={ronda.nombre}>
                  <div className="ysasl-ll-ronda">{ronda.nombre}</div>
                  <div className="ysasl-ll-duelos">
                    {ronda.duelos.map((duelo) => (
                      <TarjetaPartido key={duelo.etiqueta} duelo={duelo}
                        equiposPorId={datos.equiposPorId} posiciones={cuadro.posiciones}
                        camposPorId={datos.camposPorId} camposVista={datos.camposVista} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {!compacto && cuadro.tercero && (
            <div className="ysasl-ll-tercero">
              <h3>🥉 Partido por el tercer lugar</h3>
              <TarjetaPartido duelo={cuadro.tercero}
                equiposPorId={datos.equiposPorId} posiciones={cuadro.posiciones}
                camposPorId={datos.camposPorId} camposVista={datos.camposVista} />
            </div>
          )}
          <p className="ysasl-ll-ayuda">Los marcadores y avances se muestran únicamente a partir de resultados oficiales. En cuartos y reclasificación, un empate favorece al mejor clasificado; en semifinales y final se requieren penales.</p>
        </>
      )}
    </section>
  )
}
