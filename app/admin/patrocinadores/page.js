'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function PatrocinadoresAdminPage() {
  const [patrocinadores, setPatrocinadores] = useState([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [enlace, setEnlace] = useState('')
  const [imagenUrl, setImagenUrl] = useState('')
  const [tipo, setTipo] = useState('normal')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    cargarPatrocinadores()
  }, [])

  async function cargarPatrocinadores() {
    const { data, error } = await supabase
      .from('patrocinadores')
      .select('*')
      .order('nombre')

    if (error) {
      console.error(error)
      setMensaje('Error al cargar los patrocinadores.')
      return
    }

    setPatrocinadores(data || [])
  }

  async function guardarPatrocinador(e) {
    e.preventDefault()

    if (!nombre.trim()) {
      setMensaje('Escribe el nombre del patrocinador.')
      return
    }

    setGuardando(true)
    setMensaje('')

    const { error } = await supabase
      .from('patrocinadores')
      .insert({
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        enlace: enlace.trim() || null,
        imagen_url: imagenUrl.trim() || null,
        tipo,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        activo: true
      })

    if (error) {
      console.error(error)
      setMensaje(`Error al guardar: ${error.message}`)
      setGuardando(false)
      return
    }

    setNombre('')
    setTelefono('')
    setEnlace('')
    setImagenUrl('')
    setTipo('normal')
    setFechaInicio('')
    setFechaFin('')

    setMensaje('Patrocinador guardado correctamente.')
    await cargarPatrocinadores()
    setGuardando(false)
  }

  return (
    <main
      style={{
        padding: '32px',
        maxWidth: '1000px',
        margin: '0 auto'
      }}
    >
      <h1>Patrocinadores</h1>

      <p>Administración de patrocinadores de YSASL.</p>

      <form
        onSubmit={guardarPatrocinador}
        style={{
          display: 'grid',
          gap: '14px',
          marginTop: '30px',
          marginBottom: '40px'
        }}
      >
        <div>
          <label>
            <strong>Nombre del negocio</strong>
          </label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label>
            <strong>Teléfono</strong>
          </label>
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label>
            <strong>Enlace / página web</strong>
          </label>
          <input
            type="text"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://..."
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label>
            <strong>URL del logo o imagen</strong>
          </label>
          <input
            type="text"
            value={imagenUrl}
            onChange={(e) => setImagenUrl(e.target.value)}
            placeholder="https://..."
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label>
            <strong>Tipo de patrocinador</strong>
          </label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          >
            <option value="normal">Normal</option>
            <option value="destacado">Destacado</option>
            <option value="principal">Principal</option>
          </select>
        </div>

        <div>
          <label>
            <strong>Fecha de inicio</strong>
          </label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label>
            <strong>Fecha de vencimiento</strong>
          </label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={guardando}
          style={{
            padding: '12px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {guardando ? 'Guardando...' : 'Guardar patrocinador'}
        </button>
      </form>

      {mensaje && (
        <p>
          <strong>{mensaje}</strong>
        </p>
      )}

      <h2>Patrocinadores registrados</h2>

      {patrocinadores.length === 0 ? (
        <p>No hay patrocinadores registrados.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {patrocinadores.map((patrocinador) => (
            <div
              key={patrocinador.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '16px'
              }}
            >
              <strong>{patrocinador.nombre}</strong>

              {patrocinador.telefono && (
                <div>Teléfono: {patrocinador.telefono}</div>
              )}

              <div>Tipo: {patrocinador.tipo || 'normal'}</div>

              <div>
                Estado: {patrocinador.activo ? 'Activo' : 'Inactivo'}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
