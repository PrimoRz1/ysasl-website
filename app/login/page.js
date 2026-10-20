
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

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })

      if (error || !data?.user) {
        setMensaje('Correo o contraseña incorrectos.')
        return
      }

      const usuario = data.user

      // Verificar si es administrador
      const { data: perfil, error: errorPerfil } =
        await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', usuario.id)
          .maybeSingle()

      if (errorPerfil) {
        throw new Error(
          'No se pudo verificar tu perfil: ' +
          errorPerfil.message
        )
      }

      if (perfil?.rol === 'admin') {
        router.replace('/admin')
        router.refresh()
        return
      }

      // Verificar si es delegado activo
      const { data: delegados, error: errorDelegados } =
        await supabase
          .from('delegados_equipo')
          .select('id')
          .eq('usuario_id', usuario.id)
          .eq('activo', true)
          .limit(1)

      if (errorDelegados) {
        throw new Error(
          'No se pudieron verificar tus permisos: ' +
          errorDelegados.message
        )
      }

      if (delegados && delegados.length > 0) {
        router.replace('/delegado')
        router.refresh()
        return
      }

      // Usuario normal: panel de jugador
      router.replace('/jugador')
      router.refresh()

    } catch (err) {
      setMensaje(
        err.message || 'No se pudo verificar el acceso.'
      )
    } finally {
      setCargando(false)
    }
  }

  const estiloInput = {
    width: '100%',
    padding: '12px',
    marginTop: '6px',
    marginBottom: '20px',
    boxSizing: 'border-box',
    border: '1px solid #ccc',
    borderRadius: '6px'
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

      <p>Yuba Sutter Adult Soccer League</p>

      <p>
        Inicia sesión para acceder a tu cuenta.
      </p>

      <form onSubmit={iniciarSesion}>
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
          style={estiloInput}
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
          {cargando
            ? 'Verificando acceso...'
            : 'Iniciar sesión'}
        </button>

        {mensaje && (
          <p role="alert" style={{
            marginTop: '20px',
            color: '#b91c1c'
          }}>
            {mensaje}
          </p>
        )}
      </form>
    </main>
  )
}
