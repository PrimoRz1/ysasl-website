
import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

const celda = {
  border: '1px solid #ddd',
  padding: '9px',
  textAlign: 'center'
}

function nombreDivision(id) {
  return Number(id) === 1 ? 'Primera División' : 'Segunda División'
}

function mostrarFecha(fecha) {
  if (!fecha) return 'Pendiente'

  const [anio, mes, dia] = fecha.split('-')
  return `${mes}/${dia}/${anio}`
}

function mostrarHora(hora) {
  if (!hora) return 'Pendiente'

  const [horas, minutos] = hora.split(':').map(Number)
  const periodo = horas >= 12 ? 'PM' : 'AM'
  const hora12 = horas % 12 || 12

  return `${hora12}:${String(minutos).padStart(2, '0')} ${periodo}`
}

function ordenarAscendente(a, b) {
  const fechaA = `${a.fecha || '9999-12-31'} ${a.hora || '23:59'}`
  const fechaB = `${b.fecha || '9999-12-31'} ${b.hora || '23:59'}`
  return fechaA.localeCompare(fechaB)
}

function ordenarDescendente(a, b) {
  const fechaA = `${a.fecha || ''} ${a.hora || ''}`
  const fechaB = `${b.fecha || ''} ${b.hora || ''}`
  return fechaB.localeCompare(fechaA)
}

function TablaPartidos({ partidos }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={celda}>División</th>
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
          {partidos.map((partido) => {
            const resultado =
              partido.estado === 'finalizado' &&
              partido.goles_local != null &&
              partido.goles_visitante != null
                ? `${partido.goles_local} - ${partido.goles_visitante}`
                : 'vs'

            const estado =
              partido.estado === 'finalizado'
                ? 'Finalizado'
                : partido.estado === 'programado'
                ? 'Programado'
                : partido.estado === 'pospuesto'
                ? 'Pospuesto'
                : partido.estado === 'cancelado'
                ? 'Cancelado'
                : partido.estado || 'Pendiente'

            return (
              <tr key={partido.id}>
                <td style={celda}>
                  {nombreDivision(partido.division_id)}
                </td>
                <td style={celda}>{partido.jornada}</td>
                <td style={celda}>{mostrarFecha(partido.fecha)}</td>
                <td style={celda}>{mostrarHora(partido.hora)}</td>
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
                <td style={celda}>{estado}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

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

  const partesFecha = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())

  const valorFecha = (tipo) =>
    partesFecha.find((parte) => parte.type === tipo)?.value || ''

  const hoy = `${valorFecha('year')}-${valorFecha('month')}-${valorFecha('day')}`

  const todos = (partidos || []).filter(
    (partido) => [1, 2].includes(Number(partido.division_id))
  )

  const proximos = todos
    .filter(
      (partido) =>
        partido.estado === 'programado' &&
        (!partido.fecha || partido.fecha >= hoy)
    )
    .sort(ordenarAscendente)

  const resultados = todos
    .filter((partido) => partido.estado === 'finalizado')
    .sort(ordenarDescendente)

  const otros = todos
    .filter(
      (partido) =>
        partido.estado !== 'finalizado' &&
        !proximos.includes(partido)
    )
    .sort(ordenarDescendente)

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

      <section style={{ marginTop: '35px', marginBottom: '50px' }}>
        <h2>Próximos partidos</h2>
        <p>Primera y Segunda División</p>

        {proximos.length > 0 ? (
          <TablaPartidos partidos={proximos} />
        ) : (
          <p>No hay partidos próximos programados.</p>
        )}
      </section>

      <section style={{ marginBottom: '50px' }}>
        <h2>Resultados anteriores</h2>
        <p>Los resultados más recientes aparecen primero.</p>

        {resultados.length > 0 ? (
          <TablaPartidos partidos={resultados} />
        ) : (
          <p>Todavía no hay resultados registrados.</p>
        )}
      </section>

      {otros.length > 0 && (
        <section style={{ marginBottom: '50px' }}>
          <h2>Otros partidos</h2>
          <p>Partidos pendientes de actualización, pospuestos o cancelados.</p>
          <TablaPartidos partidos={otros} />
        </section>
      )}
    </main>
  )
}
