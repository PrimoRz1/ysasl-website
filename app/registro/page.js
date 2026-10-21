'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function RegistroPage() {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [cargando, setCargando] = useState(false)
  const [registrado, setRegistrado] = useState(false)

  const [equipoInvitado, setEquipoInvitado] = useState(null)
  const [estadoInvitacion, setEstadoInvitacion] = useState('cargando')
  const [errorInvitacion, setErrorInvitacion] = useState('')

  useEffect(() => {
    let activo = true

    async function revisarInvitacion() {
      const params = new URLSearchParams(window.location.search)
      const equipoParam = params.get('equipo')

      if (!equipoParam) {
        setEstadoInvitacion('ninguna')
        return
      }

      // En YSASL los equipos tienen identificadores numericos.
      if (!/^[1-9]\d*$/.test(equipoParam) ||
          !Number.isSafeInteger(Number(equipoParam))) {
        setErrorInvitacion('El enlace de invitación no es válido.')
        setEstadoInvitacion('invalida')
        return
      }

      const { data, error } = await supabase
        .from('equipos')
        .select('id, nombre')
        .eq('id', Number(equipoParam))
        .maybeSingle()

      if (!activo) return

      if (error || !data) {
        setErrorInvitacion(
          'No pudimos verificar el equipo de la invitación. ' +
          'Pide al delegado que revise el enlace.'
        )
        setEstadoInvitacion('invalida')
        return
      }

      setEquipoInvitado(data)
      setEstadoInvitacion('valida')
    }

    revisarInvitacion().catch(() => {
      if (!activo) return
      setErrorInvitacion('No pudimos verificar la invitación.')
      setEstadoInvitacion('invalida')
    })

    return () => {
      activo = false
    }
  }, [])

  async function registrar(e) {
    e.preventDefault()
    if (cargando || registrado) return

    setMensaje('')

    if (estadoInvitacion === 'cargando' || estadoInvitacion === 'invalida') {
      setMensaje('Espera a que se verifique la invitación.')
      return
    }

    if (!nombre.trim()) {
      setMensaje('Escribe tu nombre completo.')
      return
    }

    if (password.length < 8) {
      setMensaje('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (password !== confirmar) {
      setMensaje('Las contraseñas no coinciden.')
      return
    }

    setCargando(true)

    try {
      const idInvitado = equipoInvitado?.id ?? null
      const destino = new URL('/login', window.location.origin)

      if (idInvitado !== null) {
        destino.searchParams.set('equipo', String(idInvitado))
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: destino.toString(),
          data: {
            nombre: nombre.trim(),
            ...(idInvitado !== null
              ? { equipo_invitacion: idInvitado }
              : {})
          }
        }
      })

      if (error) throw error

      setRegistrado(true)

      if (data.session) {
        setMensaje(
          idInvitado !== null
            ? 'Cuenta creada. Tu invitación quedó asociada a tu registro. ' +
              'Entra al Panel de Jugador para continuar.'
            : 'Cuenta creada. Entra al Panel de Jugador para solicitar ingreso a un equipo.'
        )
      } else {
        setMensaje(
          idInvitado !== null
            ? 'Registro recibido. Revisa tu correo para confirmar tu cuenta. ' +
              'La invitación quedó guardada en el registro; ' +
              'después podrás iniciar sesión.'
            : 'Registro recibido. Revisa tu correo para confirmar tu cuenta ' +
              'si se solicita; después podrás iniciar sesión.'
        )
      }
    } catch (err) {
      setMensaje('No se pudo completar el registro: ' + (err.message || 'Error desconocido.'))
    } finally {
      setCargando(false)
    }
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

      {estadoInvitacion === 'cargando' ? (
        <p>Verificando invitación...</p>
      ) : estadoInvitacion === 'invalida' ? (
        <div role="alert" style={{ color: '#b91c1c' }}>
          <p>{errorInvitacion}</p>
          <a href="/registro">Registrarme sin invitación</a>
        </div>
      ) : equipoInvitado ? (
        <div style={{
          padding: '16px',
          marginBottom: '22px',
          background: '#f0f7ff',
          border: '1px solid #bfd7f0',
          borderRadius: '8px'
        }}>
          <strong>Invitación de equipo</strong>
          <p style={{ marginBottom: 0 }}>
            Te invitaron a registrarte para solicitar ingreso a{' '}
            <strong>{equipoInvitado.nombre}</strong>.
            El delegado deberá aprobar tu solicitud.
          </p>
        </div>
      ) : (
        <p>
          Crea tu cuenta para solicitar ingresar a un equipo de nuestra liga.
        </p>
      )}

      {!registrado && estadoInvitacion !== 'cargando' &&
        estadoInvitacion !== 'invalida' && (
        <form onSubmit={registrar}>
          <label htmlFor="nombre">Nombre completo</label>
          <input
            id="nombre"
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
            maxLength={120}
            autoComplete="name"
            style={estiloInput}
          />

          <label htmlFor="email">Correo electrónico</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            style={estiloInput}
          />

          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            style={estiloInput}
          />

          <label htmlFor="confirmar">Confirmar contraseña</label>
          <input
            id="confirmar"
            type="password"
            value={confirmar}
            onChange={e => setConfirmar(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
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
              cursor: cargando ? 'wait' : 'pointer',
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

      {registrado && (
        <p>
          <a href="/login">Ir a iniciar sesión</a>
        </p>
      )}

      {!registrado && estadoInvitacion !== 'invalida' && (
        <p style={{ marginTop: '25px' }}>
          ¿Ya tienes cuenta?{' '}
          <a href={equipoInvitado
            ? `/login?equipo=${encodeURIComponent(equipoInvitado.id)}`
            : '/login'}>
            Inicia sesión aquí
          </a>
        </p>
      )}
    </main>
  )
}
