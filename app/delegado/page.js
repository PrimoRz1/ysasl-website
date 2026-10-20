
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function DelegadoPage() {
  const router = useRouter()

  const [equipos, setEquipos] = useState([])
  const [equipoId, setEquipoId] = useState('')
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cargandoSolicitudes, setCargandoSolicitudes] =
    useState(false)
  const [procesando, setProcesando] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let activo = true

    async function verificarDelegado() {
      try {
        const { data, error: errorAuth } =
          await supabase.auth.getUser()

        if (errorAuth || !data.user) {
          router.replace('/login')
          return
        }

        const { data: permisos, error: errorPermisos } =
          await supabase
            .from('delegados_equipo')
            .select('equipo_id, tipo, equipos(nombre)')
            .eq('usuario_id', data.user.id)
            .eq('activo', true)

        if (errorPermisos) throw errorPermisos
        if (!activo) return

        const lista = permisos || []
        setEquipos(lista)

        if (lista.length > 0) {
          setEquipoId(String(lista[0].equipo_id))
        }
      } catch (err) {
        if (activo) {
          setError(err.message || 'Error verificando permisos.')
        }
      } finally {
        if (activo) setCargando(false)
      }
    }

    verificarDelegado()

    return () => {
      activo = false
    }
  }, [router])

  useEffect(() => {
    if (!equipoId) return

    let activo = true

    async function cargarSolicitudes() {
      setCargandoSolicitudes(true)
      setError('')
      setMensaje('')

      const { data, error: errorConsulta } =
        await supabase
          .from('solicitudes_jugadores')
          .select('id, nombre, numero, estado, created_at')
          .eq('equipo_id', Number(equipoId))
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: true })

      if (!activo) return

      if (errorConsulta) {
        setError(errorConsulta.message)
      } else {
        setSolicitudes(data || [])
      }

      setCargandoSolicitudes(false)
    }

    cargarSolicitudes()

    return () => {
      activo = false
    }
  }, [equipoId])

  async function resolverSolicitud(id, aprobar) {
    if (procesando !== null) return

    setProcesando(id)
    setMensaje('')
    setError('')

    try {
      const { error: errorRPC } = await supabase.rpc(
        'resolver_solicitud_jugador',
        {
          p_solicitud_id: id,
          p_aprobar: aprobar
        }
      )

      if (errorRPC) throw errorRPC

      setSolicitudes(actuales =>
        actuales.filter(s => s.id !== id)
      )

      setMensaje(
        aprobar
          ? 'Jugador aprobado e incorporado al equipo.'
          : 'Solicitud rechazada correctamente.'
      )
    } catch (err) {
      setError(
        'No se pudo procesar la solicitud: ' + err.message
      )
    } finally {
      setProcesando(null)
    }
  }

  async function cerrarSesion() {
    const { error: errorSalida } =
      await supabase.auth.signOut()

    if (errorSalida) {
      setError(errorSalida.message)
      return
    }

    router.replace('/login')
    router.refresh()
  }

  if (cargando) {
    return (
      <main style={{ padding: 30 }}>
        Verificando acceso...
      </main>
    )
  }

  return (
    <main style={{
      maxWidth: '850px',
      margin: '40px auto',
      padding: '20px'
    }}>
      <h1>Panel de Delegados</h1>
      <p>Yuba Sutter Adult Soccer League</p>

      <button onClick={cerrarSesion}>
        Cerrar sesión
      </button>

      <hr style={{ margin: '30px 0' }} />

      <h2>Mis equipos</h2>

      {equipos.length === 0 ? (
        <p>
          No tienes equipos asignados actualmente.
          Contacta al administrador de YSASL.
        </p>
      ) : (
        <>
          <label htmlFor="equipo-delegado">
            Seleccionar equipo
          </label>

          <select
            id="equipo-delegado"
            value={equipoId}
            onChange={e => setEquipoId(e.target.value)}
            disabled={procesando !== null}
            style={{
              display: 'block',
              width: '100%',
              padding: '12px',
              marginTop: '10px',
              marginBottom: '30px'
            }}
          >
            {equipos.map(equipo => (
              <option
                key={equipo.equipo_id}
                value={equipo.equipo_id}
              >
                {equipo.equipos?.nombre ||
                  `Equipo #${equipo.equipo_id}`}
              </option>
            ))}
          </select>

          <h2>Solicitudes pendientes</h2>

          {cargandoSolicitudes ? (
            <p>Cargando solicitudes...</p>
          ) : solicitudes.length === 0 ? (
            <p>No hay solicitudes pendientes.</p>
          ) : (
            solicitudes.map(solicitud => (
              <div
                key={solicitud.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '10px',
                  padding: '20px',
                  marginBottom: '15px'
                }}
              >
                <h3>{solicitud.nombre}</h3>

                <p>
                  Número de camiseta:{' '}
                  {solicitud.numero ?? 'Sin número'}
                </p>

                <p>
                  Estado: {solicitud.estado}
                </p>

                <div style={{
                  display: 'flex',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}>
                  <button
                    disabled={procesando !== null}
                    onClick={() =>
                      resolverSolicitud(solicitud.id, true)
                    }
                    style={{
                      padding: '12px 20px',
                      background: '#16803c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px'
                    }}
                  >
                    Aprobar
                  </button>

                  <button
                    disabled={procesando !== null}
                    onClick={() =>
                      resolverSolicitud(solicitud.id, false)
                    }
                    style={{
                      padding: '12px 20px',
                      background: '#b91c1c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px'
                    }}
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </>
      )}

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
    </main>
  )
}
