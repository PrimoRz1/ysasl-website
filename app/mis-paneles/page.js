'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function MisPanelesPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [esAdmin, setEsAdmin] = useState(false)
  const [equipos, setEquipos] = useState([])

  // Nuevo: solicitudes para administrar equipos existentes.
  const [usuarioId, setUsuarioId] = useState(null)
  const [equiposDisponibles, setEquiposDisponibles] = useState([])
  const [solicitudes, setSolicitudes] = useState([])
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(true)
  const [equipoSolicitado, setEquipoSolicitado] = useState('')
  const [mensajeSolicitud, setMensajeSolicitud] = useState('')
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false)
  const [errorSolicitud, setErrorSolicitud] = useState('')
  const [exitoSolicitud, setExitoSolicitud] = useState('')

  useEffect(() => {
    let activo = true

    async function cargarSolicitudes() {
      try {
        // Solo se ofrecen equipos que no estén marcados como inactivos.
        // Se muestran el ID y la división para distinguir nombres repetidos.
        const [resEquiposDisponibles, resSolicitudes] = await Promise.all([
          supabase.from('equipos')
            .select('id, nombre, division_id, activo')
            .or('activo.is.null,activo.eq.true')
            .order('nombre'),
          supabase.from('solicitudes_administracion_equipo')
            .select('id, equipo_id, estado, creado_en')
            .order('creado_en', { ascending: false })
            .limit(50)
        ])

        if (!activo) return
        if (resEquiposDisponibles.error) throw resEquiposDisponibles.error
        if (resSolicitudes.error) throw resSolicitudes.error
        setEquiposDisponibles(resEquiposDisponibles.data || [])
        setSolicitudes(resSolicitudes.data || [])
      } catch (err) {
        if (activo) {
          setErrorSolicitud('No se pudo cargar la sección de solicitudes: ' +
            (err.message || 'Error desconocido.'))
        }
      } finally {
        if (activo) setCargandoSolicitudes(false)
      }
    }

    async function verificarAccesos() {
      try {
        const { data: auth, error: errorAuth } = await supabase.auth.getUser()
        if (!activo) return
        if (errorAuth) throw errorAuth
        if (!auth.user) {
          router.replace('/login')
          return
        }

        const [resPerfil, resEquipos] = await Promise.all([
          supabase.from('perfiles')
            .select('rol')
            .eq('id', auth.user.id)
            .maybeSingle(),
          supabase.from('delegados_equipo')
            .select('equipo_id, equipos(nombre)')
            .eq('usuario_id', auth.user.id)
            .eq('activo', true)
        ])
        if (!activo) return
        if (resPerfil.error) throw resPerfil.error
        if (resEquipos.error) throw resEquipos.error

        setEsAdmin(resPerfil.data?.rol === 'admin')
        setEquipos(resEquipos.data || [])
        setUsuarioId(auth.user.id)

        // Una falla en las solicitudes NO debe bloquear los paneles existentes.
        cargarSolicitudes()
      } catch (err) {
        if (activo) setError('No se pudieron verificar tus permisos: ' +
          (err.message || 'Error desconocido.'))
      } finally {
        if (activo) setCargando(false)
      }
    }

    verificarAccesos()
    return () => { activo = false }
  }, [router])

  async function enviarSolicitud(e) {
    e.preventDefault()
    if (enviandoSolicitud) return
    setErrorSolicitud('')
    setExitoSolicitud('')

    if (!usuarioId || !equipoSolicitado) {
      setErrorSolicitud('Selecciona un equipo para enviar tu solicitud.')
      return
    }

    const idEquipo = Number(equipoSolicitado)
    const equipo = equiposDisponibles.find(e => Number(e.id) === idEquipo)
    if (!equipo) {
      setErrorSolicitud('El equipo seleccionado no está disponible.')
      return
    }

    if (equipos.some(e => Number(e.equipo_id) === idEquipo)) {
      setErrorSolicitud('Ya tienes permiso activo para administrar ese equipo.')
      return
    }

    if (solicitudes.some(s => Number(s.equipo_id) === idEquipo && s.estado === 'pendiente')) {
      setErrorSolicitud('Ya tienes una solicitud pendiente para ese equipo.')
      return
    }

    if (!window.confirm(
      `¿Enviar una solicitud para administrar ${equipo.nombre} ` +
      `(equipo ID ${equipo.id})? Un Administrador General deberá aprobarla.`
    )) return

    setEnviandoSolicitud(true)
    try {
      const { error: errorEnvio } = await supabase
        .from('solicitudes_administracion_equipo')
        .insert({
          equipo_id: idEquipo,
          usuario_id: usuarioId,
          estado: 'pendiente',
          mensaje: mensajeSolicitud.trim() || null
        })

      if (errorEnvio) throw errorEnvio

      setExitoSolicitud('Solicitud enviada. Un Administrador General deberá revisarla.')
      setEquipoSolicitado('')
      setMensajeSolicitud('')

      // Actualizar el historial; el envío ya fue exitoso aunque falle la recarga.
      const { data, error: errorRecarga } = await supabase
        .from('solicitudes_administracion_equipo')
        .select('id, equipo_id, estado, creado_en')
        .order('creado_en', { ascending: false })
        .limit(50)

      if (errorRecarga) {
        setErrorSolicitud('La solicitud se envió, pero no se pudo actualizar la lista. Recarga la página.')
      } else {
        setSolicitudes(data || [])
      }
    } catch (err) {
      if (err.code === '23505') {
        setErrorSolicitud('Ya existe una solicitud pendiente para este equipo.')
      } else {
        setErrorSolicitud('No se pudo enviar la solicitud: ' +
          (err.message || 'Error desconocido.'))
      }
    } finally {
      setEnviandoSolicitud(false)
    }
  }

  const boton = {
    width: '100%', padding: '16px', textAlign: 'left',
    borderRadius: '10px', border: '1px solid #cbd5e1',
    background: 'white', cursor: 'pointer', marginBottom: '12px',
    fontSize: '16px', color: '#0b2948', fontWeight: 'bold'
  }

  const campo = {
    width: '100%', padding: '12px', borderRadius: '8px',
    border: '1px solid #cbd5e1', boxSizing: 'border-box',
    fontSize: '15px', marginTop: '6px'
  }

  if (cargando) return <main style={{ padding: 30 }}>Verificando tus accesos...</main>

  return (
    <main style={{ maxWidth: '600px', margin: '55px auto', padding: '24px' }}>
      <h1>Seleccionar mi panel</h1>
      <p>Yuba Sutter Adult Soccer League</p>
      <p>Utiliza una sola cuenta para acceder a los paneles que tienes autorizados.</p>
      {error ? (
        <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>
      ) : (
        <>
          {esAdmin && (
            <button type="button" style={boton} onClick={() => router.push('/admin')}>
              🛡️ Administración General
            </button>
          )}
          {equipos.length > 0 && (
            <button type="button" style={boton} onClick={() => router.push('/delegado')}>
              👥 Administrador de Equipo
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'normal', marginTop: '5px' }}>
                {equipos.map(e => e.equipos?.nombre || `Equipo #${e.equipo_id}`).join(', ')}
              </span>
            </button>
          )}
          <button type="button" style={boton} onClick={() => router.push('/jugador')}>
            ⚽ Mi Panel de Jugador
          </button>
          <p style={{ fontSize: '13px', color: '#475569' }}>
            El panel de jugador no te incorpora automáticamente a una plantilla.
            Los permisos de administrador y las asignaciones de equipo se gestionan por separado.
          </p>

          <hr style={{ margin: '30px 0' }} />
          <h2>Solicitar administrar un equipo</h2>
          <p>
            Si tu equipo ya está registrado en YSASL, puedes solicitar acceso para administrarlo.
            Un Administrador General revisará tu solicitud y decidirá si te asigna como
            Administrador Principal o Auxiliar.
          </p>

          {errorSolicitud && <p role="alert" style={{ color: '#b91c1c' }}>{errorSolicitud}</p>}
          {exitoSolicitud && <p role="status" style={{ color: '#166534' }}>{exitoSolicitud}</p>}

          {cargandoSolicitudes ? (
            <p>Cargando equipos y solicitudes...</p>
          ) : (
            <>
              <form onSubmit={enviarSolicitud}>
                <label htmlFor="equipoSolicitud">Selecciona tu equipo</label>
                <select
                  id="equipoSolicitud"
                  style={campo}
                  value={equipoSolicitado}
                  onChange={e => setEquipoSolicitado(e.target.value)}
                  disabled={enviandoSolicitud || equiposDisponibles.length === 0}
                  required
                >
                  <option value="">Selecciona un equipo</option>
                  {equiposDisponibles.map(equipo => {
                    const yaAdministra = equipos.some(e => Number(e.equipo_id) === Number(equipo.id))
                    const pendiente = solicitudes.some(s =>
                      Number(s.equipo_id) === Number(equipo.id) && s.estado === 'pendiente'
                    )
                    return (
                      <option
                        key={equipo.id}
                        value={equipo.id}
                        disabled={yaAdministra || pendiente}
                      >
                        {equipo.nombre} — División ID {equipo.division_id ?? 'sin asignar'}
                        {' — Equipo ID '}{equipo.id}
                        {yaAdministra ? ' (ya lo administras)' : pendiente ? ' (solicitud pendiente)' : ''}
                      </option>
                    )
                  })}
                </select>
                {equiposDisponibles.length === 0 && (
                  <p style={{ fontSize: '14px', color: '#475569' }}>
                    No hay equipos disponibles para solicitar por el momento.
                  </p>
                )}
                <p style={{ fontSize: '13px', color: '#475569' }}>
                  Revisa el nombre, la división y el ID antes de enviar. Algunos equipos
                  pueden tener nombres iguales en diferentes registros.
                </p>

                <label htmlFor="mensajeSolicitud">Mensaje para el Administrador General (opcional)</label>
                <textarea
                  id="mensajeSolicitud"
                  style={{ ...campo, minHeight: '85px', resize: 'vertical' }}
                  value={mensajeSolicitud}
                  onChange={e => setMensajeSolicitud(e.target.value)}
                  maxLength={500}
                  placeholder="Ejemplo: Soy el entrenador de este equipo."
                  disabled={enviandoSolicitud}
                />
                <button
                  type="submit"
                  style={{ ...boton, background: '#0b2948', color: 'white', textAlign: 'center', marginTop: 14 }}
                  disabled={enviandoSolicitud || !equipoSolicitado}
                >
                  {enviandoSolicitud ? 'Enviando solicitud...' : 'Enviar solicitud de administración'}
                </button>
              </form>

              <h3 style={{ marginTop: 28 }}>Mis solicitudes</h3>
              {solicitudes.length === 0 ? (
                <p>Todavía no has enviado solicitudes.</p>
              ) : (
                solicitudes.map(solicitud => {
                  const equipo = equiposDisponibles.find(e => Number(e.id) === Number(solicitud.equipo_id))
                  const estado = {
                    pendiente: 'Pendiente de revisión',
                    aprobada: 'Aprobada',
                    rechazada: 'Rechazada',
                    cancelada: 'Cancelada'
                  }[solicitud.estado] || solicitud.estado
                  return (
                    <div
                      key={solicitud.id}
                      style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, marginBottom: 10 }}
                    >
                      <strong>{equipo?.nombre || `Equipo ID ${solicitud.equipo_id}`}</strong>
                      <p style={{ margin: '6px 0' }}>Equipo ID: {solicitud.equipo_id}</p>
                      <p style={{ margin: '6px 0' }}>Estado: <strong>{estado}</strong></p>
                    </div>
                  )
                })
              )}
            </>
          )}
        </>
      )}
    </main>
  )
}
