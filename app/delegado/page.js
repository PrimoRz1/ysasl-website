
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
      const { data, error: errorLogin } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })

      if (errorLogin || !data?.user) {
        setMensaje(
          'No se pudo iniciar sesión. Verifica tus datos y confirma tu correo.'
        )
        return
      }

      const usuario = data.user

      // 1. Verificar administrador
      const { data: perfil, error: errorPerfil } =
        await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', usuario.id)
          .maybeSingle()

      if (errorPerfil) throw errorPerfil

      if (perfil?.rol === 'admin') {
        router.replace('/admin')
        router.refresh()
        return
      }

      // 2. Verificar delegado activo
      const { data: delegado, error: errorDelegado } =
        await supabase
          .from('delegados_equipo')
          .select('equipo_id')
          .eq('usuario_id', usuario.id)
          .eq('activo', true)
          .limit(1)
          .maybeSingle()

      if (errorDelegado) throw errorDelegado

      if (delegado) {
        router.replace('/delegado')
        router.refresh()
        return
      }

      // 3. Los demás usuarios entran al panel de jugador
      router.replace('/jugador')
      router.refresh()

    } catch (err) {
      console.error('Error verificando acceso:', err)
      setMensaje(
        'No se pudieron verificar los permisos. Intenta nuevamente.'
      )
    } finally {
      setCargando(false)
    }
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
      <h1>Acceso YSASL</h1>

      <p>
        Yuba Sutter Adult Soccer League
      </p>

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
          {cargando ? 'Verificando acceso...' : 'Iniciar sesión'}
        </button>

        {mensaje && (
          <p role="alert" style={{
            color: '#b91c1c',
            marginTop: '20px'
          }}>
            {mensaje}
          </p>
        )}
      </form>
    </main>
  )
}
