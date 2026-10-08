
'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function InscripcionesPage() {
  const [nombreEquipo, setNombreEquipo] = useState('')
  const [representante, setRepresentante] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function enviarSolicitud(e) {
    e.preventDefault()
    setMensaje('')
    setGuardando(true)

    try {
      const { error } = await supabase
        .from('solicitudes_inscripcion')
        .insert({
          nombre_equipo: nombreEquipo.trim(),
          representante: representante.trim(),
          telefono: telefono.trim(),
          correo: correo.trim() || null,
          estado: 'pendiente'
        })

      if (error) throw error

      setMensaje('Solicitud enviada correctamente. La liga revisará tu inscripción.')
      setNombreEquipo('')
      setRepresentante('')
      setTelefono('')
      setCorreo('')
    } catch (error) {
      console.error(error)
      setMensaje('No se pudo enviar la solicitud. Comunícate con la administración.')
    } finally {
      setGuardando(false)
    }
  }

  const campo = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px',
    marginTop: '6px',
    marginBottom: '18px',
    border: '1px solid #ccc',
    borderRadius: '6px'
  }

  return (
    <main style={{ maxWidth: '650px', margin: '40px auto', padding: '20px' }}>
      <h1>Inscribir mi equipo</h1>
      <p>
        Completa el formulario para solicitar la inscripción de tu equipo
        en Yuba Sutter Adult Soccer League.
      </p>

      <form onSubmit={enviarSolicitud}>
        <label>
          Nombre del equipo *
          <input
            style={campo}
            required
            value={nombreEquipo}
            onChange={(e) => setNombreEquipo(e.target.value)}
          />
        </label>

        <label>
          Nombre del representante *
          <input
            style={campo}
            required
            value={representante}
            onChange={(e) => setRepresentante(e.target.value)}
          />
        </label>

        <label>
          Teléfono *
          <input
            style={campo}
            type="tel"
            required
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </label>

        <label>
          Correo electrónico (opcional)
          <input
            style={campo}
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={guardando}
          style={{
            background: '#0b2341',
            color: 'white',
            padding: '13px 22px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {guardando ? 'Enviando...' : 'Enviar solicitud'}
        </button>
      </form>

      {mensaje && <p role="status" style={{ marginTop: '20px' }}>{mensaje}</p>}
    </main>
  )
}
