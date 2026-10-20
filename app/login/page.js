
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
    if (cargando) return

    setCargando(true)
    setMensaje('')

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })

      if (error || !data.user) {
        setMensaje('Correo o contraseña incorrectos.')
        return
      }

      const usuarioId = data.user.id

      // Verificar si es administrador
      const { data: perfil, error: errorPerfil } =
        await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', usuarioId)
          .maybeSingle()

      if (errorPerfil) throw errorPerfil

      if (perfil?.rol === 'admin') {
        router.replace('/admin')
        router.refresh()
        return
      }

      // Verificar si tiene equipos asignados
      const { data: delegados, error: errorDelegados } =
        await supabase
          .from('delegados_equipo')
          .select('id')
          .eq('usuario_id', usuarioId)
          .eq('activo', true)
          .limit(1)

      if (errorDelegados) throw errorDelegados

      if (delegados && delegados.length > 0) {
        router.replace('/delegado')
      } else {
        router.replace('/jugador')
      }

      router.refresh()

    } catch (err) {
      console.error('Error verificando acceso:', err)
      setMensaje(
        'No se pudo verificar tu tipo de usuario. ' +
        'Contacta al administrador.'
      )
    } finally {
      setCargando(false)
    }
  }

  return (
    <main style={{
      maxWidth: '420px',
      margin: '70px auto',
      padding: '30px',
      border: '1px solid #ddd',
      borderRadius: '12px'
    }}>
      <h1 style={{ marginTop: 0 }}>
        Acceso YSASL
      </h1>

      <p>
        Administradores, delegados y jugadores
      </p>

      <form onSubmit={iniciarSesion}>
        <label>Correo electrónico</label>

        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{
            width: '100%',
            padding: '12px',
            marginTop: '6px',
            marginBottom: '20px',
            boxSizing: 'border-box'
          }}
        />

        <label>Contraseña</label>

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
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
          <p role="alert" style={{
            marginTop: '20px',
            color: 'red'
          }}>
            {mensaje}
          </p>
        )}
      </form>

      <p style={{ marginTop: '25px' }}>
        ¿No tienes cuenta?{' '}
        <a href="/registro">
          Regístrate aquí
        </a>
      </p>
    </main>
  )
}
