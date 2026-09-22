import { supabase } from "../../lib/supabase"

export const dynamic = "force-dynamic"

export default async function Goleadores() {
  const { data: eventos, error: errorEventos } = await supabase
    .from("eventos_partido")
    .select("jugador_id, equipo_id, tipo")
    .eq("tipo", "gol")

  const { data: jugadores, error: errorJugadores } = await supabase
    .from("jugadores")
    .select("id, nombre, equipo_id")

  const { data: equipos, error: errorEquipos } = await supabase
    .from("equipos")
    .select("id, nombre, division_id")

  const hayError = errorEventos || errorJugadores || errorEquipos

  const jugadoresMap = {}
  ;(jugadores || []).forEach((jugador) => {
    jugadoresMap[Number(jugador.id)] = jugador
  })

  const equiposMap = {}
  ;(equipos || []).forEach((equipo) => {
    equiposMap[Number(equipo.id)] = equipo
  })

  const tabla = {}

  ;(eventos || []).forEach((evento) => {
    const jugadorId = Number(evento.jugador_id)
    const equipoId = Number(evento.equipo_id)
    const jugador = jugadoresMap[jugadorId]
    const equipo = equiposMap[equipoId]

    if (!jugador || !equipo) return

    if (!tabla[jugadorId]) {
      tabla[jugadorId] = {
        jugador: jugador.nombre,
        equipo: equipo.nombre,
        division_id: equipo.division_id,
        goles: 0,
      }
    }

    tabla[jugadorId].goles += 1
  })

  const goleadores = Object.values(tabla).sort((a, b) => {
    if (b.goles !== a.goles) return b.goles - a.goles
    return a.jugador.localeCompare(b.jugador)
  })

  const primera = goleadores.filter(
    (jugador) => Number(jugador.division_id) === 1
  )

  const segunda = goleadores.filter(
    (jugador) => Number(jugador.division_id) === 2
  )

  const celda = {
    border: "1px solid #ddd",
    padding: "10px",
    textAlign: "center",
  }

  const renderTabla = (lista) => (
    <table
      style={{
        borderCollapse: "collapse",
        width: "100%",
        marginBottom: "40px",
      }}
    >
      <thead>
        <tr>
          <th style={celda}>#</th>
          <th style={{ ...celda, textAlign: "left" }}>Jugador</th>
          <th style={{ ...celda, textAlign: "left" }}>Equipo</th>
          <th style={celda}>Goles</th>
        </tr>
      </thead>

      <tbody>
        {lista.length === 0 ? (
          <tr>
            <td style={celda} colSpan="4">
              No hay goles registrados todavía.
            </td>
          </tr>
        ) : (
          lista.map((jugador, index) => (
            <tr key={`${jugador.jugador}-${jugador.equipo}`}>
              <td style={celda}>{index + 1}</td>
              <td style={{ ...celda, textAlign: "left" }}>
                {jugador.jugador}
              </td>
              <td style={{ ...celda, textAlign: "left" }}>
                {jugador.equipo}
              </td>
              <td style={{ ...celda, fontWeight: "bold" }}>
                {jugador.goles}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  )

  return (
    <main
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "35px 25px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>Goleadores</h1>

      <p>Yuba Sutter Adult Soccer League</p>

      {hayError && (
        <p style={{ color: "red" }}>
          Error al cargar los goleadores.
        </p>
      )}

      <h2 style={{ marginTop: "35px" }}>Primera División</h2>
      {renderTabla(primera)}

      <h2>Segunda División</h2>
      {renderTabla(segunda)}
    </main>
  )
}
