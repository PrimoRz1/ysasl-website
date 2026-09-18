import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Resultados() {
  const { data: divisiones, error: errorDivisiones } = await supabase
    .from('divisiones')
    .select('id, nombre')
    .order('orden')

  const { data: partidos, error: errorPartidos } = await supabase
    .from('calendario_partidos')
    .select(
      'id, jornada, division_id, division, fecha, hora, campo, local, visitante, goles_local, goles_visitante, estado'
    )
    .eq('estado', 'finalizado')
    .order('division_id')
    .order('jornada')

  const hayError = errorDivisiones || errorPartidos

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '35px 25px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1>Resultados</h1>
      <p>Yuba Sutter Adult Soccer League</p>

      {hayError && (
        <p>
          Error conectando con Supabase:{' '}
          {errorDivisiones?.message || errorPartidos?.message}
        </p>
      )}

      {divisiones?.map((division) => {
        const partidosDivision =
          partidos?.filter(
            (partido) => partido.division_id === division.id
          ) || []

        const jornadas = [
          ...new Set(partidosDivision.map((partido) => partido.jornada)),
        ].sort((a, b) => b - a)

        return (
          <section
            key={division.id}
            style={{ marginTop: '35px', marginBottom: '50px' }}
          >
            <h2>{division.nombre}</h2>

            {jornadas.map((jornada) => {
              const partidosJornada = partidosDivision.filter(
                (partido) => partido.jornada === jornada
              )

              return (
                <div key={jornada} style={{ marginTop: '25px' }}>
                  <h3>Jornada {jornada}</h3>

                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        borderCollapse: 'collapse',
                        width: '100%',
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={celda}>Fecha</th>
                          <th style={celda}>Local</th>
                          <th style={celda}>Resultado</th>
                          <th style={celda}>Visitante</th>
                        </tr>
                      </thead>

                      <tbody>
                        {partidosJornada.map((partido) => (
                          <tr key={partido.id}>
                            <td style={celda}>
                              {partido.fecha || 'Pendiente'}
                            </td>

                            <td style={celda}>{partido.local}</td>

                            <td style={celda}>
                              <strong>
                                {partido.goles_local} -{' '}
                                {partido.goles_visitante}
                              </strong>
                            </td>

                            <td style={celda}>{partido.visitante}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </section>
        )
      })}
    </main>
  )
}

const celda = {
  border: '1px solid #ddd',
  padding: '10px',
  textAlign: 'center',
}
