
'use client'

import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function RegistroPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const [registrado, setRegistrado] = useState(false)

  async function registrar(e) {
    e.preventDefault()
    setMensaje('')

    if (password.length < 8) {
      setMensaje('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (password !== confirmar) {
      setMensaje('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          nombre: nombre.trim()
        }
      }
    })

    if (error) {
      setMensaje('No se pudo completar el registro: ' + error.message)
      setCargando(false)
      return
    }

    setRegistrado(true)
    setMensaje(
      'Registro recibido. Revisa tu correo para confirmar ' +
      'tu cuenta si se solicita. Próximamente podrás ' +
      'entrar al panel de jugadores.'
    )
    setCargando(false)
  }

  const estiloInput = {
    width: '100%',
    padding: '12px',
    marginTop: '6px',
    marginBottom: '18px',
    boxSizing: 'border-box',
    border: '1px solid #ccc',
    borderRadius: '6px'
  }

  return (
    <main style={{
      maxWidth: '460px',
      margin: '50px auto',
      padding: '30px',
      border: '1px solid #ddd',
      borderRadius: '12px'
    }}>
      <h1>Registro de Jugadores</h1>
      <h2>YSASL</h2>
      <p>Yuba Sutter Adult Soccer League</p>

      <p>
        Crea tu cuenta para solicitar ingresar
        a un equipo de nuestra liga.
      </p>

      {!registrado && (
        <form onSubmit={registrar}>
          <label>Nombre completo</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            maxLength={120}
            style={estiloInput}
          />

          <label>Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={estiloInput}
          />

          <label>Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            style={estiloInput}
          />

          <label>Confirmar contraseña</label>
          <input
            type="password"
            value={confirmar}
            onChange={e => setConfirmar(e.target.value)}
            required
            style={estiloInput}
          />

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: '100%',
              padding: '14px',
              background: '#0b2948',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {cargando ? 'Registrando...' : 'Crear mi cuenta'}
          </button>
        </form>
      )}

      {mensaje && (
        <p role="status" style={{ marginTop: '20px' }}>
          {mensaje}
        </p>
      )}
    </main>
  )
}
