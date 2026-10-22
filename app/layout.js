import Link from 'next/link'
import BannerPublicidad from './BannerPublicidad'
import MobileNavigation from './MobileNavigation'

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
            padding: '18px 20px',
          }}
        >
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <MobileNavigation />
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
            href="/login?tipo=admin"
            style={{ color: '#6b7280', textDecoration: 'none', fontSize: '12px' }}
          >
            Administración General
          </Link>
        </footer>
      </body>
    </html>
  )
}
