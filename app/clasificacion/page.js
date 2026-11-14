import { supabase } from '../../lib/supabase'
import { filtrarTemporadasOficiales, filtrarDivisionesOficiales, seleccionarTemporadaVigente } from '../../lib/temporadas-publicas'

export const dynamic = 'force-dynamic'

// Misma regla de zona de liguilla que en la pagina de Inicio.
function cantidadClasificados(totalEquipos) {
  if (totalEquipos >= 10) return 8
  if (totalEquipos >= 7) return 6
  if (totalEquipos >= 4) return 4
  return 0
}

export default async function Clasificacion({ searchParams }) {
  const parametros = (await searchParams) || {}
  const temporadaSolicitadaId = String(parametros.temporada || '')

  const [respuestaTemporadas, respuestaDivisiones, respuestaClasificacion] = await Promise.all([
    supabase.from('temporadas').select('id,nombre,activa'),
    supabase.from('divisiones').select('id,nombre,temporada_id,orden').order('orden'),
    supabase.from('clasificacion')
      .select('division_id,equipo,pj,pg,pe,pp,gf,gc,dg,pts')
  ])

  const temporadasOficiales = filtrarTemporadasOficiales(respuestaTemporadas.data)
  const divisionesOficiales = filtrarDivisionesOficiales(
    respuestaDivisiones.data, temporadasOficiales
  )
  const temporadasConDivisiones = temporadasOficiales.filter((temporada) =>
    divisionesOficiales.some((division) =>
      Number(division.temporada_id) === Number(temporada.id)
    )
  ).sort((a, b) => Number(b.id) - Number(a.id))

  const temporadaVigente = seleccionarTemporadaVigente(
    temporadasOficiales, divisionesOficiales
  )
  const temporadaSeleccionada = temporadasConDivisiones.find(
    (temporada) => String(temporada.id) === temporadaSolicitadaId
  ) || temporadaVigente

  const divisionesVisibles = divisionesOficiales.filter((division) =>
    Number(division.temporada_id) === Number(temporadaSeleccionada?.id)
  )

  const hayError = respuestaTemporadas.error ||
    respuestaDivisiones.error || respuestaClasificacion.error

  // Misma fuente oficial que utiliza la portada; cada división pertenece
  // a una sola temporada, sin mezclar partidos de otros torneos.
  function calcularClasificacion(divisionId) {
    return (respuestaClasificacion.data || [])
      .filter((fila) => Number(fila.division_id) === Number(divisionId))
      .sort((a, b) =>
        Number(b.pts || 0) - Number(a.pts || 0) ||
        Number(b.dg || 0) - Number(a.dg || 0) ||
        Number(b.gf || 0) - Number(a.gf || 0) ||
        String(a.equipo).localeCompare(String(b.equipo))
      )
  }

  const celda = {
    borderBottom: '1px solid #dce5ee',
    padding: '13px 12px',
    textAlign: 'center',
    fontSize: '15px',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  }

  const encabezado = {
    ...celda,
    background: '#0b2341',
    color: '#fff',
    fontWeight: 'bold',
    borderBottom: 'none',
    padding: '14px 12px',
    fontSize: '14px',
  }

  return (
    <main
      style={{
        maxWidth: '1120px',
        margin: '0 auto',
        padding: '32px 18px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1 style={{ color: '#0b2341', marginBottom: '8px', fontSize: '32px' }}>
        Clasificación
      </h1>
      <p style={{ marginTop: 0, color: '#64748b', fontSize: '15px' }}>
        Yuba Sutter Adult Soccer League
      </p>

      <p style={{ color: '#0b2341', fontWeight: 'bold', marginBottom: '12px' }}>
        Torneo: {temporadaSeleccionada?.nombre || 'Sin torneo disponible'}
      </p>

      {temporadasConDivisiones.length > 0 && (
        <form action="/clasificacion" method="get" style={{
          display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center',
          padding: '14px', background: '#f1f5f9', borderRadius: '9px'
        }}>
          <label htmlFor="temporada-clasificacion" style={{ fontWeight: 'bold' }}>
            Consultar torneo:
          </label>
          <select id="temporada-clasificacion" name="temporada"
            defaultValue={String(temporadaSeleccionada?.id || '')}
            style={{ padding: '10px', maxWidth: '100%', borderRadius: '6px', border: '1px solid #94a3b8' }}>
            {temporadasConDivisiones.map((temporada) => (
              <option key={temporada.id} value={temporada.id}>
                {temporada.nombre}{Number(temporada.id) === Number(temporadaVigente?.id) ? ' (vigente)' : ' (historial)'}
              </option>
            ))}
          </select>
          <button type="submit" style={{
            background: '#0b2341', color: 'white', border: 0, borderRadius: '6px',
            padding: '11px 16px', fontWeight: 'bold', cursor: 'pointer'
          }}>Ver clasificación</button>
        </form>
      )}

      <p style={{ color: '#64748b', fontSize: '14px' }}>
        Puedes consultar los torneos anteriores sin alterar sus resultados.
      </p>

      {hayError && (
        <p style={{ color: 'red' }}>Error al cargar la clasificación.</p>
      )}

      {!hayError && divisionesVisibles.length === 0 && (
        <p>No hay divisiones registradas para este torneo.</p>
      )}

      {divisionesVisibles.map((division) => {
        const clasificacion = calcularClasificacion(division.id)
        const cupos = cantidadClasificados(clasificacion.length)

        return (
          <section key={division.id} style={{ marginTop: '36px', marginBottom: '48px' }}>
            <h2 style={{ color: '#0b2341', fontSize: '23px', marginBottom: '12px' }}>
              {division.nombre}
            </h2>

            {clasificacion.length === 0 ? (
              <p>Todavía no hay equipos o resultados disponibles para esta división.</p>
            ) : (
              <>
                {cupos > 0 && (
                  <p style={{ fontSize: '14px', color: '#166534', margin: '8px 0 14px' }}>
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        width: '13px',
                        height: '13px',
                        background: '#dcfce7',
                        border: '1px solid #86b99a',
                        borderRadius: '3px',
                        verticalAlign: 'middle',
                        marginRight: '8px',
                      }}
                    />
                    Verde claro: zona de liguilla (primeros {cupos} de {clasificacion.length} equipos).
                  </p>
                )}

                <div
                  role="region"
                  aria-label={`Tabla de clasificación de ${division.nombre}`}
                  tabIndex={0}
                  style={{
                    width: '100%',
                    overflowX: 'auto',
                    WebkitOverflowScrolling: 'touch',
                    border: '1px solid #dbe2ea',
                    borderRadius: '9px',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      minWidth: '830px',
                      borderCollapse: 'collapse',
                      tableLayout: 'auto',
                    }}
                  >
                    <thead>
                      <tr>
                        <th scope="col" style={{ ...encabezado, width: '42px' }}>#</th>
                        <th scope="col" style={{ ...encabezado, textAlign: 'left', minWidth: '200px' }}>Equipo</th>
                        <th scope="col" style={encabezado}>PTS</th>
                        <th scope="col" style={encabezado}>PJ</th>
                        <th scope="col" style={encabezado}>PG</th>
                        <th scope="col" style={encabezado}>PE</th>
                        <th scope="col" style={encabezado}>PP</th>
                        <th scope="col" style={encabezado}>GF</th>
                        <th scope="col" style={encabezado}>GC</th>
                        <th scope="col" style={encabezado}>DG</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clasificacion.map((equipo, index) => {
                        const fondo = index < cupos
                          ? '#dcfce7'
                          : index % 2 === 0 ? '#ffffff' : '#f8fafc'
                        return (
                          <tr key={`${division.id}-${equipo.equipo}`} style={{ background: fondo }}>
                            <td style={celda}>{index + 1}</td>
                            <td style={{ ...celda, textAlign: 'left', fontWeight: 'bold' }}>
                              {equipo.equipo}
                            </td>
                            <td style={{ ...celda, fontWeight: 'bold', color: '#0b2341' }}>{equipo.pts}</td>
                            <td style={celda}>{equipo.pj}</td>
                            <td style={celda}>{equipo.pg}</td>
                            <td style={celda}>{equipo.pe}</td>
                            <td style={celda}>{equipo.pp}</td>
                            <td style={celda}>{equipo.gf}</td>
                            <td style={celda}>{equipo.gc}</td>
                            <td style={celda}>{equipo.dg > 0 ? `+${equipo.dg}` : equipo.dg}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )
      })}
    </main>
  )
}
