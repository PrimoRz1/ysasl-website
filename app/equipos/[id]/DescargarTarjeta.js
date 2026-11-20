'use client'

import { useState } from 'react'

function cargarImagen(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo cargar una imagen para la tarjeta.'))
    img.src = url
  })
}

export default function DescargarTarjeta({ jugador, equipo, colores }) {
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState('')
  async function descargar() {
    setDescargando(true)
    setError('')
    try {
      const [primario, oscuro, dorado] = colores
      const canvas = document.createElement('canvas')
      canvas.width = 1200
      canvas.height = 1600
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('No se pudo crear la tarjeta.')
      // Escala el diseño completo a mayor resolución real, manteniendo proporciones.
      ctx.scale(4 / 3, 4 / 3)
      ctx.fillStyle = oscuro
      ctx.fillRect(0, 0, 900, 1200)
      const fondo = ctx.createLinearGradient(0, 0, 900, 850)
      fondo.addColorStop(0, primario)
      fondo.addColorStop(1, oscuro)
      ctx.fillStyle = fondo
      ctx.fillRect(0, 0, 900, 850)
      const escudo = equipo.escudo_url ? await cargarImagen(equipo.escudo_url) : null
      if (escudo) {
        ctx.save()
        ctx.globalAlpha = 0.12
        ctx.drawImage(escudo, 400, 120, 580, 580)
        ctx.restore()
      }
      if (jugador.foto) {
        const foto = await cargarImagen(jugador.foto)
        // Contener sin estirar ni ampliar: conserva nitidez y proporciones.
        const escala = Math.min(900 / foto.width, 900 / foto.height)
        const ancho = foto.width * escala
        const alto = foto.height * escala
        ctx.drawImage(foto, (900 - ancho) / 2, 850 - alto, ancho, alto)
      }
      ctx.fillStyle = oscuro
      ctx.fillRect(0, 900, 850, 360)
      ctx.fillStyle = dorado
      ctx.fillRect(0, 846, 900, 6)
      // Recuadro de número igual al de las tarjetas públicas.
      ctx.fillStyle = oscuro
      ctx.fillRect(36, 36, 145, 105)
      ctx.strokeStyle = dorado
      ctx.lineWidth = 6
      ctx.strokeRect(39, 39, 139, 99)
      ctx.fillStyle = dorado
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = 'bold 55px Arial, sans-serif'
      ctx.fillText(String(jugador.numero ?? '—'), 109, 91, 125)
      ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'center'
      ctx.font = 'bold 25px Arial, sans-serif'
      ctx.fillText('YSASL · JUGADOR', 450, 930)
      ctx.fillStyle = '#ffffff'
      const nombre = String(jugador.nombre || 'JUGADOR').toLocaleUpperCase('es')
      let fontSize = 49
      do {
        ctx.font = 'bold ' + fontSize + 'px Arial, sans-serif'
        if (ctx.measureText(nombre).width <= 820) break
        fontSize -= 2
      } while (fontSize > 22)
      ctx.fillText(nombre, 450, 1030)
      ctx.font = 'bold 30px Arial, sans-serif'
      ctx.fillText(String(equipo.nombre || '').toLocaleUpperCase('es'), 450, 1120, 820)
      if (escudo) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(735, 685, 125, 125)
        ctx.drawImage(escudo, 746, 696, 103, 103)
      }
      ctx.strokeStyle = dorado
      ctx.lineWidth = 9
      ctx.strokeRect(5, 5, 890, 1190)
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('No se pudo generar el PNG.')
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = 'YSASL-' + String(jugador.nombre || 'jugador').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-') + '.png'
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      setError('No se pudo descargar la tarjeta. ' + (err.message || 'Intenta de nuevo.'))
    } finally {
      setDescargando(false)
    }
  }
  return (
    <div style={{ marginTop: 9, textAlign: 'center' }}>
      <button type="button" onClick={descargar} disabled={descargando}
        style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid #c8a950',
          background: '#fff', color: '#123d32', fontWeight: 800, cursor: 'pointer' }}>
        {descargando ? 'Preparando PNG…' : 'Guardar mi tarjeta (PNG)'}
      </button>
      {error && <p role="alert" style={{ color: '#991b1b', fontSize: 12 }}>{error}</p>}
    </div>
  )
}
