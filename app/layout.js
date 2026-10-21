import Link from 'next/link'
import BannerPublicidad from './BannerPublicidad'

export const metadata = {
  title: 'YSASL | Yuba Sutter Adult Soccer League',
  description: 'Sitio oficial de Yuba Sutter Adult Soccer League',
}

const linkStyle = {
  color: 'white',
  textDecoration: 'none',
  fontWeight: 'bold',
  fontSize: '14px',
}

const accesoStyle = {
  display: 'inline-block',
  padding: '11px 16px',
  borderRadius: '8px',
  background: '#ffffff',
  color: '#0b2341',
  textDecoration: 'none',
  fontWeight: 'bold',
  fontSize: '14px',
  textAlign: 'center',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: 'Arial, sans-serif' }}>
        <header
          style={{
            background: '#0b2341',
            color: 'white',
            padding: '18px 30px',
          }}
        >
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                marginBottom: '16px',
              }}
            >
              YSASL
            </div>

            <nav
              aria-label="Navegación principal"
              style={{ display: 'flex', gap: '22px', flexWrap: 'wrap' }}
            >
              <Link href="/" style={linkStyle}>INICIO</Link>
              <Link href="/calendario" style={linkStyle}>CALENDARIO</Link>
              <Link href="/resultados" style={linkStyle}>RESULTADOS</Link>
              <Link href="/clasificacion" style={linkStyle}>CLASIFICACIÓN</Link>
              <Link href="/campeones" style={linkStyle}>🏆 CAMPEONES</Link>
              <Link href="/equipos" style={linkStyle}>EQUIPOS</Link>
              <Link href="/goleadores" style={linkStyle}>GOLEADORES</Link>
              <Link href="/disciplina" style={linkStyle}>DISCIPLINA</Link>
              <Link href="/patrocinadores" style={linkStyle}>PATROCINADORES</Link>
              <Link href="/inscripciones" style={linkStyle}>INSCRIBIR MI EQUIPO</Link>
            </nav>

            <div
              style={{
                marginTop: '22px',
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '13px', opacity: 0.9, marginRight: '4px' }}>
                Acceso a tu cuenta:
              </span>
              <Link href="/jugador" style={accesoStyle}>
                ⚽ Jugadores
              </Link>
              <Link href="/delegado" style={accesoStyle}>
                👥 Administradores de Equipo
              </Link>
            </div>
          </div>
        </header>

        <section
          style={{
            maxWidth: '1100px',
            margin: '20px auto',
            padding: '0 15px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: '#f4f7fb',
              border: '1px solid #ddd',
              borderRadius: '10px',
              padding: '25px',
            }}
          >
            <BannerPublicidad />
          </div>
        </section>

        {children}

        <footer
          style={{
            maxWidth: '1100px',
            margin: '50px auto 0',
            padding: '22px 15px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            color: '#6b7280',
            fontSize: '12px',
          }}
        >
          <span>YSASL · Yuba Sutter Adult Soccer League</span>
          <Link
            href="/admin"
            style={{ color: '#6b7280', textDecoration: 'none', fontSize: '12px' }}
          >
            Administración General
          </Link>
        </footer>
      </body>
    </html>
  )
}
