
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function JugadorPage() {
  const router = useRouter()

  const [usuario, setUsuario] = useState(null)
  const [equipos, setEquipos] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [equipoId, setEquipoId] = useState('')
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data: auth, error: errorAuth } =
        await supabase.auth.getUser()

      if (errorAuth || !auth.user) {
        router.replace('/login')
        return
      }

      const user = auth.user

      const [respuestaEquipos, respuestaSolicitudes] =
        await Promise.all([
          supabase
            .from('equipos')
            .select('id, nombre')
            .eq('activo', true)
            .order('nombre'),

          supabase
            .from('solicitudes_jugadores')
            .select('id, equipo_id, estado, created_at')
            .eq('usuario_id', user.id)
            .order('created_at', { ascending: false })
        ])

      if (!activo) return

      setUsuario(user)
      setNombre(user.user_metadata?.nombre || '')

      if (respuestaEquipos.error || respuestaSolicitudes.error) {
        setError(
          respuestaEquipos.error?.message ||
          respuestaSolicitudes.error?.message
        )
      } else {
        setEquipos(respuestaEquipos.data || [])
        setSolicitudes(respuestaSolicitudes.data || [])
      }

      setCargando(false)
    }

    cargar()

    return () => {
      activo = false
    }
  }, [router])

  async function solicitarIngreso(e) {
    e.preventDefault()
    setError('')
    setMensaje('')

    if (!usuario || !equipoId) {
      setError('Selecciona un equipo.')
      return
    }

    const nombreLimpio = nombre.trim()

    if (nombreLimpio.length < 2 || nombreLimpio.length > 120) {
      setError('Escribe tu nombre completo.')
      return
    }

    const numeroLimpio = numero.trim()

    if (
      numeroLimpio !== '' &&
      !/^\d+$/.test(numeroLimpio)
    ) {
      setError('El número de camiseta debe ser un entero.')
      return
    }

    const numeroJugador = numeroLimpio === ''
      ? null
      : Number(numeroLimpio)

    if (
      numeroJugador !== null &&
      (!Number.isSafeInteger(numeroJugador) ||
        numeroJugador > 999)
    ) {
      setError('Escribe un número de camiseta válido.')
      return
    }

    const repetida = solicitudes.some(s =>
      Number(s.equipo_id) === Number(equipoId) &&
      ['pendiente', 'aprobada'].includes(s.estado)
    )

    if (repetida) {
      setError('Ya tienes una solicitud para este equipo.')
      return
    }

    setGuardando(true)

    const { error: errorInsertar } = await supabase
      .from('solicitudes_jugadores')
      .insert({
        usuario_id: usuario.id,
        equipo_id: Number(equipoId),
        nombre: nombreLimpio,
        numero: numeroJugador,
        estado: 'pendiente'
      })

    if (errorInsertar) {
      setError('No se pudo enviar: ' + errorInsertar.message)
      setGuardando(false)
      return
    }

    const { data, error: errorConsulta } = await supabase
      .from('solicitudes_jugadores')
      .select('id, equipo_id, estado, created_at')
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false })

    if (errorConsulta) {
      setError(
        'Solicitud enviada, pero no se pudo actualizar la lista.'
      )
    } else {
      setSolicitudes(data || [])
      setMensaje(
        'Solicitud enviada correctamente. ' +
        'Espera la aprobación del delegado.'
      )
    }

    setEquipoId('')
    setNumero('')
    setGuardando(false)
  }

  async function cerrarSesion() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setError('No se pudo cerrar la sesión.')
      return
    }

    router.replace('/login')
    router.refresh()
  }

  const inputStyle = {
    width: '100%',
    padding: '12px',
    marginTop: '6px',
    marginBottom: '18px',
    boxSizing: 'border-box',
    border: '1px solid #ccc',
    borderRadius: '6px'
  }

  if (cargando) {
    return <main style={{ padding: 30 }}>Cargando...</main>
  }

  return (
    <main style={{
      maxWidth: '750px',
      margin: '40px auto',
      padding: '20px'
    }}>
      <h1>Mi Panel de Jugador</h1>
      <p>Yuba Sutter Adult Soccer League</p>

      <p>
        Bienvenido, {nombre || usuario?.email}
      </p>

      <button onClick={cerrarSesion}>
        Cerrar sesión
      </button>

      <hr style={{ margin: '30px 0' }} />

      <h2>Solicitar ingreso a un equipo</h2>

      <form onSubmit={solicitarIngreso}>
        <label>Nombre completo</label>
        <input
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          required
          maxLength={120}
          style={inputStyle}
        />

        <label>Seleccionar equipo</label>
        <select
          value={equipoId}
          onChange={e => setEquipoId(e.target.value)}
          required
          style={inputStyle}
        >
          <option value="">Selecciona tu equipo</option>
          {equipos.map(equipo => (
            <option key={equipo.id} value={equipo.id}>
              {equipo.nombre}
            </option>
          ))}
        </select>

        <label>Número de camiseta (opcional)</label>
        <input
          type="number"
          min="0"
          max="999"
          value={numero}
          onChange={e => setNumero(e.target.value)}
          style={inputStyle}
        />

        <button
          type="submit"
          disabled={guardando || !!error && equipos.length === 0}
          style={{
            background: '#0b2948',
            color: 'white',
            padding: '13px 20px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {guardando ? 'Enviando...' : 'Solicitar ingreso'}
        </button>
      </form>

      {mensaje && (
        <p role="status" style={{ color: 'green' }}>
          {mensaje}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: 'red' }}>
          {error}
        </p>
      )}

      <hr style={{ margin: '30px 0' }} />

      <h2>Mis solicitudes</h2>

      {solicitudes.length === 0 ? (
        <p>Todavía no tienes solicitudes.</p>
      ) : (
        solicitudes.map(s => {
          const equipo = equipos.find(
            e => Number(e.id) === Number(s.equipo_id)
          )

          return (
            <div key={s.id} style={{
              border: '1px solid #ddd',
              borderRadius: '8px',
              padding: '15px',
              marginBottom: '12px'
            }}>
              <strong>
                {equipo?.nombre || `Equipo #${s.equipo_id}`}
              </strong>

              <p>
                Estado: <strong>{s.estado}</strong>
              </p>
            </div>
          )
        })
      )}
    </main>
  )
}
