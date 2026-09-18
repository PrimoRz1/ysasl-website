'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AdminJugadoresPage() {
  const router = useRouter()

  const [verificando, setVerificando] = useState(true)
  const [equipos, setEquipos] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [equipoId, setEquipoId] = useState('')
  const [nombre, setNombre] = useState('')
  const [numero, setNumero] = useState('')
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    verificarAcceso()
  }, [])

  async function verificarAcceso() {
    const {
      data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
      router.replace('/login')
      return
    }

    const { data: perfil, error } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', user.id)
      .single()

    if (error || !perfil || perfil.rol !== 'admin') {
      await supabase.auth.signOut()
      router.replace('/login')
      return
    }

    await cargarEquipos()
    await cargarJugadores()
    setVerificando(false)
  }

  async function cargarEquipos() {
    const { data, error } = await supabase
      .from('equipos')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')

    if (!error) {
      setEquipos(data || [])
    }
  }

  async function cargarJugadores() {
    const { data, error } = await supabase
      .from('jugadores')
      .select('id, equipo_id, nombre, numero, activo')
      .order('nombre')

    if (!error) {
      setJugadores(data || [])
    }
  }

  async function agregarJugador(e) {
    e.preventDefault()
    setMensaje('')

    if (!equipoId || !nombre.trim()) {
      setMensaje('Selecciona un equipo y escribe el nombre del jugador.')
      return
    }

    const { error } = await supabase
      .from('jugadores')
      .insert({
        equipo_id: Number(equipoId),
        nombre: nombre.trim(),
        numero: numero ? Number(numero) : null,
        activo: true
      })

    if (error) {
      setMensaje('No se pudo agregar el jugador: ' + error.message)
      return
    }

    setNombre('')
    setNumero('')
    setMensaje('Jugador agregado correctamente.')
    await cargarJugadores()
  }

  function nombreEquipo(id) {
    return equipos.find(equipo => equipo.id === id)?.nombre || 'Equipo'
  }

  if (verificando) {
    return (
      <main style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>
        <p>Verificando acceso...</p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>
      <button
        onClick={() => router.push('/admin')}
        style={{
          marginBottom: '25px',
          padding: '10px 16px',
          cursor: 'pointer'
        }}
      >
        ← Volver al panel
      </button>

      <h1>Administrar Jugadores</h1>
      <p>Agrega y administra los jugadores de YSASL.</p>

      <form
        onSubmit={agregarJugador}
        style={{
          marginTop: '30px',
          padding: '24px',
          border: '1px solid #ddd',
          borderRadius: '10px',
          maxWidth: '600px'
        }}
      >
        <h2>Agregar jugador</h2>

        <label>Equipo</label>
        <select
          value={equipoId}
          onChange={e => setEquipoId(e.target.value)}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px',
            marginTop: '6px',
            marginBottom: '18px'
          }}
        >
          <option value="">Seleccionar equipo</option>

          {equipos.map(equipo => (
            <option key={equipo.id} value={equipo.id}>
              {equipo.nombre}
            </option>
          ))}
        </select>

        <label>Nombre del jugador</label>
        <input
          type="text"
          value={nombre}
          onChange={e => setNombre(e.target.value)}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px',
            marginTop: '6px',
            marginBottom: '18px'
          }}
        />

        <label>Número de camiseta (opcional)</label>
        <input
          type="number"
          value={numero}
          onChange={e => setNumero(e.target.value)}
          style={{
            display: 'block',
            width: '100%',
            padding: '10px',
            marginTop: '6px',
            marginBottom: '18px'
          }}
        />

        <button
          type="submit"
          style={{
            background: '#0b2d50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '12px 20px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          Agregar jugador
        </button>

        {mensaje && (
          <p style={{ marginTop: '15px' }}>
            {mensaje}
          </p>
        )}
      </form>

      <section style={{ marginTop: '40px' }}>
        <h2>Jugadores registrados</h2>

        {jugadores.length === 0 ? (
          <p>Todavía no hay jugadores registrados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: '15px'
              }}
            >
              <thead>
                <tr>
                  <th style={celda}>Jugador</th>
                  <th style={celda}>Equipo</th>
                  <th style={celda}>Número</th>
                  <th style={celda}>Estado</th>
                </tr>
              </thead>

              <tbody>
                {jugadores.map(jugador => (
                  <tr key={jugador.id}>
                    <td style={celda}>{jugador.nombre}</td>
                    <td style={celda}>{nombreEquipo(jugador.equipo_id)}</td>
                    <td style={celda}>{jugador.numero ?? '-'}</td>
                    <td style={celda}>
                      {jugador.activo ? 'Activo' : 'Inactivo'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

const celda = {
  borderBottom: '1px solid #ddd',
  padding: '12px',
  textAlign: 'left'
}
