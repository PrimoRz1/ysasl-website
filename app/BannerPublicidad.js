
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function BannerPublicidad() {
  const [anuncios, setAnuncios] = useState([])
  const [actual, setActual] = useState(0)

  useEffect(() => {
    async function cargar() {
      const { data, error } = await supabase
        .from('patrocinadores')
        .select('id, nombre, imagen_url, enlace, telefono, direccion, descripcion, tipo')
        .eq('activo', true)
        .order('id')

      if (!error && data) {
        setAnuncios(data.filter(p => p.imagen_url))
      }
    }

    cargar()
  }, [])

  useEffect(() => {
    if (anuncios.length < 2) return

    const intervalo = setInterval(() => {
      setActual(i => (i + 1) % anuncios.length)
    }, 5000)

    return () => clearInterval(intervalo)
  }, [anuncios.length])

  if (anuncios.length === 0) return null

  const anuncio = anuncios[actual]

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '18px auto',
      padding: '12px',
      border: '1px solid #ddd',
      borderRadius: '10px',
      textAlign: 'center',
      background: '#f8fafc'
    }}>
      <a
        href={anuncio.enlace || undefined}
        target={anuncio.enlace ? '_blank' : undefined}
        rel="noopener noreferrer"
        style={{ color: '#0b2341', textDecoration: 'none' }}
      >
        <img
          src={anuncio.imagen_url}
          alt={anuncio.nombre}
          style={{
            width: '100%',
            maxWidth: '650px',
            height: '160px',
            objectFit: 'contain'
          }}
        />
        <div style={{ fontWeight: 'bold', marginTop: '8px' }}>
          {anuncio.nombre}
        </div>
        {anuncio.telefono && (
          <div>{anuncio.telefono}</div>
        )}
{anuncio.direccion && (
  <div style={{ marginTop: '5px', fontSize: '14px' }}>
    📍 {anuncio.direccion}
  </div>
)}

{anuncio.descripcion && (
  <div style={{ marginTop: '5px', fontSize: '14px' }}>
    {anuncio.descripcion}
  </div>
)}
      </a>
    </div>
  )
}
