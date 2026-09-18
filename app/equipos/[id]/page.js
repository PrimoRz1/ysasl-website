import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function EquipoPage({ params }) {
  const { id } = await params

  const { data: equipo, error: errorEquipo } = await supabase
    .from('equipos')
    .select('id, nombre, escudo_url')
    .eq('id', id)
    .single()

  const { data: jugadores, error: errorJugadores } = await supabase
    .from('jugadores')
    .select('id, nombre, numero, foto_url')
    .eq('equipo_id', id)
    .eq('activo', true)
    .order('numero')

  if (errorEquipo || !equipo) {
    return (
      <main
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '40px 20px',
        }}
      >
        <h1>Equipo no encontrado</h1>
        <Link href="/equipos">← Regresar a Equipos</Link>
      </main>
    )
  }

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '40px 20px',
      }}
    >
      <Link
        href="/equipos"
        style={{
          textDecoration: 'none',
          fontWeight: 'bold',
        }}
      >
        ← EQUIPOS
      </Link>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '25px',
          marginTop: '30px',
          marginBottom: '40px',
        }}
      >
        {equipo.escudo_url ? (
          <img
            src={equipo.escudo_url}
            alt={equipo.nombre}
            style={{
              width: '110px',
              height: '110px',
              objectFit: 'contain',
            }}
          />
        ) : (
          <div
            style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              background: '#0b2341',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '40px',
            }}
          >
            {equipo.nombre.charAt(0)}
          </div>
        )}

        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '36px',
            }}
          >
            {equipo.nombre}
          </h1>

          <p>Yuba Sutter Adult Soccer League</p>
        </div>
      </div>

      <section>
        <h2>Jugadores</h2>

        {errorJugadores && (
          <p>Error cargando jugadores: {errorJugadores.message}</p>
        )}

        {!errorJugadores && jugadores?.length === 0 && (
          <p>
            Todavía no hay jugadores registrados para este equipo.
          </p>
        )}

        {jugadores && jugadores.length > 0 && (
          <div
            style={{
              overflowX: 'auto',
              marginTop: '20px',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th style={celda}>#</th>
                  <th style={celda}>Jugador</th>
                </tr>
              </thead>

              <tbody>
                {jugadores.map((jugador) => (
                  <tr key={jugador.id}>
                    <td style={celda}>
                      {jugador.numero ?? '-'}
                    </td>

                    <td
                      style={{
                        ...celda,
                        textAlign: 'left',
                      }}
                    >
                      {jugador.nombre}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

const celda = {
  border: '1px solid #ddd',
  padding: '12px',
  textAlign: 'center',
}
