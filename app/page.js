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

  return (
    <main style={{ padding: '30px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Yuba Sutter Adult Soccer League</h1>
      <h2>YSASL</h2>
      <p>Sitio oficial de la liga.</p>

      {(errorDivisiones || errorClasificacion) && (
        <p>
          Error conectando con Supabase:{' '}
          {errorDivisiones?.message || errorClasificacion?.message}
        </p>
      )}

      {divisiones?.map((division) => {
        const tabla = clasificacion?.filter(
          (fila) => fila.division_id === division.id
        )

        return (
          <section key={division.id} style={{ marginTop: '40px' }}>
            <h2>{division.nombre}</h2>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  borderCollapse: 'collapse',
                  width: '100%',
                  maxWidth: '900px'
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
