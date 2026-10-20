
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AdministrarDelegados() {
  const router = useRouter()

  const [autorizado, setAutorizado] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [equipos, setEquipos] = useState([])
  const [delegados, setDelegados] = useState([])
  const [equipoId, setEquipoId] = useState('')
  const [usuarioId, setUsuarioId] = useState('')
  const [tipo, setTipo] = useState('principal')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  async function cargarDatos() {
    const [resEquipos, resDelegados] = await Promise.all([
      supabase
        .from('equipos')
        .select('id, nombre, division_id')
        .order('nombre'),

      supabase
        .from('delegados_equipo')
        .select('id, equipo_id, usuario_id, tipo, activo')
        .order('id', { ascending: false })
    ])

    if (resEquipos.error) throw resEquipos.error
    if (resDelegados.error) throw resDelegados.error

    setEquipos(resEquipos.data || [])
    setDelegados(resDelegados.data || [])
  }

  useEffect(() => {
    let activo = true

    async function verificar() {
      try {
        const { data, error: errorAuth } =
          await supabase.auth.getUser()

        if (errorAuth || !data.user) {
          router.replace('/login')
          return
        }

        const { data: perfil, error: errorPerfil } =
          await supabase
            .from('perfiles')
            .select('rol')
            .eq('id', data.user.id)
            .maybeSingle()

        if (errorPerfil) throw errorPerfil

        if (perfil?.rol !== 'admin') {
          router.replace('/jugador')
          return
        }

        if (!activo) return

        setAutorizado(true)
        await cargarDatos()
      } catch (err) {
        if (activo) {
          setError(err.message || 'Error verificando acceso.')
        }
      } finally {
        if (activo) setCargando(false)
      }
    }

    verificar()

    return () => {
      activo = false
    }
  }, [router])

  async function asignarDelegado(e) {
    e.preventDefault()
    setError('')
    setMensaje('')

    const uid = usuarioId.trim()

    const formatoUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

    if (!equipoId || !formatoUUID.test(uid)) {
      setError('Selecciona un equipo e ingresa un UID válido.')
      return
    }

    setGuardando(true)

    try {
      const { error: errorGuardar } = await supabase
        .from('delegados_equipo')
        .upsert({
          equipo_id: Number(equipoId),
          usuario_id: uid,
          tipo,
          activo: true
        }, {
          onConflict: 'equipo_id,usuario_id'
        })

      if (errorGuardar) throw errorGuardar

      await cargarDatos()

      setUsuarioId('')
      setEquipoId('')
      setTipo('principal')
      setMensaje('Delegado asignado correctamente.')
    } catch (err) {
      setError('No se pudo asignar: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(delegado) {
    setGuardando(true)
    setError('')
    setMensaje('')

    try {
      const { error: errorCambio } = await supabase
        .from('delegados_equipo')
        .update({ activo: !delegado.activo })
        .eq('id', delegado.id)

      if (errorCambio) throw errorCambio

      await cargarDatos()
      setMensaje('Estado actualizado correctamente.')
    } catch (err) {
      setError('No se pudo actualizar: ' + err.message)
    } finally {
      setGuardando(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '12px',
    marginTop: '6px',
    marginBottom: '18px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    boxSizing: 'border-box'
  }

  if (cargando) {
    return <main style={{ padding: 30 }}>
      Verificando acceso...
    </main>
  }

  if (!autorizado) {
    return <main style={{ padding: 30 }}>
      {error || 'Acceso no autorizado.'}
    </main>
  }

  return (
    <main style={{
      maxWidth: '950px',
      margin: '40px auto',
      padding: '20px'
    }}>
      <h1>Administrar Delegados</h1>
      <p>Yuba Sutter Adult Soccer League</p>

      <a href="/admin">← Volver a Administración</a>

      <hr style={{ margin: '30px 0' }} />

      <h2>Asignar delegado a un equipo</h2>

      <p>
        El usuario debe existir previamente en
        Supabase Authentication.
      </p>

      <form onSubmit={asignarDelegado}>
        <label>Seleccionar equipo</label>
        <select
          value={equipoId}
          onChange={e => setEquipoId(e.target.value)}
          required
          style={inputStyle}
        >
          <option value="">Selecciona un equipo</option>
          {equipos.map(equipo => (
            <option key={equipo.id} value={equipo.id}>
              {equipo.nombre} — División {equipo.division_id}
            </option>
          ))}
        </select>

        <label>UID del usuario en Supabase</label>
        <input
          type="text"
          value={usuarioId}
          onChange={e => setUsuarioId(e.target.value)}
          placeholder="Identificador del usuario"
          required
          style={inputStyle}
        />

        <label>Tipo de delegado</label>
        <select
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          style={inputStyle}
        >
          <option value="principal">
            Delegado principal
          </option>
          <option value="auxiliar">
            Delegado auxiliar
          </option>
        </select>

        <button
          type="submit"
          disabled={guardando}
          style={{
            background: '#0b2948',
            color: 'white',
            padding: '14px 22px',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {guardando ? 'Guardando...' : 'Asignar delegado'}
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

      <hr style={{ margin: '35px 0' }} />

      <h2>Delegados registrados</h2>

      {delegados.length === 0 ? (
        <p>No hay delegados asignados todavía.</p>
      ) : (
        delegados.map(delegado => {
          const equipo = equipos.find(
            e => e.id === delegado.equipo_id
          )

          return (
            <div key={delegado.id} style={{
              border: '1px solid #ddd',
              borderRadius: '10px',
              padding: '18px',
              marginBottom: '15px'
            }}>
              <h3>
                {equipo?.nombre ||
                  `Equipo #${delegado.equipo_id}`}
              </h3>

              <p>Tipo: {delegado.tipo}</p>

              <p style={{
                overflowWrap: 'anywhere'
              }}>
                Usuario: {delegado.usuario_id}
              </p>

              <p>
                Estado: <strong>
                  {delegado.activo ? 'Activo' : 'Inactivo'}
                </strong>
              </p>

              <button
                disabled={guardando}
                onClick={() => cambiarEstado(delegado)}
                style={{
                  padding: '10px 16px',
                  background: delegado.activo
                    ? '#b91c1c'
                    : '#16803c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {delegado.activo
                  ? 'Desactivar delegado'
                  : 'Activar delegado'}
              </button>
            </div>
          )
        })
      )}
    </main>
  )
}
