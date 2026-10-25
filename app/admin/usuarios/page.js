'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

const campo = {
  width: '100%', padding: 12, border: '1px solid #cbd5e1',
  borderRadius: 8, boxSizing: 'border-box', marginTop: 6
}
const boton = {
  padding: '11px 16px', border: 0, borderRadius: 7,
  background: '#0b2948', color: 'white', cursor: 'pointer',
  fontWeight: 'bold'
}
const tarjeta = {
  border: '1px solid #ddd', borderRadius: 10,
  padding: 18, marginBottom: 12, background: '#fff'
}

export default function AdministrarUsuarios() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const [administradores, setAdministradores] = useState([])
  const [equipos, setEquipos] = useState([])
  const [delegados, setDelegados] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [busquedaRealizada, setBusquedaRealizada] = useState(false)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null)
  const [equipoId, setEquipoId] = useState('')
  const [tipo, setTipo] = useState('principal')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  async function cargarDatos() {
    const [resAdmins, resEquipos, resDelegados] = await Promise.all([
      supabase.rpc('listar_administradores_generales'),
      supabase.from('equipos').select('id, nombre, division_id').order('nombre'),
      supabase.rpc('listar_delegados_detallados_admin')
    ])
    if (resAdmins.error) throw resAdmins.error
    if (resEquipos.error) throw resEquipos.error
    if (resDelegados.error) throw resDelegados.error
    if (!Array.isArray(resDelegados.data)) {
      throw new Error('La función de delegados no devolvió una lista válida.')
    }
    setAdministradores(resAdmins.data || [])
    setEquipos(resEquipos.data || [])
    setDelegados(resDelegados.data)
  }

  useEffect(() => {
    let activo = true
    async function iniciar() {
      try {
        const { data, error: errorAuth } = await supabase.auth.getUser()
        if (!activo) return
        if (errorAuth || !data.user) {
          router.replace('/login?tipo=admin')
          return
        }
        const { data: perfil, error: errorPerfil } = await supabase
          .from('perfiles').select('rol').eq('id', data.user.id).maybeSingle()
        if (errorPerfil) throw errorPerfil
        if (!activo) return
        if (perfil?.rol !== 'admin') {
          router.replace('/mis-paneles')
          return
        }
        await cargarDatos()
        if (activo) setAutorizado(true)
      } catch (err) {
        if (activo) setError(err.message || 'No se pudieron cargar los usuarios.')
      } finally {
        if (activo) setCargando(false)
      }
    }
    iniciar()
    return () => { activo = false }
  }, [router])

  async function buscarUsuario(e) {
    e.preventDefault()
    const texto = busqueda.trim()
    setError('')
    setMensaje('')
    setResultados([])
    setUsuarioSeleccionado(null)
    setBusquedaRealizada(false)
    if (texto.length < 3) {
      setError('Escribe al menos 3 caracteres del nombre o correo.')
      return
    }
    setBuscando(true)
    try {
      // Reutiliza el RPC existente. Debe admitir búsqueda por nombre o correo.
      const { data, error: errorBusqueda } = await supabase.rpc('buscar_usuarios_admin', {
        busqueda: texto
      })
      if (errorBusqueda) throw errorBusqueda
      if (!Array.isArray(data)) throw new Error('La búsqueda no devolvió una lista válida.')
      setResultados(data.filter(u => u && u.id).slice(0, 20))
      setBusquedaRealizada(true)
    } catch (err) {
      setError(err.message || 'No se pudo buscar el usuario.')
    } finally {
      setBuscando(false)
    }
  }

  async function cambiarAdmin(usuario, hacerAdmin) {
    if (guardando) return
    const nombre = usuario.nombre || usuario.correo || 'esta persona'
    const pregunta = hacerAdmin
      ? `¿Nombrar Administrador General a ${nombre}? Tendrá acceso a toda la liga y podrá nombrar otros administradores.`
      : `¿Retirar el permiso de Administrador General a ${nombre}?`
    if (!window.confirm(pregunta)) return
    setGuardando(true)
    setError('')
    setMensaje('')
    try {
      const { error: errorCambio } = await supabase.rpc('cambiar_admin_general', {
        p_usuario_id: usuario.id,
        p_hacer_admin: hacerAdmin
      })
      if (errorCambio) throw errorCambio
      await cargarDatos()
      setMensaje('Permisos generales actualizados correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudieron cambiar los permisos generales.')
    } finally {
      setGuardando(false)
    }
  }

  async function asignarDelegado(e) {
    e.preventDefault()
    if (guardando) return
    setError('')
    setMensaje('')
    if (!usuarioSeleccionado?.id || !equipoId) {
      setError('Busca y selecciona un usuario y un equipo.')
      return
    }
    const equipo = equipos.find(e => String(e.id) === String(equipoId))
    const existente = delegados.find(d =>
      String(d.equipo_id) === String(equipoId) &&
      d.usuario_id === usuarioSeleccionado.id
    )
    if (existente?.activo && existente.tipo === tipo) {
      setMensaje('Este usuario ya tiene ese permiso activo en el equipo.')
      return
    }
    const otroPrincipal = tipo === 'principal' && delegados.some(d =>
      String(d.equipo_id) === String(equipoId) &&
      d.tipo === 'principal' && d.activo &&
      d.usuario_id !== usuarioSeleccionado.id
    )
    const advertencia = otroPrincipal
      ? '\nATENCIÓN: ya existe otro delegado principal activo para este equipo.'
      : ''
    if (!window.confirm(
      `¿Asignar a ${usuarioSeleccionado.nombre || usuarioSeleccionado.correo} como ` +
      `${tipo} de ${equipo?.nombre || 'este equipo'}?${advertencia}`
    )) return
    setGuardando(true)
    try {
      // Conserva la clave de conflicto usada por la pantalla antigua.
      const { error: errorGuardar } = await supabase
        .from('delegados_equipo')
        .upsert({
          equipo_id: equipoId,
          usuario_id: usuarioSeleccionado.id,
          tipo,
          activo: true
        }, { onConflict: 'equipo_id,usuario_id' })
      if (errorGuardar) throw errorGuardar
      await cargarDatos()
      setMensaje('Delegado asignado correctamente.')
    } catch (err) {
      setError('No se pudo asignar el delegado: ' + (err.message || 'Error desconocido.'))
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarEstado(delegado) {
    if (guardando) return
    const nombre = delegado.nombre || delegado.correo || 'este delegado'
    const accion = delegado.activo ? 'desactivar' : 'activar'
    if (!window.confirm(`¿Deseas ${accion} a ${nombre} en este equipo?`)) return
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
      setMensaje('Estado del delegado actualizado correctamente.')
    } catch (err) {
      setError('No se pudo cambiar el estado: ' + (err.message || 'Error desconocido.'))
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <main style={{ padding: 30 }}>Verificando acceso y cargando usuarios...</main>
  if (!autorizado) return (
    <main style={{ padding: 30 }}>
      <p role="alert">{error || 'Acceso no autorizado.'}</p>
      <Link href="/admin">Volver a Administración</Link>
    </main>
  )

  return (
    <main style={{ maxWidth: 980, margin: '35px auto', padding: 20 }}>
      <h1>👥 Administrar Usuarios</h1>
      <p>Yuba Sutter Adult Soccer League</p>
      <p><Link href="/admin">← Volver a Administración</Link></p>
      {mensaje && <p role="status" style={{ color: '#166534' }}>{mensaje}</p>}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}

      <hr style={{ margin: '28px 0' }} />
      <h2>1. Buscar usuario registrado</h2>
      <p>Busca por nombre o correo. El usuario debe tener una cuenta YSASL. No necesitas copiar ningún UID.</p>
      <form onSubmit={buscarUsuario} style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <input
          type="text"
          aria-label="Nombre o correo del usuario"
          placeholder="Nombre o correo electrónico"
          value={busqueda}
          onChange={e => {
            setBusqueda(e.target.value)
            setResultados([])
            setBusquedaRealizada(false)
            setUsuarioSeleccionado(null)
          }}
          style={{ ...campo, flex: '1 1 260px', width: 'auto', marginTop: 0 }}
          required
        />
        <button type="submit" disabled={buscando || guardando} style={boton}>
          {buscando ? 'Buscando...' : 'Buscar usuario'}
        </button>
      </form>
      {busquedaRealizada && resultados.length === 0 && (
        <p>No se encontró una cuenta con ese dato. Verifica que esté registrada en YSASL.</p>
      )}
      {resultados.map(usuario => (
        <div key={usuario.id} style={{ ...tarjeta, marginTop: 12 }}>
          <strong>{usuario.nombre || 'Usuario registrado'}</strong>
          <p style={{ overflowWrap: 'anywhere' }}>{usuario.correo || 'Sin correo disponible'}</p>
          <button
            type="button"
            disabled={guardando}
            onClick={() => setUsuarioSeleccionado(usuario)}
            style={{ ...boton, background: usuarioSeleccionado?.id === usuario.id ? '#166534' : '#0b2948' }}
          >
            {usuarioSeleccionado?.id === usuario.id ? '✓ Seleccionado' : 'Seleccionar usuario'}
          </button>
        </div>
      ))}

      {usuarioSeleccionado && (
        <section style={{ ...tarjeta, marginTop: 20, borderColor: '#166534' }}>
          <h3>Usuario seleccionado: {usuarioSeleccionado.nombre || usuarioSeleccionado.correo}</h3>
          <p style={{ overflowWrap: 'anywhere' }}>{usuarioSeleccionado.correo}</p>
          <h4>Permiso general</h4>
          {administradores.some(a => a.id === usuarioSeleccionado.id) || usuarioSeleccionado.rol === 'admin' ? (
            <p>Este usuario ya es Administrador General.</p>
          ) : (
            <button
              type="button" disabled={guardando}
              onClick={() => cambiarAdmin(usuarioSeleccionado, true)}
              style={{ ...boton, background: '#166534' }}
            >
              Nombrar Administrador General
            </button>
          )}

          <hr style={{ margin: '25px 0' }} />
          <h4>Asignar como delegado de equipo</h4>
          <form onSubmit={asignarDelegado}>
            <label htmlFor="equipoDelegado">Equipo</label>
            <select
              id="equipoDelegado" value={equipoId}
              onChange={e => setEquipoId(e.target.value)}
              required style={campo}
            >
              <option value="">Selecciona un equipo</option>
              {equipos.map(equipo => (
                <option key={equipo.id} value={equipo.id}>
                  {equipo.nombre} — División {equipo.division_id}
                </option>
              ))}
            </select>
            <div style={{ height: 14 }} />
            <label htmlFor="tipoDelegado">Tipo de delegado</label>
            <select
              id="tipoDelegado" value={tipo}
              onChange={e => setTipo(e.target.value)} style={campo}
            >
              <option value="principal">Delegado principal</option>
              <option value="auxiliar">Delegado auxiliar</option>
            </select>
            <div style={{ height: 16 }} />
            <button type="submit" disabled={guardando} style={boton}>
              {guardando ? 'Guardando...' : 'Asignar delegado al equipo'}
            </button>
          </form>
        </section>
      )}

      <hr style={{ margin: '30px 0' }} />
      <h2>2. Administradores Generales ({administradores.length})</h2>
      {administradores.length === 0 && <p>No hay administradores registrados.</p>}
      {administradores.map(admin => (
        <div key={admin.id} style={tarjeta}>
          <strong>{admin.nombre || 'Administrador YSASL'}</strong>
          <p style={{ overflowWrap: 'anywhere' }}>{admin.correo}</p>
          <p><strong>Administrador General</strong></p>
          <button
            type="button" disabled={guardando}
            onClick={() => cambiarAdmin(admin, false)}
            style={{ ...boton, background: '#b91c1c', opacity: guardando ? 0.6 : 1 }}
          >
            Retirar permiso general
          </button>
        </div>
      ))}

      <hr style={{ margin: '30px 0' }} />
      <h2>3. Delegados de equipos ({delegados.length})</h2>
      {delegados.length === 0 && <p>No hay delegados asignados todavía.</p>}
      {delegados.map(delegado => {
        const equipo = equipos.find(e => String(e.id) === String(delegado.equipo_id))
        return (
          <div key={delegado.id} style={tarjeta}>
            <h3 style={{ marginTop: 0 }}>{equipo?.nombre || 'Equipo no encontrado'}</h3>
            <p><strong>{delegado.nombre || 'Usuario registrado'}</strong></p>
            <p style={{ overflowWrap: 'anywhere' }}>{delegado.correo || 'Correo no disponible'}</p>
            <p>Tipo: {delegado.tipo === 'principal' ? 'Principal' : 'Auxiliar'}</p>
            <p>Estado: <strong>{delegado.activo ? 'Activo' : 'Inactivo'}</strong></p>
            <button
              type="button" disabled={guardando}
              onClick={() => cambiarEstado(delegado)}
              style={{ ...boton, background: delegado.activo ? '#b91c1c' : '#16803c' }}
            >
              {delegado.activo ? 'Desactivar delegado' : 'Activar delegado'}
            </button>
          </div>
        )
      })}
      <p style={{ color: '#64748b', fontSize: 14, marginTop: 25 }}>
        Los permisos deben estar protegidos también por las políticas de seguridad de Supabase (RLS).
      </p>
    </main>
  )
}
