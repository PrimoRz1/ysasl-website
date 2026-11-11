import { supabase } from '../../../lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

// Misma paleta de las tarjetas públicas de equipos.
const paletas = [
  ['#102a43', '#0a192c', '#e1bd6a'],
  ['#12453b', '#092c26', '#e4c777'],
  ['#632c3b', '#361923', '#e5bd72'],
  ['#193d70', '#0c2342', '#e4c47c'],
  ['#554020', '#302514', '#f0cf83'],
  ['#40345d', '#241d3b', '#e1c28c'],
]

export default async function FichaJugadorPage({ params }) {
  const { id } = await params
  const { data: jugador, error: errorJugador } = await supabase
    .from('jugadores')
    .select('id, equipo_id, nombre, numero, foto_url')
    .eq('id', id)
    .eq('activo', true)
    .maybeSingle()

  if (errorJugador || !jugador) {
    return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '40px 20px' }}>
        <h1>Jugador no encontrado</h1>
        <p>La ficha no está disponible.</p>
        <Link href="/equipos">← Volver a Equipos</Link>
      </main>
    )
  }

  const { data: equipo } = await supabase
    .from('equipos')
    .select('id, nombre, escudo_url')
    .eq('id', jugador.equipo_id)
    .maybeSingle()

  const n = Number(jugador.equipo_id)
  const [primario, oscuro, dorado] = paletas[Number.isFinite(n) ? Math.abs(n) % paletas.length : 0]

  return (
    <main style={{ maxWidth: 950, margin: '0 auto', padding: '36px 18px 70px' }}>
      <Link href={equipo ? `/equipos/${equipo.id}` : '/equipos'}
        style={{ color: '#15365a', fontWeight: 700, textDecoration: 'none' }}>
        ← {equipo ? `VOLVER A ${equipo.nombre}` : 'VOLVER A EQUIPOS'}
      </Link>

      <article style={{ marginTop: 25, border: `2px solid ${dorado}`,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 12px 30px rgba(9,26,45,.16)', background: oscuro, color: 'white' }}>
        <header style={{ padding: '25px 22px', display: 'flex', alignItems: 'center',
          gap: 16, flexWrap: 'wrap', background: `linear-gradient(125deg, ${oscuro}, ${primario})` }}>
          {equipo?.escudo_url && (
            <img src={equipo.escudo_url} alt={`Escudo de ${equipo.nombre}`}
              style={{ width: 72, height: 72, objectFit: 'contain' }} />
          )}
          <div>
            <p style={{ color: dorado, fontSize: 12, fontWeight: 800,
              letterSpacing: 2, margin: '0 0 6px' }}>YSASL · FICHA DEL JUGADOR</p>
            <h1 style={{ fontSize: 'clamp(24px, 5vw, 38px)',
              textTransform: 'uppercase', margin: 0 }}>{jugador.nombre}</h1>
            <p style={{ margin: '8px 0 0', color: '#e8eef6' }}>
              {equipo?.nombre || 'Yuba Sutter Adult Soccer League'}
            </p>
          </div>
        </header>

        <div style={{ position: 'relative', minHeight: 380,
          background: `linear-gradient(155deg, ${primario} 10%, ${oscuro} 80%)`,
          display: 'flex', justifyContent: 'center', alignItems: 'flex-end', overflow: 'hidden' }}>
          {equipo?.escudo_url && (
            <img src={equipo.escudo_url} alt="" aria-hidden="true"
              style={{ position: 'absolute', width: 260, height: 260,
                objectFit: 'contain', opacity: .12, right: '3%', top: 40 }} />
          )}
          {jugador.foto_url ? (
            src={
  Number(jugador.id) === 28
    ? 'https://djtwrknixwhinatcoswf.supabase.co/storage/v1/object/public/fotos-jugadores/uniformes-ysasl/YSASL_Retrato_La_Vallarta_Uniforme_Transparente.png'
    : jugador.foto_url
} alt={`Fotografía de ${jugador.nombre}`}
              style={{ position: 'relative', display: 'block', width: '100%',
                maxWidth: 680, height: 380, objectFit: 'cover',
objectPosition: 'center bottom',
transform: 'scale(1.4)',
transformOrigin: 'center bottom' }} />
          ) : (
            <p style={{ alignSelf: 'center', color: '#ffffffbb' }}>Fotografía pendiente</p>
          )}
          <div style={{ position: 'absolute', top: 18, left: 18,
            background: oscuro, border: `1px solid ${dorado}`, color: dorado,
            padding: '9px 14px', borderRadius: 10, fontSize: 27, fontWeight: 900 }}>
            {jugador.numero ?? '—'}
          </div>
        </div>

        <div style={{ height: 4,
          background: `linear-gradient(90deg, ${dorado}, #fff4b6, ${dorado})` }} />
        <div style={{ padding: '22px 20px 28px', textAlign: 'center' }}>
          <p style={{ color: dorado, margin: '0 0 8px',
            fontSize: 12, letterSpacing: 2, fontWeight: 800 }}>JUGADOR OFICIAL</p>
          <h2 style={{ margin: '0 0 10px', fontSize: 'clamp(23px, 5vw, 34px)',
            textTransform: 'uppercase' }}>{jugador.nombre}</h2>
          <p style={{ margin: 0, color: '#e8eef6' }}>
            {equipo?.nombre || 'YSASL'} · Número {jugador.numero ?? 'sin asignar'}
          </p>
        </div>
      </article>
    </main>
  )
}
