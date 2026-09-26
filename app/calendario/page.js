import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

export default async function Calendario() {
  const { data: partidos, error } = await supabase
    .from('calendario_partidos')
    .select(
      'id, jornada, division_id, division, fecha, hora, campo, local, visitante, goles_local, goles_visitante, estado'
    )
    .order('division_id')
    .order('jornada')
    .order('fecha')
    .order('hora')

  return (
    <main
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '30px 20px',
        fontFamily: 'Arial, sans-serif'
      }}
    >
      <h1>Calendario</h1>
      <p>Yuba Sutter Adult Soccer League</p>

      {error && (
        <p>Error conectando con Supabase: {error.message}</p>
      )}

      {[1, 2].map((divisionId) => {
        const nombreDivision =
          divisionId === 1 ? 'Primera División' : 'Segunda División'

        const partidosDivision =
          partidos?.filter(
            (partido) => partido.division_id === divisionId
          ) || []

        const jornadas = [
          ...new Set(partidosDivision.map((partido) => partido.jornada))
        ].sort((a, b) => a - b)

        return (
          <section
            key={divisionId}
            style={{ marginTop: '40px', marginBottom: '60px' }}
          >
            <h2>{nombreDivision}</h2>

            {jornadas.map((jornada) => {
              const partidosJornada = partidosDivision.filter(
                (partido) => partido.jornada === jornada
              )

              return (
                <div key={jornada} style={{ marginBottom: '35px' }}>
                  <h3>Jornada {jornada}</h3>

                  <div style={{ overflowX: 'auto' }}>
                    <table
                      style={{
                        width: '100%',
                        borderCollapse: 'collapse'
                      }}
                    >
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
                        {partidosJornada.map((partido) => {
                          const resultado =
                            partido.estado === 'finalizado'
                              ? `${partido.goles_local} - ${partido.goles_visitante}`
                              : 'vs'

                          return (
                            <tr key={partido.id}>
                              <td style={celda}>
                                {partido.fecha || 'Pendiente'}
                              </td>

                              <td style={celda}>
                                {partido.hora
  ? new Date(`2000-01-01T${partido.hora}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
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
  padding: '9px',
  textAlign: 'center'
}
