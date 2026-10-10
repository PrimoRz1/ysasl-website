'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const POR_PAGINA = 20

export default function AdminInscripciones() {
  const router = useRouter()

  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [procesando, setProcesando] = useState(null)
  const [mensaje, setMensaje] = useState('')
  const [filtro, setFiltro] = useState('pendiente')
  const [pagina, setPagina] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    async function iniciar() {
      const { data: { user }, error: authError } =
        await supabase.auth.getUser()

      if (authError || !user) {
        router.replace('/login')
        return
      }

      const { data: perfil, error: perfilError } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', user.id)
        .single()

      if (perfilError || perfil?.rol !== 'admin') {
        router.replace('/admin')
        return
      }

      setAutorizado(true)
    }

    iniciar()
  }, [router])

  const cargarSolicitudes = useCallback(async () => {
    setCargando(true)

    let consulta = supabase
      .from('solicitudes_inscripcion')
      .select(
        'id, nombre_equipo, representante, telefono, correo, estado, created_at, temporada_id, division_id, archivada, temporadas(nombre), divisiones(nombre)',
        { count: 'exact' }
      )

    if (filtro === 'archivadas') {
      consulta = consulta.eq('archivada', true)
    } else {
      consulta = consulta.eq('archivada', false)

      if (filtro !== 'todas') {
        consulta = consulta.eq('estado', filtro)
      }
    }

    const desde = pagina * POR_PAGINA
    const hasta = desde + POR_PAGINA - 1

    const { data, error, count } = await consulta
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(desde, hasta)

    if (error) {
      setMensaje('Error al cargar solicitudes: ' + error.message)
      setSolicitudes([])
      setTotal(0)
    } else {
      setSolicitudes(data || [])
      setTotal(count || 0)
    }

    setCargando(false)
  }, [filtro, pagina])

  useEffect(() => {
    if (autorizado) {
      cargarSolicitudes()
    }
  }, [autorizado, cargarSolicitudes])

  async function refrescarDespuesDeCambio() {
    if (pagina > 0 && solicitudes.length === 1) {
      setPagina(pagina - 1)
    } else {
      await cargarSolicitudes()
    }
  }

  async function cambiarEstado(id, estado) {
    const solicitud = solicitudes.find(s => s.id === id)

    if (!solicitud || solicitud.estado !== 'pendiente') {
      setMensaje('Esta solicitud ya no está pendiente.')
      return
    }

    const accion = estado === 'aprobada' ? 'aprobar' : 'rechazar'

    if (!window.confirm(
      `¿Confirmas que deseas ${accion} esta solicitud?`
    )) return

    setProcesando(id)
    setMensaje('')

    try {
      if (estado === 'aprobada') {
        if (!solicitud.division_id || !solicitud.temporada_id) {
          setMensaje('La solicitud no tiene un torneo o división válidos.')
          return
        }

        const nombre = (solicitud.nombre_equipo || '').trim()

        if (!nombre) {
          setMensaje('El nombre del equipo está vacío.')
          return
        }

        const { data: existente, error: errorBusqueda } = await supabase
          .from('equipos')
          .select('id')
          .eq('division_id', solicitud.division_id)
          .eq('nombre', nombre)
          .maybeSingle()

        if (errorBusqueda) {
          setMensaje('Error al verificar el equipo: ' + errorBusqueda.message)
          return
        }

        let equipoId = existente?.id || null

        if (!equipoId) {
          const { data: nuevoEquipo, error: errorEquipo } = await supabase
            .from('equipos')
            .insert({
              nombre,
              division_id: solicitud.division_id,
              telefono: solicitud.telefono,
              activo: true
            })
            .select('id')
            .single()

          if (errorEquipo) {
            setMensaje('No se pudo registrar el equipo: ' + errorEquipo.message)
            return
          }

          equipoId = nuevoEquipo.id
        }

        const { error: errorInscripcion } = await supabase
          .from('inscripciones_equipo')
          .upsert(
            {
              equipo_id: equipoId,
              division_id: solicitud.division_id,
              activo: true
            },
            { onConflict: 'equipo_id,division_id' }
          )

        if (errorInscripcion) {
          setMensaje('Error al inscribir el equipo: ' + errorInscripcion.message)
          return
        }
      }

      const { data, error } = await supabase
        .from('solicitudes_inscripcion')
        .update({ estado })
        .eq('id', id)
        .eq('estado', 'pendiente')
        .eq('archivada', false)
        .select('id')

      if (error) {
        setMensaje('No se pudo actualizar: ' + error.message)
      } else if (!data?.length) {
        setMensaje('La solicitud ya fue modificada. Actualiza la lista.')
      } else {
        setMensaje(`Solicitud ${estado} correctamente.`)
        await refrescarDespuesDeCambio()
      }
    } catch (error) {
      setMensaje('Error inesperado: ' + error.message)
    } finally {
      setProcesando(null)
    }
  }

  async function cambiarArchivo(solicitud, archivar) {
    const accion = archivar ? 'archivar' : 'restaurar'

    if (!window.confirm(
      `¿Deseas ${accion} la solicitud de "${solicitud.nombre_equipo}"?`
    )) return

    setProcesando(solicitud.id)
    setMensaje('')

    try {
      const { data, error } = await supabase
        .from('solicitudes_inscripcion')
        .update({ archivada: archivar })
        .eq('id', solicitud.id)
        .eq('archivada', !archivar)
        .select('id')

      if (error) {
        setMensaje('Error: ' + error.message)
      } else if (!data?.length) {
        setMensaje('No se modificó la solicitud. Actualiza la lista.')
      } else {
        setMensaje(
          archivar
            ? 'Solicitud archivada correctamente.'
            : 'Solicitud restaurada correctamente.'
        )
        await refrescarDespuesDeCambio()
      }
    } catch (error) {
      setMensaje('Error inesperado: ' + error.message)
    } finally {
      setProcesando(null)
    }
  }

  async function eliminarSolicitud(solicitud) {
    if (!solicitud.archivada || solicitud.estado === 'aprobada') {
      setMensaje('Solo se pueden eliminar solicitudes archivadas no aprobadas.')
      return
    }

    if (!window.confirm(
      `¿Eliminar definitivamente la solicitud de "${solicitud.nombre_equipo}"?\n\nEsta acción no se puede deshacer.`
    )) return

    setProcesando(solicitud.id)
    setMensaje('')

    try {
      const { data, error } = await supabase
        .from('solicitudes_inscripcion')
        .delete()
        .eq('id', solicitud.id)
        .eq('archivada', true)
        .neq('estado', 'aprobada')
        .select('id')

      if (error) {
        setMensaje('No se pudo eliminar: ' + error.message)
      } else if (!data?.length) {
        setMensaje('No se eliminó la solicitud. Revisa los permisos.')
      } else {
        setMensaje('Solicitud eliminada correctamente.')
        await refrescarDespuesDeCambio()
      }
    } catch (error) {
      setMensaje('Error inesperado: ' + error.message)
    } finally {
      setProcesando(null)
    }
  }

  if (!autorizado) {
    return <main style={{ padding: 30 }}>Verificando acceso...</main>
  }

  return (
    <main style={{ maxWidth: 1100, margin: '40px auto', padding: 20 }}>
      <div style={{ marginBottom: 25, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => router.push('/admin')}
          style={{ padding: '10px 15px', cursor: 'pointer' }}
        >
          ← Administración
        </button>

        <button
          type="button"
          onClick={() => router.push('/admin/temporadas')}
          style={{ padding: '10px 15px', cursor: 'pointer' }}
        >
          Continuar a Temporadas →
        </button>
      </div>

      <h1>Solicitudes de inscripción</h1>
      <p>Administra las solicitudes enviadas por los equipos de YSASL.</p>

      <div style={{
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
        marginTop: 20
      }}>
        <label htmlFor="filtro-solicitudes">
          <strong>Mostrar:</strong>
        </label>

        <select
          id="filtro-solicitudes"
          value={filtro}
          onChange={e => {
            setFiltro(e.target.value)
            setPagina(0)
            setMensaje('')
          }}
          style={{ padding: 10 }}
        >
          <option value="pendiente">Pendientes</option>
          <option value="aprobada">Aprobadas</option>
          <option value="rechazada">Rechazadas</option>
          <option value="todas">Todas las activas</option>
          <option value="archivadas">Archivadas</option>
        </select>

        <button
          type="button"
          onClick={cargarSolicitudes}
          disabled={cargando || procesando !== null}
          style={{ padding: 10 }}
        >
          Actualizar lista
        </button>
      </div>

      {mensaje && <p role="status">{mensaje}</p>}

      {cargando ? (
        <p>Cargando solicitudes...</p>
      ) : (
        <>
          <p style={{ marginTop: 18 }}>
            <strong>{total}</strong> solicitudes en esta categoría.
          </p>

          {solicitudes.length === 0 ? (
            <p>No hay solicitudes en esta categoría.</p>
          ) : (
            <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
              {solicitudes.map(s => (
                <article
                  key={s.id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: 10,
                    padding: 20
                  }}
                >
                  <h2>{s.nombre_equipo}</h2>

                  <p><strong>Torneo:</strong> {s.temporadas?.nombre || 'No especificado'}</p>
                  <p><strong>División:</strong> {s.divisiones?.nombre || 'No especificada'}</p>
                  <p><strong>Representante:</strong> {s.representante}</p>
                  <p><strong>Teléfono:</strong> {s.telefono}</p>
                  <p><strong>Correo:</strong> {s.correo || 'No proporcionado'}</p>
                  <p><strong>Estado:</strong> {s.estado}</p>
                  <p>
                    <strong>Fecha:</strong>{' '}
                    {new Date(s.created_at).toLocaleDateString('es-US')}
                  </p>

                  <div style={{
                    display: 'flex',
                    gap: 12,
                    flexWrap: 'wrap',
                    marginTop: 15
                  }}>
                    {!s.archivada && s.estado === 'pendiente' && (
                      <>
                        <button
                          type="button"
                          disabled={procesando !== null}
                          onClick={() => cambiarEstado(s.id, 'aprobada')}
                          style={{
                            background: '#16803c',
                            color: 'white',
                            padding: 10,
                            cursor: 'pointer'
                          }}
                        >
                          Aprobar
                        </button>

                        <button
                          type="button"
                          disabled={procesando !== null}
                          onClick={() => cambiarEstado(s.id, 'rechazada')}
                          style={{
                            background: '#b91c1c',
                            color: 'white',
                            padding: 10,
                            cursor: 'pointer'
                          }}
                        >
                          Rechazar
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      disabled={procesando !== null}
                      onClick={() => cambiarArchivo(s, !s.archivada)}
                      style={{ padding: 10, cursor: 'pointer' }}
                    >
                      {s.archivada ? 'Restaurar' : 'Archivar'}
                    </button>

                    {s.archivada && s.estado !== 'aprobada' && (
                      <button
                        type="button"
                        disabled={procesando !== null}
                        onClick={() => eliminarSolicitud(s)}
                        style={{
                          background: '#991b1b',
                          color: 'white',
                          padding: 10,
                          cursor: 'pointer'
                        }}
                      >
                        Eliminar definitivamente
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {total > POR_PAGINA && (
            <div style={{
              display: 'flex',
              gap: 15,
              alignItems: 'center',
              marginTop: 25
            }}>
              <button
                type="button"
                disabled={pagina === 0 || cargando}
                onClick={() => setPagina(p => p - 1)}
              >
                ← Anterior
              </button>

              <span>
                Página {pagina + 1} de {Math.ceil(total / POR_PAGINA)}
              </span>

              <button
                type="button"
                disabled={
                  cargando ||
                  (pagina + 1) * POR_PAGINA >= total
                }
                onClick={() => setPagina(p => p + 1)}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
