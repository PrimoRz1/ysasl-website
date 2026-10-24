'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePathname } from 'next/navigation'

function obtenerEnlaceSeguro(enlace) {
  const texto = typeof enlace === 'string' ? enlace.trim() : ''
  if (!texto) return ''
  if (/^https?:\/\//i.test(texto)) return texto
  if (/^[a-z][a-z0-9+.-]*:/i.test(texto)) return ''
  return `https://${texto}`
}

export default function BannerPublicidad() {
  const pathname = usePathname()
  const ocultarBanner = pathname === '/admin' || pathname?.startsWith('/admin/')
  const [anuncios, setAnuncios] = useState([])
  const [actual, setActual] = useState(0)

  useEffect(() => {
    if (ocultarBanner) return

    let vigente = true

    async function cargar() {
      const { data, error } = await supabase
        .from('patrocinadores')
        .select('id, nombre, imagen_url, enlace, tipo')
        .eq('activo', true)
        .eq('tipo', 'principal')
        .order('id')

      if (vigente && !error && data) {
        setAnuncios(data.filter(p => p.imagen_url))
        setActual(0)
      }
    }

    cargar()
    return () => { vigente = false }
  }, [ocultarBanner])

  useEffect(() => {
    if (ocultarBanner || anuncios.length < 2) return

    const intervalo = setInterval(() => {
      setActual(i => (i + 1) % anuncios.length)
    }, 5000)

    return () => clearInterval(intervalo)
  }, [ocultarBanner, anuncios.length])

  if (ocultarBanner || anuncios.length === 0) return null

  const anuncio = anuncios[actual] || anuncios[0]
  const enlace = obtenerEnlaceSeguro(anuncio.enlace)

  const imagen = (
    <img
      src={anuncio.imagen_url}
      alt={`Anuncio de ${anuncio.nombre}`}
      style={{
        display: 'block',
        width: '100%',
        height: 'auto',
        maxHeight: '440px',
        objectFit: 'contain',
        margin: '0 auto',
        borderRadius: '10px',
      }}
    />
  )

  return (
    <section
      aria-label="Patrocinadores principales"
      style={{
        width: 'calc(100% - 30px)',
        maxWidth: '1100px',
        margin: '16px auto 24px',
      }}
    >
      {enlace ? (
        <a
          href={enlace}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Visitar el sitio web de ${anuncio.nombre} (abre en otra pestaña)`}
          title={`Visitar ${anuncio.nombre}`}
          style={{
            display: 'block',
            width: '100%',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          {imagen}
        </a>
      ) : imagen}
    </section>
  )
}
