import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Clasificacion() {
  const { data: divisiones, error: errorDivisiones } = await supabase
    .from('divisiones')
    .select('id, nombre')
    .order('orden')

  const { data: partidos, error: errorPartidos } = await supabase
    .from('partidos')
    .select('*')
    .eq('estado', 'finalizado')

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

    const partidosDivision = (partidos || []).filter(
      (partido) => Number(partido.division_id) === Number(divisionId)
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
          pj: 0,
          pg: 0,
          pe: 0,
          pp: 0,
          gf: 0,
          gc: 0,
          dg: 0,
          pts: 0,
        }
      }

      if (!tabla[visitante]) {
        tabla[visitante] = {
          equipo: equipos?.find((e) => Number(e.id) === Number(visitante))?.nombre || `Equipo ${visitante}`,
          pj: 0,
          pg: 0,
          pe: 0,
          pp: 0,
          gf: 0,
          gc: 0,
          dg: 0,
          pts: 0,
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
      .map((equipo) => ({
        ...equipo,
        dg: equipo.gf - equipo.gc,
      }))
      .sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts
        if (b.dg !== a.dg) return b.dg - a.dg
        if (b.gf !== a.gf) return b.gf - a.gf
        return a.equipo.localeCompare(b.equipo)
      })
  }

  const celda = {
    border: '1px solid #ddd',
    padding: '10px',
    textAlign: 'center',
  }

  const equipoCelda = {
    ...celda,
    textAlign: 'left',
  }

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '35px 25px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1>Clasificación</h1>

      <p>Yuba Sutter Adult Soccer League</p>

      {hayError && (
        <p style={{ color: 'red' }}>
          Error al cargar la clasificación.
        </p>
      )}

      {(divisiones || []).map((division) => {
        const clasificacion = calcularClasificacion(division.id)

        return (
          <section
            key={division.id}
            style={{ marginTop: '35px', marginBottom: '50px' }}
          >
            <h2>{division.nombre}</h2>

            {clasificacion.length === 0 ? (
              <p>No hay resultados registrados para esta división.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    borderCollapse: 'collapse',
                    width: '100%',
                  }}
                >
                  <thead>
                    <tr>
                      <th style={celda}>#</th>
                      <th style={equipoCelda}>Equipo</th>
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
                    {clasificacion.map((equipo, index) => (
                      <tr key={equipo.equipo}>
                        <td style={celda}>{index + 1}</td>

                        <td style={equipoCelda}>
                          {equipo.equipo}
                        </td>

                        <td style={celda}>{equipo.pj}</td>
                        <td style={celda}>{equipo.pg}</td>
                        <td style={celda}>{equipo.pe}</td>
                        <td style={celda}>{equipo.pp}</td>
                        <td style={celda}>{equipo.gf}</td>
                        <td style={celda}>{equipo.gc}</td>
                        <td style={celda}>{equipo.dg}</td>

                        <td
                          style={{
                            ...celda,
                            fontWeight: 'bold',
                          }}
                        >
                          {equipo.pts}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </main>
  )
}
