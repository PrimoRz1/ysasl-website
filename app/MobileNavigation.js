'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const enlaces = [
  ['/', 'INICIO'],
  ['/calendario', 'CALENDARIO'],
  ['/resultados', 'RESULTADOS'],
  ['/clasificacion', 'CLASIFICACIÓN'],
  ['/campeones', '🏆 CAMPEONES'],
  ['/equipos', 'EQUIPOS'],
  ['/goleadores', 'GOLEADORES'],
  ['/disciplina', 'DISCIPLINA'],
  ['/patrocinadores', 'PATROCINADORES'],
  ['/inscripciones', 'INSCRIBIR MI EQUIPO'],
]

export default function MobileNavigation() {
  const [abierto, setAbierto] = useState(false)
  const ruta = usePathname()

  useEffect(() => {
    setAbierto(false)
  }, [ruta])

  return (
    <>
      <div className="ysasl-topbar">
        <Link href="/" className="ysasl-brand" onClick={() => setAbierto(false)}>
          YSASL
        </Link>
        <button
          type="button"
          className="ysasl-menu-toggle"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={abierto}
          aria-controls="ysasl-navegacion"
          onClick={() => setAbierto((valor) => !valor)}
        >
          {abierto ? '✕ Cerrar' : '☰ Menú'}
        </button>
      </div>

      <div id="ysasl-navegacion" className={`ysasl-nav-content ${abierto ? 'ysasl-open' : ''}`}>
        <nav aria-label="Navegación principal" className="ysasl-nav-links">
          {enlaces.map(([href, etiqueta]) => (
            <Link key={href} href={href} onClick={() => setAbierto(false)}>
              {etiqueta}
            </Link>
          ))}
        </nav>
        <div className="ysasl-access">
          <span>Acceso a tu cuenta:</span>
          <Link href="/login?tipo=jugador" onClick={() => setAbierto(false)}>
            ⚽ Jugadores
          </Link>
          <Link href="/login?tipo=equipo" onClick={() => setAbierto(false)}>
            👥 Administradores de Equipo
          </Link>
        </div>
      </div>

      <style jsx global>{`
        .ysasl-topbar { display: flex; align-items: center; justify-content: space-between; }
        .ysasl-brand { color: #fff; text-decoration: none; font-size: 24px; font-weight: bold; }
        .ysasl-menu-toggle { display: none; }
        .ysasl-nav-links { display: flex; flex-wrap: wrap; gap: 22px; margin-top: 16px; }
        .ysasl-nav-links a { color: #fff; text-decoration: none; font-weight: bold; font-size: 14px; }
        .ysasl-nav-links a:hover, .ysasl-nav-links a:focus-visible { text-decoration: underline; }
        .ysasl-access { margin-top: 22px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .ysasl-access span { font-size: 13px; opacity: .9; margin-right: 4px; }
        .ysasl-access a { display: inline-block; padding: 11px 16px; border-radius: 8px; background: #fff; color: #0b2341; text-decoration: none; font-weight: bold; font-size: 14px; text-align: center; }
        @media (max-width: 700px) {
          .ysasl-menu-toggle { display: inline-flex; align-items: center; justify-content: center; border: 1px solid #91a5bd; border-radius: 8px; background: transparent; color: #fff; font-size: 15px; font-weight: bold; padding: 9px 12px; cursor: pointer; }
          .ysasl-nav-content { display: none; }
          .ysasl-nav-content.ysasl-open { display: block; }
          .ysasl-nav-links { margin-top: 18px; display: grid; grid-template-columns: 1fr; gap: 0; }
          .ysasl-nav-links a { display: block; padding: 12px 4px; border-bottom: 1px solid rgba(255,255,255,.17); font-size: 14px; }
          .ysasl-access { margin-top: 16px; display: grid; gap: 10px; }
          .ysasl-access a { width: 100%; box-sizing: border-box; }
        }
      `}</style>
    </>
  )
}
