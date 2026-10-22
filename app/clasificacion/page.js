import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

// Misma regla de zona de liguilla que en la pagina de Inicio.
function cantidadClasificados(totalEquipos) {
  if (totalEquipos >= 10) return 8
  if (totalEquipos >= 7) return 6
  if (totalEquipos >= 4) return 4
  return 0
}

export default async function Clasificacion() {
  const { data: divisiones, error: errorDivisiones } = await supabase
    .from('divisiones')
    .select('id, nombre')
    .order('orden')

  const { data: partidos, error: errorPartidos } = await supabase
    .from('partidos')
    .select('*')
    .eq('estado', 'finalizado')
    .eq('fase', 'regular')

  const { data: equipos, error: errorEquipos } = await supabase
    .from('equipos')
    .select('id, division_id, nombre')

  const hayError = errorDivisiones || errorPartidos || errorEquipos

  function calcularClasificacion(divisionId) {
    const tabla = {}
    const equiposDivision = (equipos || []).filter(
      (equipo) => Number(equipo.division_id) === Number(divisionId)
    )

    equiposDivision.forEach((equipo) => {
      tabla[equipo.id] = {
        equipo: equipo.nombre,
        pj: 0,
        pg: 0,
        pe: 0,
        pp: 0,
        gf: 0,
        gc: 0,
        dg: 0,
        pts: 0,
      }
    })

    const idsEquiposDivision = new Set(
      equiposDivision.map((equipo) => Number(equipo.id))
    )

    const partidosDivision = (partidos || []).filter(
      (partido) =>
        idsEquiposDivision.has(Number(partido.local_id)) &&
        idsEquiposDivision.has(Number(partido.visitante_id))
    )

    partidosDivision.forEach((partido) => {
      const local = partido.local_id
      const visitante = partido.visitante_id
      const golesLocal = Number(partido.goles_local)
      const golesVisitante = Number(partido.goles_visitante)

      if (
        !local ||
        !visitante ||
        Number.isNaN(golesLocal) ||
        Number.isNaN(golesVisitante)
      ) {
        return
      }

      if (!tabla[local]) {
        tabla[local] = {
          equipo: equipos?.find((e) => Number(e.id) === Number(local))?.nombre || `Equipo ${local}`,
          pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0,
        }
      }

      if (!tabla[visitante]) {
        tabla[visitante] = {
          equipo: equipos?.find((e) => Number(e.id) === Number(visitante))?.nombre || `Equipo ${visitante}`,
          pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0,
        }
      }

      tabla[local].pj += 1
      tabla[visitante].pj += 1

      tabla[local].gf += golesLocal
      tabla[local].gc += golesVisitante
      tabla[visitante].gf += golesVisitante
      tabla[visitante].gc += golesLocal

      if (golesLocal > golesVisitante) {
        tabla[local].pg += 1
        tabla[local].pts += 3
        tabla[visitante].pp += 1
      } else if (golesLocal < golesVisitante) {
        tabla[visitante].pg += 1
        tabla[visitante].pts += 3
        tabla[local].pp += 1
      } else {
        tabla[local].pe += 1
        tabla[visitante].pe += 1
        tabla[local].pts += 1
        tabla[visitante].pts += 1
      }
    })

    return Object.values(tabla)
      .map((equipo) => ({ ...equipo, dg: equipo.gf - equipo.gc }))
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts
        if (b.dg !== a.dg) return b.dg - a.dg
        if (b.gf !== a.gf) return b.gf - a.gf
        return a.equipo.localeCompare(b.equipo)
      })
  }

  const celda = {
    borderBottom: '1px solid #e2e8f0',
    padding: '7px 8px',
    textAlign: 'center',
    fontSize: '12px',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  }

  const encabezado = {
    ...celda,
    background: '#0b2341',
    color: '#fff',
    fontWeight: 'bold',
    borderBottom: 'none',
    padding: '9px 8px',
  }

  return (
    <main
      style={{
        maxWidth: '1000px',
        margin: '0 auto',
        padding: '24px 12px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1 style={{ color: '#0b2341', marginBottom: '6px' }}>Clasificación</h1>
      <p style={{ marginTop: 0, color: '#64748b', fontSize: '14px' }}>
        Yuba Sutter Adult Soccer League
      </p>

      {hayError && (
        <p style={{ color: 'red' }}>Error al cargar la clasificación.</p>
      )}

      {(divisiones || []).map((division) => {
        const clasificacion = calcularClasificacion(division.id)
        const cupos = cantidadClasificados(clasificacion.length)

        return (
          <section key={division.id} style={{ marginTop: '28px', marginBottom: '36px' }}>
            <h2 style={{ color: '#0b2341', fontSize: '19px', marginBottom: '8px' }}>
              {division.nombre}
            </h2>

            {clasificacion.length === 0 ? (
              <p>No hay resultados registrados para esta división.</p>
            ) : (
              <>
                {cupos > 0 && (
                  <p style={{ fontSize: '12px', color: '#166534', margin: '6px 0 10px' }}>
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        width: '11px',
                        height: '11px',
                        background: '#dcfce7',
                        border: '1px solid #86b99a',
                        borderRadius: '2px',
                        verticalAlign: 'middle',
                        marginRight: '6px',
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
                    borderRadius: '7px',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      minWidth: '640px',
                      borderCollapse: 'collapse',
                      tableLayout: 'auto',
                    }}
                  >
                    <thead>
                      <tr>
                        <th scope="col" style={{ ...encabezado, width: '35px' }}>#</th>
                        <th scope="col" style={{ ...encabezado, textAlign: 'left', minWidth: '155px' }}>Equipo</th>
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
