import { supabase } from '../lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Home() {
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

  const { data: partidos, error: errorPartidos } = await supabase
    .from('calendario_partidos')
    .select(
      'id, jornada, division_id, division, fecha, hora, campo, local, visitante, goles_local, goles_visitante, estado'
    )
    .order('division_id')
    .order('jornada')
    .order('fecha')
    .order('hora')

  const hayError =
    errorDivisiones || errorClasificacion || errorPartidos

  return (
    <main
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '30px 20px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <h1>Yuba Sutter Adult Soccer League</h1>
      <h2>YSASL</h2>
      <p>Sitio oficial de la liga.</p>

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
            errorPartidos?.message}
        </div>
      )}

      {divisiones?.map((division) => {
        const tabla = clasificacion?.filter(
          (fila) => fila.division_id === division.id
        )

        const partidosDivision = partidos?.filter(
          (partido) => partido.division_id === division.id
        )

        return (
          <section
            key={division.id}
            style={{ marginTop: '45px', marginBottom: '60px' }}
          >
            <h2>{division.nombre}</h2>

            <h3>Clasificación</h3>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  marginBottom: '35px'
                }}
              >
                <thead>
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
                  {tabla?.map((fila, index) => (
                    <tr key={`${division.id}-${fila.equipo}`}>
                      <td style={celda}>{index + 1}</td>

                      <td style={{ ...celda, textAlign: 'left' }}>
                        {fila.equipo}
                      </td>

                      <td style={celda}>{fila.pj}</td>
                      <td style={celda}>{fila.pg}</td>
                      <td style={celda}>{fila.pe}</td>
                      <td style={celda}>{fila.pp}</td>
                      <td style={celda}>{fila.gf}</td>
                      <td style={celda}>{fila.gc}</td>
                      <td style={celda}>{fila.dg}</td>

                      <td style={celda}>
                        <strong>{fila.pts}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Calendario y Resultados</h3>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%'
                }}
              >
                <thead>
                  <tr>
                    <th style={celda}>Jornada</th>
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
                  {partidosDivision?.map((partido) => {
                    const resultado =
                      partido.estado === 'finalizado'
                        ? `${partido.goles_local} - ${partido.goles_visitante}`
                        : 'vs'

                    return (
                      <tr key={partido.id}>
                        <td style={celda}>{partido.jornada}</td>

                        <td style={celda}>
                          {partido.fecha || 'Pendiente'}
                        </td>

                        <td style={celda}>
                          {partido.hora
                            ? partido.hora.slice(0, 5)
                            : 'Pendiente'}
                        </td>

                        <td style={celda}>
                          {partido.campo
                            ? `Campo ${partido.campo}`
                            : 'Pendiente'}
                        </td>

                        <td style={celda}>{partido.local}</td>

                        <td style={celda}>
                          <strong>{resultado}</strong>
                        </td>

                        <td style={celda}>{partido.visitante}</td>

                        <td style={celda}>
                          {partido.estado === 'finalizado'
                            ? 'Finalizado'
                            : partido.estado === 'programado'
                            ? 'Programado'
                            : partido.estado}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
    </main>
  )
}

const celda = {
  border: '1px solid #ddd',
  padding: '8px',
  textAlign: 'center'
}
