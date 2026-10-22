'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'

export default function AdministrarUsuarios() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [administradores, setAdministradores] = useState([])
  const [correoBusqueda, setCorreoBusqueda] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [busquedaRealizada, setBusquedaRealizada] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  async function cargarAdministradores() {
    const { data, error: errorLista } = await supabase.rpc('listar_administradores_generales')
    if (errorLista) throw errorLista
    setAdministradores(data || [])
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
          .from('perfiles')
          .select('rol')
          .eq('id', data.user.id)
          .maybeSingle()

        if (errorPerfil) throw errorPerfil
        if (!activo) return
        if (perfil?.rol !== 'admin') {
          router.replace('/mis-paneles')
          return
        }

        await cargarAdministradores()
      } catch (err) {
        if (activo) setError(err.message || 'No se pudieron cargar los administradores.')
      } finally {
        if (activo) setCargando(false)
      }
    }

    iniciar()
    return () => { activo = false }
  }, [router])

  async function buscarUsuario(e) {
    e.preventDefault()
    const correo = correoBusqueda.trim().toLowerCase()
    setError('')
    setMensaje('')
    setResultados([])
    setBusquedaRealizada(false)

    if (!correo || !correo.includes('@')) {
      setError('Escribe el correo electrónico de un usuario registrado.')
      return
    }

    setBuscando(true)
    try {
      // Reutilizamos la función existente; no consultamos usuarios al abrir la página.
      const { data, error: errorBusqueda } = await supabase.rpc('buscar_usuarios_admin', {
        busqueda: correo
      })
      if (errorBusqueda) throw errorBusqueda
      // Mostrar únicamente la coincidencia exacta, aunque el RPC busque parcialmente.
      setResultados((data || []).filter(u =>
        (u.correo || '').trim().toLowerCase() === correo
      ))
      setBusquedaRealizada(true)
    } catch (err) {
      setError(err.message || 'No se pudo buscar el usuario.')
    } finally {
      setBuscando(false)
    }
  }

  async function cambiarAdmin(usuario, hacerAdmin) {
    const identificacion = usuario.nombre || usuario.correo
    const texto = hacerAdmin
      ? `¿Nombrar Administrador General a ${identificacion}? Tendrá acceso a toda la liga y podrá nombrar otros administradores.`
      : `¿Retirar los permisos de Administrador General a ${identificacion}?`

    if (!window.confirm(texto) || guardando) return
    setGuardando(true)
    setError('')
    setMensaje('')

    try {
      const { error: errorCambio } = await supabase.rpc('cambiar_admin_general', {
        p_usuario_id: usuario.id,
        p_hacer_admin: hacerAdmin
      })
      if (errorCambio) throw errorCambio
      await cargarAdministradores()
      setResultados([])
      setBusquedaRealizada(false)
      setCorreoBusqueda('')
      setMensaje('Permisos generales actualizados correctamente.')
    } catch (err) {
      setError(err.message || 'No se pudieron actualizar los permisos.')
    } finally {
      setGuardando(false)
    }
  }

  const campo = {
    padding: 12,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    width: '100%',
    boxSizing: 'border-box'
  }

  const boton = {
    padding: '11px 16px',
    border: 0,
    borderRadius: 7,
    background: '#0b2948',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold'
  }

  if (cargando) return <main style={{ padding: 30 }}>Verificando acceso y cargando administradores...</main>

  return (
    <main style={{ maxWidth: 900, margin: '35px auto', padding: 20 }}>
      <h1>🔐 Administradores Generales</h1>
      <p>Yuba Sutter Adult Soccer League</p>
      <p><Link href="/admin">← Volver a Administración</Link></p>

      {mensaje && <p role="status" style={{ color: '#166534' }}>{mensaje}</p>}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}

      <hr style={{ margin: '25px 0' }} />
      <h2>Administradores registrados ({administradores.length})</h2>

      {administradores.length === 0 && <p>No se encontraron administradores. Si esto no es correcto, revisa el mensaje de error anterior.</p>}
      {administradores.map(admin => (
        <div key={admin.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 18, marginBottom: 12 }}>
          <strong>{admin.nombre || 'Administrador YSASL'}</strong>
          <p style={{ overflowWrap: 'anywhere' }}>{admin.correo}</p>
          <p><strong>Administrador General</strong></p>
          <button
            type="button"
            disabled={guardando}
            onClick={() => cambiarAdmin(admin, false)}
            style={{ ...boton, background: '#b91c1c', opacity: guardando ? 0.6 : 1 }}
          >
            Retirar permiso general
          </button>
        </div>
      ))}

      <hr style={{ margin: '30px 0' }} />
      <h2>Nombrar otro Administrador General</h2>
      <p>Busca a una persona que ya tenga una cuenta registrada en YSASL. No se mostrará una lista de jugadores.</p>
      <form onSubmit={buscarUsuario} style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <input
          type="email"
          aria-label="Correo electrónico del usuario"
          placeholder="Correo electrónico exacto"
          value={correoBusqueda}
          onChange={e => { setCorreoBusqueda(e.target.value); setBusquedaRealizada(false); setResultados([]) }}
          style={{ ...campo, flex: '1 1 250px', width: 'auto' }}
          required
        />
        <button type="submit" disabled={buscando || guardando} style={boton}>
          {buscando ? 'Buscando...' : 'Buscar usuario'}
        </button>
      </form>

      {busquedaRealizada && resultados.length === 0 && (
        <p>No se encontró una cuenta con ese correo. Primero deberá registrarse en YSASL.</p>
      )}

      {resultados.map(usuario => {
        const yaEsAdmin = administradores.some(a => a.id === usuario.id) || usuario.rol === 'admin'
        return (
          <div key={usuario.id} style={{ border: '1px solid #ddd', borderRadius: 10, padding: 18, marginTop: 15 }}>
            <strong>{usuario.nombre || 'Usuario registrado'}</strong>
            <p>{usuario.correo}</p>
            {yaEsAdmin ? (
              <p>Esta persona ya es Administrador General.</p>
            ) : (
              <button
                type="button"
                disabled={guardando}
                onClick={() => cambiarAdmin(usuario, true)}
                style={{ ...boton, background: '#166534' }}
              >
                Nombrar Administrador General
              </button>
            )}
          </div>
        )
      })}

      <p style={{ marginTop: 30, color: '#64748b', fontSize: 14 }}>
        Para asignar administradores a equipos, utiliza la sección «Administrar Delegados».
        Las invitaciones por correo para personas sin cuenta se agregarán por separado.
      </p>
    </main>
  )
}
