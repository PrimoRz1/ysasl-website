
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

export default function AdministrarUsuarios() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [usuarios, setUsuarios] = useState([])
  const [equipos, setEquipos] = useState([])
  const [delegados, setDelegados] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('')
  const [equipoId, setEquipoId] = useState('')
  const [tipo, setTipo] = useState('principal')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  async function cargarDatos() {
    const [resUsuarios, resEquipos, resDelegados] =
      await Promise.all([
        supabase.rpc('buscar_usuarios_admin', {
          busqueda: ''
        }),
        supabase.from('equipos')
          .select('id, nombre')
          .order('nombre'),
        supabase.from('delegados_equipo')
          .select('id, equipo_id, usuario_id, tipo, activo')
          .order('id', { ascending: false })
      ])

    if (resUsuarios.error) throw resUsuarios.error
    if (resEquipos.error) throw resEquipos.error
    if (resDelegados.error) throw resDelegados.error

    setUsuarios(resUsuarios.data || [])
    setEquipos(resEquipos.data || [])
    setDelegados(resDelegados.data || [])
  }

  useEffect(() => {
    let activo = true

    async function iniciar() {
      try {
        const { data, error: errorAuth } =
          await supabase.auth.getUser()

        if (!activo) return

        if (errorAuth || !data.user) {
          router.replace('/login?tipo=admin')
          return
        }

        const { data: perfil, error: errorPerfil } =
          await supabase.from('perfiles')
            .select('rol')
            .eq('id', data.user.id)
            .maybeSingle()

        if (errorPerfil) throw errorPerfil
        if (!activo) return

        if (perfil?.rol !== 'admin') {
          router.replace('/mis-paneles')
          return
        }

        await cargarDatos()
      } catch (err) {
        if (activo) {
          setError(err.message || 'Error al cargar usuarios.')
        }
      } finally {
        if (activo) setCargando(false)
      }
    }

    iniciar()
    return () => { activo = false }
  }, [router])

  async function ejecutar(accion, exito) {
    if (guardando) return
    setGuardando(true)
    setError('')
    setMensaje('')

    try {
      await accion()
      await cargarDatos()
      setMensaje(exito)
    } catch (err) {
      setError(err.message || 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarAdmin(usuario) {
    const hacerAdmin = usuario.rol !== 'admin'

    const texto = hacerAdmin
      ? `¿Nombrar Administrador General a ${usuario.nombre || usuario.correo}? Tendrá acceso a toda la liga y podrá nombrar otros administradores.`
      : `¿Retirar los permisos de Administrador General a ${usuario.nombre || usuario.correo}?`

    if (!window.confirm(texto)) return

    await ejecutar(async () => {
      const { error } = await supabase.rpc(
        'cambiar_admin_general',
        {
          p_usuario_id: usuario.id,
          p_hacer_admin: hacerAdmin
        }
      )
      if (error) throw error
    }, 'Permisos generales actualizados.')
  }

  async function asignarEquipo(e) {
    e.preventDefault()

    if (!usuarioSeleccionado || !equipoId) {
      setError('Selecciona usuario y equipo.')
      return
    }

    await ejecutar(async () => {
      const { error } = await supabase
        .from('delegados_equipo')
        .upsert({
          usuario_id: usuarioSeleccionado,
          equipo_id: Number(equipoId),
          tipo,
          activo: true
        }, {
          onConflict: 'equipo_id,usuario_id'
        })

      if (error) throw error
      setUsuarioSeleccionado('')
      setEquipoId('')
      setTipo('principal')
    }, 'Administrador de equipo asignado correctamente.')
  }

  async function cambiarDelegado(delegado) {
    const accion = delegado.activo ? 'desactivar' : 'activar'
    if (!window.confirm(`¿Quieres ${accion} esta asignación?`)) {
      return
    }

    await ejecutar(async () => {
      const { error } = await supabase
        .from('delegados_equipo')
        .update({ activo: !delegado.activo })
        .eq('id', delegado.id)

      if (error) throw error
    }, 'Asignación actualizada.')
  }

  const usuariosFiltrados = usuarios.filter(u =>
    `${u.nombre || ''} ${u.correo || ''}`
      .toLowerCase()
      .includes(busqueda.toLowerCase().trim())
  )

  const estiloCampo = {
    padding: 12,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    width: '100%',
    boxSizing: 'border-box',
    marginTop: 6
  }

  const estiloBoton = {
    padding: '10px 15px',
    border: 0,
    borderRadius: 7,
    background: '#0b2948',
    color: 'white',
    cursor: 'pointer'
  }

  if (cargando) {
    return <main style={{ padding: 30 }}>
      Verificando acceso y cargando usuarios...
    </main>
  }

  if (error && usuarios.length === 0) {
    return (
      <main style={{ padding: 30 }}>
        <p role="alert">{error}</p>
        <Link href="/admin">Volver a Administración</Link>
      </main>
    )
  }

  return (
    <main style={{
      maxWidth: 1000,
      margin: '35px auto',
      padding: 20
    }}>
      <h1>Administrar Usuarios</h1>
      <p>Yuba Sutter Adult Soccer League</p>

      <p>
        <Link href="/admin">← Volver a Administración</Link>
        {' | '}
        <Link href="/mis-paneles">Mis Paneles</Link>
      </p>

      {mensaje && (
        <p role="status" style={{ color: 'green' }}>
          {mensaje}
        </p>
      )}

      {error && (
        <p role="alert" style={{ color: '#b91c1c' }}>
          {error}
        </p>
      )}

      <hr style={{ margin: '25px 0' }} />

      <h2>Usuarios registrados</h2>
      <p>
        Busca por nombre o correo. Los identificadores
        de Supabase se utilizan automáticamente.
      </p>

      <input
        aria-label="Buscar usuarios"
        placeholder="Buscar por nombre o correo..."
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        style={estiloCampo}
      />

      <p>{usuariosFiltrados.length} usuario(s)</p>

      {usuariosFiltrados.map(usuario => (
        <div key={usuario.id} style={{
          border: '1px solid #ddd',
          borderRadius: 10,
          padding: 18,
          marginBottom: 12
        }}>
          <strong>
            {usuario.nombre || 'Usuario registrado'}
          </strong>

          <p style={{ overflowWrap: 'anywhere' }}>
            {usuario.correo}
          </p>

          <p>
            Permiso general: <strong>
              {usuario.rol === 'admin'
                ? 'Administrador General'
                : 'Sin permiso de Administrador General'}
            </strong>
          </p>

          <button
            type="button"
            disabled={guardando}
            onClick={() => cambiarAdmin(usuario)}
            style={{
              ...estiloBoton,
              background: usuario.rol === 'admin'
                ? '#b91c1c' : '#166534'
            }}
          >
            {usuario.rol === 'admin'
              ? 'Retirar permiso general'
              : 'Nombrar Administrador General'}
          </button>
        </div>
      ))}

      <hr style={{ margin: '30px 0' }} />

      <h2>Asignar Administrador de Equipo</h2>

      <form onSubmit={asignarEquipo}>
        <label htmlFor="usuario-equipo">
          Usuario registrado
        </label>
        <select
          id="usuario-equipo"
          value={usuarioSeleccionado}
          onChange={e => setUsuarioSeleccionado(e.target.value)}
          style={estiloCampo}
          required
        >
          <option value="">Selecciona usuario</option>
          {usuarios.map(u => (
            <option key={u.id} value={u.id}>
              {u.nombre || u.correo} ({u.correo})
            </option>
          ))}
        </select>

        <div style={{ height: 15 }} />

        <label htmlFor="equipo-asignado">Equipo</label>
        <select
          id="equipo-asignado"
          value={equipoId}
          onChange={e => setEquipoId(e.target.value)}
          style={estiloCampo}
          required
        >
          <option value="">Selecciona equipo</option>
          {equipos.map(e => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>

        <div style={{ height: 15 }} />

        <label htmlFor="tipo-delegado">Tipo</label>
        <select
          id="tipo-delegado"
          value={tipo}
          onChange={e => setTipo(e.target.value)}
          style={estiloCampo}
        >
          <option value="principal">
            Administrador principal
          </option>
          <option value="auxiliar">
            Administrador auxiliar
          </option>
        </select>

        <div style={{ marginTop: 20 }}>
          <button
            type="submit"
            disabled={guardando}
            style={estiloBoton}
          >
            {guardando ? 'Guardando...' : 'Asignar equipo'}
          </button>
        </div>
      </form>

      <hr style={{ margin: '30px 0' }} />

      <h2>Administradores de Equipo Registrados</h2>

      {delegados.length === 0 && (
        <p>No hay asignaciones todavía.</p>
      )}

      {delegados.map(d => {
        const equipo = equipos.find(e => e.id === d.equipo_id)
        const usuario = usuarios.find(u => u.id === d.usuario_id)

        return (
          <div key={d.id} style={{
            border: '1px solid #ddd',
            borderRadius: 10,
            padding: 18,
            marginBottom: 12
          }}>
            <h3>{equipo?.nombre || 'Equipo'}</h3>
            <p>
              Usuario: {usuario?.nombre ||
                usuario?.correo ||
                'Cuenta registrada'}
            </p>
            <p>Tipo: {d.tipo}</p>
            <p>
              Estado: <strong>
                {d.activo ? 'Activo' : 'Inactivo'}
              </strong>
            </p>
            <button
              type="button"
              disabled={guardando}
              onClick={() => cambiarDelegado(d)}
              style={{
                ...estiloBoton,
                background: d.activo ? '#b91c1c' : '#166534'
              }}
            >
              {d.activo ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        )
      })}
    </main>
  )
}
