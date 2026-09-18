'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)

  async function iniciarSesion(e) {
    e.preventDefault()

    setCargando(true)
    setMensaje('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setMensaje('Correo electrónico o contraseña incorrectos.')
      setCargando(false)
      return
    }

    router.push('/admin')
    router.refresh()
  }

  return (
    <main
      style={{
        maxWidth: '420px',
        margin: '70px auto',
        padding: '30px',
        border: '1px solid #ddd',
        borderRadius: '12px'
      }}
    >
      <h1 style={{ marginTop: 0 }}>Administración YSASL</h1>

      <p>Inicia sesión para administrar la liga.</p>

      <form onSubmit={iniciarSesion}>
        <label>
          Correo electrónico
        </label>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '6px',
            marginBottom: '20px',
            boxSizing: 'border-box'
          }}
        />

        <label>
          Contraseña
        </label>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '6px',
            marginBottom: '20px',
            boxSizing: 'border-box'
          }}
        />

        <button
          type="submit"
          disabled={cargando}
          style={{
            width: '100%',
            padding: '13px',
            background: '#0b2948',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {cargando ? 'Ingresando...' : 'Iniciar sesión'}
        </button>

        {mensaje && (
          <p style={{ marginTop: '20px' }}>
            {mensaje}
          </p>
        )}
      </form>
    </main>
  )
}
