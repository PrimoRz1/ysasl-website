import Link from 'next/link'

export const metadata = {
  title: 'YSASL | Yuba Sutter Adult Soccer League',
  description: 'Sitio oficial de Yuba Sutter Adult Soccer League',
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
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
            }}
          >
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
              style={{
                display: 'flex',
                gap: '22px',
                flexWrap: 'wrap',
              }}
            >
              <Link href="/" style={linkStyle}>
                INICIO
              </Link>

              <Link href="/calendario" style={linkStyle}>
                CALENDARIO
              </Link>

              <Link href="/resultados" style={linkStyle}>
                RESULTADOS
              </Link>

              <Link href="/clasificacion" style={linkStyle}>
                CLASIFICACIÓN
              </Link>

              <Link href="/equipos" style={linkStyle}>
                EQUIPOS
              </Link>

              <Link href="/goleadores" style={linkStyle}>
                GOLEADORES
              </Link>

              <Link href="/disciplina" style={linkStyle}>
                DISCIPLINA
              </Link>
            </nav>
          </div>
        </header>

        {children}

      </body>
    </html>
  )
}

const linkStyle = {
  color: 'white',
  textDecoration: 'none',
  fontWeight: 'bold',
  fontSize: '14px',
}
