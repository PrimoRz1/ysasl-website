'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import CampoContrasena from '../components/CampoContrasena'

const estiloCampo = {
  width: '100%',
  padding: '12px',
  marginTop: '6px',
  marginBottom: '20px',
  boxSizing: 'border-box'
}

const estiloBoton = {
  width: '100%',
  padding: '13px',
  background: '#0b2948',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  fontWeight: 'bold',
  cursor: 'pointer'
}

const estiloOpcion = {
  flex: '1 1 155px',
  textAlign: 'center',
  padding: '12px 8px',
  border: '1px solid #0b2948',
  borderRadius: '7px',
  color: '#0b2948',
  textDecoration: 'none',
  fontWeight: 'bold',
  fontSize: '13px'
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main style={{ maxWidth: '420px', margin: '70px auto', padding: '30px' }}>Cargando acceso...</main>}>
      <LoginContenido />
    </Suspense>
  )
}

function LoginContenido() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Se recalcula cada vez que cambia ?tipo=, sin refrescar el navegador.
  const tipo = searchParams.get('tipo')
  const tipoAcceso = ['jugador', 'equipo', 'admin'].includes(tipo) ? tipo : ''

  // Conservar la invitación del equipo durante el acceso.
  // Aceptar únicamente un ID numérico válido; nunca una URL arbitraria.
  const equipoParametro = searchParams.get('equipo')
  const equipoNumero = Number(equipoParametro)
  const equipoInvitado = equipoParametro && /^\d+$/.test(equipoParametro) &&
    Number.isSafeInteger(equipoNumero) && equipoNumero > 0
      ? String(equipoNumero)
      : ''
  const sufijoEquipo = equipoInvitado ? `&equipo=${equipoInvitado}` : ''
  const ficha = searchParams.get('ficha')
  const fichaSolicitada = /^[1-9]\d*$/.test(ficha || '') && Number.isSafeInteger(Number(ficha)) ? ficha : ''
  const rutaRegistro = fichaSolicitada ? `/registro?ficha=${fichaSolicitada}`
    : equipoInvitado ? `/registro?equipo=${equipoInvitado}` : '/registro'

  // 'login' = acceso normal; 'recuperar' = enviar correo;
  // 'nueva' = guardar una nueva contraseña después de abrir el enlace.
  const [modo, setModo] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmarPassword, setConfirmarPassword] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [mensajeExito, setMensajeExito] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [correoPendiente, setCorreoPendiente] = useState('')
  const [reenviando, setReenviando] = useState(false)
  const [avisoConfirmacion, setAvisoConfirmacion] = useState(
    searchParams.get('confirmado') === '1'
      ? 'Tu correo ya está confirmado. Inicia sesión con la contraseña que creaste.'
      : ''
  )
  const [correoRecuperacion, setCorreoRecuperacion] = useState('')

  useEffect(() => {
    // Supabase redirige aquí al abrir el enlace de recuperación.
    // El parámetro permite mostrar el formulario incluso si el evento
    // PASSWORD_RECOVERY ocurrió antes de montar este componente.
    const url = new URL(window.location.href)
    if (
      url.searchParams.get('restablecer') === '1' ||
      url.hash.includes('type=recovery')
    ) {
      setModo('nueva')
    }

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((evento) => {
        if (evento === 'PASSWORD_RECOVERY') {
          setModo('nueva')
          setMensaje('')
        }
      })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (modo !== 'nueva') return
    let activo = true

    supabase.auth.getUser().then(({ data, error }) => {
      if (activo && !error) setCorreoRecuperacion(data.user?.email || '')
    }).catch(() => {
      // guardarNuevaContrasena validates the recovery session before updating.
    })

    return () => { activo = false }
  }, [modo])

  function cambiarModo(siguienteModo) {
    setModo(siguienteModo)
    setCorreoPendiente('')
    setAvisoConfirmacion('')
    setMensaje('')
    setMensajeExito(false)
  }

  async function iniciarSesion(e) {
    e.preventDefault()
    if (cargando || reenviando) return

    setCorreoPendiente('')
    setAvisoConfirmacion('')
    setCargando(true)
    setMensaje('')
    setMensajeExito(false)

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        })

      if (error?.code === 'email_not_confirmed') {
        setCorreoPendiente(email.trim())
        setMensaje('Confirma tu correo para iniciar sesión. Revisa también Spam.')
        return
      }

      if (error || !data.user) {
        setMensaje(error?.code === 'invalid_credentials'
          ? 'Correo o contraseña incorrectos.'
          : 'No se pudo iniciar sesión. Inténtalo de nuevo.')
        return
      }

      // La invitación conduce al panel del jugador, sin agregarlo al equipo.
      // El panel debe reconocer ?equipo= y comprobar solicitudes existentes.
      // Sin invitación se mantiene el selector de paneles de siempre.
      const destino = fichaSolicitada ? `/vincular-ficha?jugador=${fichaSolicitada}`
        : equipoInvitado ? `/jugador?equipo=${equipoInvitado}` : '/mis-paneles'
      router.replace(destino)
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

  async function reenviarConfirmacion() {
    if (!correoPendiente || cargando || reenviando) return
    setReenviando(true)
    setMensaje('')
    setMensajeExito(false)
    try {
      const destino = new URL('/login', window.location.origin)
      if (fichaSolicitada) destino.searchParams.set('ficha', fichaSolicitada)
      else if (equipoInvitado) destino.searchParams.set('equipo', equipoInvitado)

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: correoPendiente,
        options: { emailRedirectTo: destino.toString() }
      })
      if (error) throw error

      setMensaje('Si el correo sigue pendiente de confirmar, recibirás un enlace. Revisa también Spam.')
      setMensajeExito(true)
      setCorreoPendiente('')
    } catch (error) {
      setMensaje(error.status === 429
        ? 'Espera un momento antes de volver a solicitar el correo de confirmación.'
        : 'No se pudo reenviar el correo de confirmación. Inténtalo de nuevo.')
    } finally {
      setReenviando(false)
    }
  }

  async function solicitarRecuperacion(e) {
    e.preventDefault()
    if (cargando) return

    setCargando(true)
    setMensaje('')
    setMensajeExito(false)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/login?restablecer=1`
        }
      )

      if (error) throw error

      setMensaje(
        'Si este correo está registrado, recibirás un enlace para ' +
        'crear una nueva contraseña. Revisa también Spam.'
      )
      setMensajeExito(true)
    } catch (err) {
      console.error('Error enviando recuperación:', err)
      if (
        err.status === 429 ||
        /rate limit/i.test(err.message || '')
      ) {
        setMensaje(
          'Supabase alcanzó el límite temporal de correos. ' +
          'Espera antes de volver a intentarlo.'
        )
      } else {
        setMensaje(
          'No se pudo solicitar la recuperación: ' +
          (err.message || 'Inténtalo más tarde.')
        )
      }
    } finally {
      setCargando(false)
    }
  }

  async function guardarNuevaContrasena(e) {
    e.preventDefault()
    if (cargando) return

    setMensaje('')
    setMensajeExito(false)

    if (nuevaPassword.length < 8) {
      setMensaje('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (nuevaPassword !== confirmarPassword) {
      setMensaje('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)

    try {
      // El enlace debe haber creado una sesión de recuperación válida.
      const { data: usuarioData, error: errorUsuario } =
        await supabase.auth.getUser()

      if (errorUsuario || !usuarioData.user) {
        setMensaje(
          'El enlace no es válido o ha vencido. ' +
          'Solicita otro desde ¿Olvidaste tu contraseña?'
        )
        return
      }

      const { error } = await supabase.auth.updateUser({
        password: nuevaPassword
      })

      if (error) throw error

      await supabase.auth.signOut()
      setPassword('')
      setNuevaPassword('')
      setConfirmarPassword('')
      setModo('login')
      setMensaje('Contraseña actualizada. Ya puedes iniciar sesión.')
      setMensajeExito(true)
      router.replace('/login')
    } catch (err) {
      console.error('Error cambiando contraseña:', err)
      setMensaje(
        'No se pudo actualizar la contraseña: ' +
        (err.message || 'Inténtalo nuevamente.')
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
        {modo === 'login'
          ? tipoAcceso === 'jugador'
            ? 'Acceso para Jugadores'
            : tipoAcceso === 'equipo'
              ? 'Acceso para Administradores de Equipo'
              : tipoAcceso === 'admin'
                ? 'Acceso exclusivo para Administradores de la Liga'
                : 'Acceso YSASL'
          : modo === 'recuperar'
            ? 'Recuperar contraseña'
            : 'Nueva contraseña'}
      </h1>

      <p>
        {modo === 'login'
          ? tipoAcceso === 'jugador'
            ? 'Inicia sesión para consultar tu perfil, solicitudes e invitaciones.'
            : tipoAcceso === 'equipo'
              ? 'Inicia sesión para administrar tu equipo y sus jugadores.'
              : tipoAcceso === 'admin'
                ? 'Acceso reservado a los administradores generales autorizados de YSASL.'
                : 'Inicia sesión con tu cuenta. El sistema te enviará a tu panel autorizado.'
          : modo === 'recuperar'
            ? 'Escribe tu correo para recibir un enlace de recuperación.'
            : 'Escribe y confirma tu nueva contraseña.'}
      </p>

      {modo === 'login' && equipoInvitado && (
        <p style={{ background: '#eef5fc', border: '1px solid #c5dcf2',
          borderRadius: '6px', padding: '12px', fontSize: '13px' }}>
          ⚽ Invitación de equipo recibida. Al iniciar sesión irás a tu panel
          de jugador para revisar el ingreso. No se te incorporará automáticamente.
        </p>
      )}

      {modo === 'login' && !tipoAcceso && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
          <a href={`/login?tipo=jugador${sufijoEquipo}`} style={estiloOpcion}>⚽ Jugadores</a>
          <a href={`/login?tipo=equipo${sufijoEquipo}`} style={estiloOpcion}>👥 Administradores de Equipo</a>
        </div>
      )}

      {modo === 'login' && tipoAcceso && (
        <p style={{ fontSize: '13px', marginTop: '-4px', marginBottom: '20px' }}>
          <a href={equipoInvitado ? `/login?equipo=${equipoInvitado}` : '/login'}>Elegir otro acceso</a>
        </p>
      )}

      {modo === 'login' && (
        <form onSubmit={iniciarSesion}>
          <label htmlFor="correo-login">Correo electrónico</label>
          <input
            id="correo-login"
            type="email"
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              setCorreoPendiente('')
            }}
            required
            autoComplete="email"
            style={estiloCampo}
          />

          <label htmlFor="password-login">Contraseña</label>
          <CampoContrasena
            id="password-login"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            style={estiloCampo}
          />

          <button type="submit" disabled={cargando} style={estiloBoton}>
            {cargando ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
      )}

      {modo === 'recuperar' && (
        <form onSubmit={solicitarRecuperacion}>
          <label htmlFor="correo-recuperar">Correo electrónico</label>
          <input
            id="correo-recuperar"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={estiloCampo}
          />

          <button type="submit" disabled={cargando} style={estiloBoton}>
            {cargando ? 'Enviando...' : 'Enviar enlace de recuperación'}
          </button>
        </form>
      )}

      {modo === 'nueva' && (
        <form onSubmit={guardarNuevaContrasena}>
          {correoRecuperacion && <p>Cuenta: <strong>{correoRecuperacion}</strong></p>}
          <label htmlFor="password-nueva">Nueva contraseña</label>
          <CampoContrasena
            id="password-nueva"
            value={nuevaPassword}
            onChange={e => setNuevaPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            style={estiloCampo}
          />

          <label htmlFor="password-confirmar">Confirmar contraseña</label>
          <CampoContrasena
            id="password-confirmar"
            value={confirmarPassword}
            onChange={e => setConfirmarPassword(e.target.value)}
            minLength={8}
            required
            autoComplete="new-password"
            style={estiloCampo}
          />

          <button type="submit" disabled={cargando} style={estiloBoton}>
            {cargando ? 'Guardando...' : 'Guardar nueva contraseña'}
          </button>
        </form>
      )}

      {modo === 'login' && avisoConfirmacion && (
        <p role="status" style={{ color: 'green' }}>{avisoConfirmacion}</p>
      )}

      {mensaje && (
        <p role={mensajeExito ? 'status' : 'alert'} style={{
          marginTop: '20px',
          color: mensajeExito ? 'green' : 'red'
        }}>
          {mensaje}
        </p>
      )}

      {modo === 'login' && correoPendiente && (
        <button type="button" onClick={reenviarConfirmacion}
          disabled={reenviando || cargando} style={estiloBoton}>
          {reenviando ? 'Reenviando...' : 'Reenviar correo de confirmación'}
        </button>
      )}

      {modo === 'login' ? (
        <>
          <p style={{ marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => cambiarModo('recuperar')}
              style={{
                border: 'none',
                padding: 0,
                background: 'transparent',
                color: '#0b2948',
                textDecoration: 'underline',
                cursor: 'pointer'
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </p>

          {tipoAcceso !== 'admin' && (
            <p style={{ marginTop: '25px' }}>
              ¿No tienes cuenta?{' '}
              <a href={rutaRegistro}>Regístrate aquí</a>
            </p>
          )}
        </>
      ) : (
        <p style={{ marginTop: '25px' }}>
          <button
            type="button"
            onClick={() => cambiarModo('login')}
            style={{
              border: 'none',
              padding: 0,
              background: 'transparent',
              color: '#0b2948',
              textDecoration: 'underline',
              cursor: 'pointer'
            }}
          >
            Volver a iniciar sesión
          </button>
        </p>
      )}
    </main>
  )
}
