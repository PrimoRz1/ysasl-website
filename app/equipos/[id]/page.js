import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Paletas provisionales por equipo. Se podrán cambiar por colores oficiales.
const paletas = [
  ['#102a43', '#0a192c', '#e1bd6a'],
  ['#12453b', '#092c26', '#e4c777'],
  ['#632c3b', '#361923', '#e5bd72'],
  ['#193d70', '#0c2342', '#e4c47c'],
  ['#554020', '#302514', '#f0cf83'],
  ['#40345d', '#241d3b', '#e1c28c'],
]

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
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px' }}>
        <h1>Equipo no encontrado</h1>
        <Link href="/equipos">← Regresar a Equipos</Link>
      </main>
    )
  }

  const n = Number(equipo.id)
  const [primario, oscuro, dorado] = paletas[Number.isFinite(n) ? Math.abs(n) % paletas.length : 0]

  return (
    <main style={{ maxWidth: 1150, margin: '0 auto', padding: '36px 18px 70px' }}>
      <Link href="/equipos" style={{ color: '#15365a', fontWeight: 700, textDecoration: 'none' }}>
        ← EQUIPOS
      </Link>

      <header style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
        margin: '24px 0 36px', padding: '22px 24px', borderRadius: 18,
        background: `linear-gradient(125deg, ${oscuro}, ${primario})`, color: 'white' }}>
        {equipo.escudo_url ? (
          <img src={equipo.escudo_url} alt={`Escudo de ${equipo.nombre}`}
            style={{ width: 95, height: 95, objectFit: 'contain' }} />
        ) : (
          <div style={{ width: 95, height: 95, borderRadius: '50%', background: '#ffffff20',
            display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 40 }}>
            {equipo.nombre.charAt(0)}
          </div>
        )}
        <div>
          <p style={{ color: dorado, margin: '0 0 6px', fontWeight: 800, letterSpacing: 2, fontSize: 12 }}>
            YSASL · PLANTILLA OFICIAL
          </p>
          <h1 style={{ fontSize: 'clamp(25px, 4vw, 38px)', margin: '0 0 8px' }}>{equipo.nombre}</h1>
          <p style={{ margin: 0, color: '#e8eef6' }}>Yuba Sutter Adult Soccer League</p>
        </div>
      </header>

      <section>
        <h2 style={{ fontSize: 25, marginBottom: 6 }}>Nuestros jugadores</h2>
        <p style={{ color: '#526277', margin: '0 0 24px' }}>Conoce la plantilla de {equipo.nombre}</p>

        {errorJugadores && <p role="alert">Error cargando jugadores: {errorJugadores.message}</p>}
        {!errorJugadores && jugadores?.length === 0 && (
          <p>Todavía no hay jugadores registrados para este equipo.</p>
        )}

        {!errorJugadores && jugadores && jugadores.length > 0 && (
          <div style={{ display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
            gap: 22, alignItems: 'start' }}>
            {jugadores.map((jugador) => (
              <article key={jugador.id} style={{ border: `2px solid ${dorado}`,
                borderRadius: 19, overflow: 'hidden', background: oscuro,
                color: 'white', boxShadow: '0 10px 26px rgba(9,26,45,.17)' }}>
                <div style={{ position: 'relative', height: 275,
                  background: `linear-gradient(155deg, ${primario} 10%, ${oscuro} 80%)`,
                  overflow: 'hidden' }}>
                  {equipo.escudo_url && (
                    <img src={equipo.escudo_url} alt="" aria-hidden="true"
                      style={{ position: 'absolute', width: 195, height: 195,
                        objectFit: 'contain', opacity: 0.13, top: 32, right: -40 }} />
                  )}
                  {jugador.foto_url ? (
                    <img src={jugador.foto_url} alt={`Fotografía de ${jugador.nombre}`}
                      loading="lazy" style={{ position: 'relative', width: '100%', height: '100%',
                        objectFit: 'cover', objectPosition: 'center 22%' }} />
                  ) : (
                    <div style={{ position: 'relative', height: '100%', display: 'flex',
                      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 8, color: '#ffffffaa' }}>
                      <svg width="112" height="125" viewBox="0 0 112 125" fill="none" aria-hidden="true">
                        <circle cx="56" cy="37" r="25" fill="currentColor" />
                        <path d="M8 122c0-29 19-47 48-47s48 18 48 47" fill="currentColor" />
                      </svg>
                      <span style={{ fontSize: 12 }}>Fotografía pendiente</span>
                    </div>
                  )}
                  <div style={{ position: 'absolute', top: 12, left: 12, borderRadius: 9,
                    background: oscuro, border: `1px solid ${dorado}`, color: dorado,
                    padding: '7px 10px', fontWeight: 900, fontSize: 23, lineHeight: 1 }}>
                    {jugador.numero ?? '—'}
                  </div>
                  {equipo.escudo_url && (
                    <div style={{ position: 'absolute', right: 10, bottom: 10,
                      width: 55, height: 55, background: '#ffffffed', borderRadius: 12,
                      padding: 6, display: 'grid', placeItems: 'center' }}>
                      <img src={equipo.escudo_url} alt="" aria-hidden="true"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>
                <div style={{ height: 4,
                  background: `linear-gradient(90deg, ${dorado}, #fff4b6, ${dorado})` }} />
                <div style={{ padding: '17px 12px 19px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 8px', color: dorado, fontSize: 10,
                    fontWeight: 800, letterSpacing: 2 }}>YSASL · JUGADOR</p>
                  <h3 style={{ margin: '0 0 12px', fontSize: 19, fontWeight: 900,
                    textTransform: 'uppercase', lineHeight: 1.2, overflowWrap: 'anywhere' }}>
                    {jugador.nombre}
                  </h3>
                  <p style={{ margin: 0, padding: '9px 8px', background: '#ffffff14',
                    borderRadius: 9, fontSize: 12, fontWeight: 700 }}>{equipo.nombre}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
