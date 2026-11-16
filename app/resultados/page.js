import { supabase } from '../../lib/supabase'
import {
  filtrarDivisionesOficiales,
  filtrarTemporadasOficiales,
  seleccionarTemporadaVigente,
} from '../../lib/temporadas-publicas'

export const dynamic = 'force-dynamic'

export default async function Resultados({ searchParams }) {
  const parametros = await searchParams
  const [respuestaTemporadas, respuestaDivisiones] = await Promise.all([
    supabase.from('temporadas').select('id,nombre,activa').order('id', { ascending: false }),
    supabase.from('divisiones').select('id,nombre,temporada_id').order('orden').order('id'),
  ])

  const temporadas = filtrarTemporadasOficiales(respuestaTemporadas.data)
  const divisiones = filtrarDivisionesOficiales(respuestaDivisiones.data, temporadas)
  const idsTemporadas = new Set(divisiones.map((division) => String(division.temporada_id)))
  const temporadasDisponibles = temporadas.filter((temporada) => idsTemporadas.has(String(temporada.id)))
  const vigente = seleccionarTemporadaVigente(temporadasDisponibles, divisiones)
  const seleccionada = temporadasDisponibles.find(
    (temporada) => String(temporada.id) === parametros?.temporada
  ) || vigente
  const divisionesVisibles = divisiones.filter(
    (division) => String(division.temporada_id) === String(seleccionada?.id)
  )

  let hayError = respuestaTemporadas.error || respuestaDivisiones.error
  const partidosPorDivision = new Map()
  if (!hayError && divisionesVisibles.length > 0) {
    const idsDivisiones = divisionesVisibles.map((division) => division.id)
    const limite = 500
    for (let desde = 0; ; desde += limite) {
      const { data, error } = await supabase.from('calendario_partidos')
        .select('id,jornada,division_id,fecha,local,visitante,goles_local,goles_visitante')
        .in('division_id', idsDivisiones)
        .eq('estado', 'finalizado')
        .not('goles_local', 'is', null)
        .not('goles_visitante', 'is', null)
        .order('fecha', { ascending: true, nullsFirst: false })
        .order('id')
        .range(desde, desde + limite - 1)

      if (error) {
        hayError = error
        break
      }

      for (const partido of data) {
        const id = String(partido.division_id)
        if (!partidosPorDivision.has(id)) partidosPorDivision.set(id, [])
        partidosPorDivision.get(id).push(partido)
      }
      if (data.length < limite) break
    }
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
      <h1>Resultados</h1>
      <p>Yuba Sutter Adult Soccer League</p>

      {temporadasDisponibles.length > 0 && (
        <form action="/resultados" method="get"
          style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="temporada-resultados">Temporada</label>
          <select id="temporada-resultados" name="temporada"
            defaultValue={String(seleccionada.id)} style={{ maxWidth: '100%', padding: '8px' }}>
            {temporadasDisponibles.map((temporada) => (
              <option key={temporada.id} value={temporada.id}>
                {temporada.nombre}{temporada.id === vigente?.id ? ' (vigente)' : ''}
              </option>
            ))}
          </select>
          <button type="submit" style={{ padding: '8px 12px' }}>Ver resultados</button>
        </form>
      )}

      {hayError && <p role="alert">No se pudieron cargar los resultados.</p>}
      {!hayError && divisionesVisibles.length === 0 && <p>No hay divisiones disponibles.</p>}

      {!hayError && divisionesVisibles.map((division) => {
        const partidosDivision = partidosPorDivision.get(String(division.id)) || []

        const jornadas = [
          ...new Set(partidosDivision.map((partido) => partido.jornada)),
        ].sort((a, b) => b - a)

        return (
          <section
            key={division.id}
            style={{ marginTop: '35px', marginBottom: '50px' }}
          >
            <h2>{division.nombre}</h2>
            {jornadas.length === 0 && <p>Aún no hay resultados oficiales en esta división.</p>}

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
