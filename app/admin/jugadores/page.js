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

  const [editandoId, setEditandoId] = useState(null)
  const [editNombre, setEditNombre] = useState('')
  const [editEquipoId, setEditEquipoId] = useState('')
  const [editNumero, setEditNumero] = useState('')

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

  function comenzarEdicion(jugador) {
    setEditandoId(jugador.id)
    setEditNombre(jugador.nombre)
    setEditEquipoId(String(jugador.equipo_id))
    setEditNumero(jugador.numero ?? '')
    setMensaje('')
  }

  function cancelarEdicion() {
    setEditandoId(null)
    setEditNombre('')
    setEditEquipoId('')
    setEditNumero('')
  }

  async function guardarEdicion(id) {
    if (!editNombre.trim() || !editEquipoId) {
      setMensaje('El jugador debe tener nombre y equipo.')
      return
    }

    const { error } = await supabase
      .from('jugadores')
      .update({
        nombre: editNombre.trim(),
        equipo_id: Number(editEquipoId),
        numero: editNumero === '' ? null : Number(editNumero)
      })
      .eq('id', id)

    if (error) {
      setMensaje('No se pudo actualizar el jugador: ' + error.message)
      return
    }

    cancelarEdicion()
    setMensaje('Jugador actualizado correctamente.')
    await cargarJugadores()
  }

  async function cambiarEstado(jugador) {
    const nuevoEstado = !jugador.activo

    const { error } = await supabase
      .from('jugadores')
      .update({ activo: nuevoEstado })
      .eq('id', jugador.id)

    if (error) {
      setMensaje('No se pudo cambiar el estado: ' + error.message)
      return
    }

    setMensaje(
      nuevoEstado
        ? 'Jugador activado correctamente.'
        : 'Jugador desactivado correctamente.'
    )

    await cargarJugadores()
  }

  async function eliminarJugador(jugador) {
    const confirmar = window.confirm(
      `¿Seguro que deseas eliminar a ${jugador.nombre}?`
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('jugadores')
      .delete()
      .eq('id', jugador.id)

    if (error) {
      setMensaje(
        'No se pudo eliminar el jugador. Puede tener resultados, goles o disciplina asociados. ' +
          error.message
      )
      return
    }

    setMensaje('Jugador eliminado correctamente.')
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
      <p>Agrega, edita y administra los jugadores de YSASL.</p>

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
          style={campo}
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
          style={campo}
        />

        <label>Número de camiseta (opcional)</label>
        <input
          type="number"
          value={numero}
          onChange={e => setNumero(e.target.value)}
          style={campo}
        />

        <button type="submit" style={botonPrincipal}>
          Agregar jugador
        </button>
      </form>

      {mensaje && (
        <p
          style={{
            marginTop: '20px',
            padding: '12px',
            background: '#f4f4f4',
            borderRadius: '6px'
          }}
        >
          {mensaje}
        </p>
      )}

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
                  <th style={celda}>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {jugadores.map(jugador => (
                  <tr key={jugador.id}>
                    {editandoId === jugador.id ? (
                      <>
                        <td style={celda}>
                          <input
                            value={editNombre}
                            onChange={e => setEditNombre(e.target.value)}
                            style={campoTabla}
                          />
                        </td>

                        <td style={celda}>
                          <select
                            value={editEquipoId}
                            onChange={e => setEditEquipoId(e.target.value)}
                            style={campoTabla}
                          >
                            {equipos.map(equipo => (
                              <option key={equipo.id} value={equipo.id}>
                                {equipo.nombre}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td style={celda}>
                          <input
                            type="number"
                            value={editNumero}
                            onChange={e => setEditNumero(e.target.value)}
                            style={{ ...campoTabla, width: '80px' }}
                          />
                        </td>

                        <td style={celda}>
                          {jugador.activo ? 'Activo' : 'Inactivo'}
                        </td>

                        <td style={celda}>
                          <button
                            onClick={() => guardarEdicion(jugador.id)}
                            style={botonGuardar}
                          >
                            Guardar
                          </button>

                          <button
                            onClick={cancelarEdicion}
                            style={botonSecundario}
                          >
                            Cancelar
                          </button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={celda}>{jugador.nombre}</td>
                        <td style={celda}>{nombreEquipo(jugador.equipo_id)}</td>
                        <td style={celda}>{jugador.numero ?? '-'}</td>

                        <td style={celda}>
                          {jugador.activo ? 'Activo' : 'Inactivo'}
                        </td>

                        <td style={celda}>
                          <button
                            onClick={() => comenzarEdicion(jugador)}
                            style={botonEditar}
                          >
                            Editar
                          </button>

                          <button
                            onClick={() => cambiarEstado(jugador)}
                            style={botonSecundario}
                          >
                            {jugador.activo ? 'Desactivar' : 'Activar'}
                          </button>

                          <button
                            onClick={() => eliminarJugador(jugador)}
                            style={botonEliminar}
                          >
                            Eliminar
                          </button>
                        </td>
                      </>
                    )}
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

const campo = {
  display: 'block',
  width: '100%',
  padding: '10px',
  marginTop: '6px',
  marginBottom: '18px'
}

const campoTabla = {
  padding: '8px',
  width: '100%',
  boxSizing: 'border-box'
}

const botonPrincipal = {
  background: '#0b2d50',
  color: 'white',
  border: 'none',
  borderRadius: '6px',
  padding: '12px 20px',
  cursor: 'pointer',
  fontWeight: 'bold'
}

const botonEditar = {
  padding: '7px 10px',
  marginRight: '6px',
  marginBottom: '4px',
  cursor: 'pointer'
}

const botonGuardar = {
  background: '#0b2d50',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 10px',
  marginRight: '6px',
  cursor: 'pointer'
}

const botonSecundario = {
  padding: '7px 10px',
  marginRight: '6px',
  marginBottom: '4px',
  cursor: 'pointer'
}

const botonEliminar = {
  background: '#b42318',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  padding: '8px 10px',
  cursor: 'pointer'
}

const celda = {
  borderBottom: '1px solid #ddd',
  padding: '12px',
  textAlign: 'left',
  verticalAlign: 'middle'
}
