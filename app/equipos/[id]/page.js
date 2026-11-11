import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Colores provisionales para los equipos que aún no tienen una paleta definida.
// No se cambian los colores guardados en Supabase ni los escudos originales.
const paletas = [
  ['#102a43', '#0a192c', '#e1bd6a'],
  ['#12453b', '#092c26', '#e4c777'],
  ['#632c3b', '#361923', '#e5bd72'],
  ['#193d70', '#0c2342', '#e4c47c'],
  ['#554020', '#302514', '#f0cf83'],
  ['#40345d', '#241d3b', '#e1c28c'],
]

// Iremos agregando los colores de cada equipo basándonos en su escudo.
// El mismo diseño de tarjeta se mantiene para todos.
const coloresPorEquipo = {
  'LA VALLARTA FC': ['#07543f', '#002c24', '#e8c46a'],
}

export default async function EquipoPage({ params }) {
  const { id } = await params

  const { data: equipo, error: errorEquipo } = await supabase
    .from('equipos')
    .select('id, nombre, escudo_url')
    .eq('id', id)
    .single()

  const { data: jugadores, error: errorJugadores } = await supabase
    .from('jugadores')
    .select('id, nombre, numero, foto_url, foto_uniforme_url')
    .eq('equipo_id', id)
    .eq('activo', true)
    .order('numero')

  if (errorEquipo || !equipo) {
    return (
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px' }}>
        <h1>Equipo no encontrado</h1>
        <Link href="/equipos">← Regresar a Equipos</Link>
      </main>
    )
  }

  const n = Number(equipo.id)
  const paletaProvisional = paletas[
    Number.isFinite(n) ? Math.abs(n) % paletas.length : 0
  ]
  const nombreNormalizado = (equipo.nombre || '').trim().toLocaleUpperCase('es')
  const [primario, oscuro, dorado] =
    coloresPorEquipo[nombreNormalizado] || paletaProvisional

  return (
    <main style={{ maxWidth: 1150, margin: '0 auto', padding: '36px 18px 70px' }}>
      <Link href="/equipos" style={{ color: '#15365a', fontWeight: 700, textDecoration: 'none' }}>
        ← EQUIPOS
      </Link>

      <header style={{
        display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        margin: '24px 0 36px', padding: '22px 24px', borderRadius: 18,
        background: `linear-gradient(125deg, ${oscuro}, ${primario})`, color: 'white',
      }}>
        {equipo.escudo_url ? (
          <img src={equipo.escudo_url} alt={`Escudo de ${equipo.nombre}`}
            style={{ width: 95, height: 95, objectFit: 'contain' }} />
        ) : (
          <div style={{
            width: 95, height: 95, borderRadius: '50%', background: '#ffffff20',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 40,
          }}>
            {equipo.nombre.charAt(0)}
          </div>
        )}
        <div>
          <p style={{
            color: dorado, margin: '0 0 6px', fontWeight: 800,
            letterSpacing: 2, fontSize: 12,
          }}>
            YSASL · PLANTILLA OFICIAL
          </p>
          <h1 style={{ fontSize: 'clamp(25px, 4vw, 38px)', margin: '0 0 8px' }}>
            {equipo.nombre}
          </h1>
          <p style={{ margin: 0, color: '#e8eef6' }}>Yuba Sutter Adult Soccer League</p>
        </div>
      </header>

      <section>
        <h2 style={{ fontSize: 25, marginBottom: 6 }}>Nuestros jugadores</h2>
        <p style={{ color: '#526277', margin: '0 0 24px' }}>
          Conoce la plantilla de {equipo.nombre}
        </p>

        {errorJugadores && (
          <p role="alert">Error cargando jugadores: {errorJugadores.message}</p>
        )}
        {!errorJugadores && jugadores?.length === 0 && (
          <p>Todavía no hay jugadores registrados para este equipo.</p>
        )}

        {!errorJugadores && jugadores && jugadores.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))',
            gap: 22, alignItems: 'start',
          }}>
            {jugadores.map((jugador) => (
              <Link key={jugador.id} href={`/jugadores/${jugador.id}`}
                aria-label={`Ver ficha de ${jugador.nombre}`}
                style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
                <article style={{
                  border: `2px solid ${dorado}`, borderRadius: 21,
                  overflow: 'hidden', background: oscuro, color: 'white',
                  boxShadow: '0 12px 28px rgba(9,26,45,.22)',
                }}>
                  <div style={{
                    position: 'relative', height: 310,
                    background: `linear-gradient(155deg, ${primario} 8%, ${oscuro} 88%)`,
                    overflow: 'hidden',
                  }}>
                    {equipo.escudo_url && (
                      <img src={equipo.escudo_url} alt="" aria-hidden="true"
                        style={{
                          position: 'absolute', width: 205, height: 205,
                          objectFit: 'contain', opacity: 0.12, top: 27, right: -37,
                        }} />
                    )}

                    {(jugador.foto_uniforme_url || jugador.foto_url) ? (
                      <img src={jugador.foto_uniforme_url || jugador.foto_url}
                        alt={`Fotografía de ${jugador.nombre}`}
                        loading="lazy"
                        style={{
                          position: 'absolute', inset: 0,
                          width: '100%', height: '100%',
                          objectFit: 'cover', objectPosition: '55% 22%',
                          transform: Number(jugador.id) === 28
  ? 'translateY(16px) scale(1)'
  : 'translateY(-12px) scale(1.05)',
                          transformOrigin: 'center center',
                        }} />
                    ) : (
                      <div style={{
                        position: 'relative', height: '100%', display: 'flex',
                        flexDirection: 'column', alignItems: 'center',
                        justifyContent: 'center', gap: 8, color: '#ffffffaa',
                      }}>
                        <svg width="112" height="125" viewBox="0 0 112 125"
                          fill="none" aria-hidden="true">
                          <circle cx="56" cy="37" r="25" fill="currentColor" />
                          <path d="M8 122c0-29 19-47 48-47s48 18 48 47"
                            fill="currentColor" />
                        </svg>
                        <span style={{ fontSize: 12 }}>Fotografía pendiente</span>
                      </div>
                    )}

                    <div style={{
                      position: 'absolute', top: 13, left: 13, borderRadius: 11,
                      background: oscuro, border: `2px solid ${dorado}`,
                      color: dorado, padding: '8px 12px',
                      fontWeight: 900, fontSize: 25, lineHeight: 1,
                      boxShadow: '0 4px 12px #00000055',
                    }}>
                      {jugador.numero ?? '—'}
                    </div>

                    {equipo.escudo_url && Number(jugador.id) !== 28 && (
                      <div style={{
                        position: 'absolute', right: 11, bottom: 11,
                        width: 61, height: 61, background: '#fffffff2',
                        borderRadius: 13, padding: 6,
                        display: 'grid', placeItems: 'center',
                        boxShadow: '0 4px 12px #00000055',
                      }}>
                        <img src={equipo.escudo_url} alt="" aria-hidden="true"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                    )}
                  </div>

                  <div style={{
                    height: 4,
                    background: `linear-gradient(90deg, ${dorado}, #fff4b6, ${dorado})`,
                  }} />

                  <div style={{ padding: '18px 12px 20px', textAlign: 'center' }}>
                    <p style={{
                      margin: '0 0 9px', color: dorado, fontSize: 11,
                      fontWeight: 800, letterSpacing: 2,
                    }}>
                      YSASL · JUGADOR
                    </p>
                    <h3 style={{
                      margin: '0 0 14px', fontSize: 19, fontWeight: 900,
                      textTransform: 'uppercase', lineHeight: 1.2,
                      overflowWrap: 'anywhere',
                    }}>
                      {jugador.nombre}
                    </h3>
                    <p style={{
                      margin: 0, padding: '10px 8px',
                      background: '#ffffff14', border: '1px solid #ffffff24',
                      borderRadius: 999, fontSize: 12, fontWeight: 800,
                    }}>
                      {equipo.nombre}
                    </p>
                  </div>
                </article>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
