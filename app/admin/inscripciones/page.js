'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const POR_PAGINA = 20

function nombreEnMayusculas(valor) {
  return String(valor || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('es')
}

const estiloCampo = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box',
  padding: 10,
  marginTop: 5,
  marginBottom: 12,
  border: '1px solid #ccc',
  borderRadius: 6
}

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
  const [editandoId, setEditandoId] = useState(null)
  const [nombreEditado, setNombreEditado] = useState(false)
  const [formEdicion, setFormEdicion] = useState({
    nombre_equipo: '',
    representante: '',
    telefono: '',
    correo: ''
  })

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

  function comenzarEdicion(solicitud) {
    if (procesando !== null) return

    setEditandoId(solicitud.id)
    setNombreEditado(false)
    setFormEdicion({
      nombre_equipo: nombreEnMayusculas(solicitud.nombre_equipo),
      representante: solicitud.representante || '',
      telefono: solicitud.telefono || '',
      correo: solicitud.correo || ''
    })
    setMensaje('')
  }

  function cancelarEdicion() {
    if (procesando !== null) return
    setEditandoId(null)
    setNombreEditado(false)
    setMensaje('')
  }

  async function guardarEdicion(evento, solicitud) {
    evento.preventDefault()
    if (procesando !== null || editandoId !== solicitud.id) return

    const cambios = {
      nombre_equipo: nombreEditado
        ? nombreEnMayusculas(formEdicion.nombre_equipo)
        : (solicitud.nombre_equipo || ''),
      representante: formEdicion.representante.trim(),
      telefono: formEdicion.telefono.trim(),
      correo: formEdicion.correo.trim() || null
    }

    if (!cambios.nombre_equipo || !cambios.representante || !cambios.telefono) {
      setMensaje('Completa el nombre del equipo, representante y teléfono.')
      return
    }

    const cambioNombre = cambios.nombre_equipo !== (solicitud.nombre_equipo || '')
    const cambioTelefono = cambios.telefono !== (solicitud.telefono || '')
    const hayCambios = cambioNombre || cambioTelefono ||
      cambios.representante !== (solicitud.representante || '') ||
      cambios.correo !== (solicitud.correo || null)

    if (!hayCambios) {
      setMensaje('No hay cambios por guardar.')
      setEditandoId(null)
      return
    }

    setProcesando(solicitud.id)
    setMensaje('')

    let equipoOriginal = null
    let equipoActualizado = false
    let nombreEquipoTrasActualizacion = null
    let solicitudReconciliada = false

    try {
      // Una solicitud aprobada puede conservar el nombre anterior si el equipo
      // ya fue renombrado desde Administración → Equipos.
      // Solo se modifica el equipo oficial cuando existe una coincidencia
      // única y comprobable en la misma división.
      if (solicitud.estado === 'aprobada' && (cambioNombre || cambioTelefono)) {
        if (!solicitud.division_id) {
          if (!window.confirm(
            'Esta solicitud no tiene una división válida para localizar el equipo oficial.\n\n' +
            '¿Guardar SOLAMENTE los datos de la solicitud, sin modificar ningún equipo oficial?'
          )) return
        } else {
          const { data: equiposDivision, error: errorEquipos } = await supabase
            .from('equipos')
            .select('id, nombre, telefono')
            .eq('division_id', solicitud.division_id)

          if (errorEquipos) {
            throw new Error('No se pudieron consultar los equipos oficiales: ' + errorEquipos.message)
          }

          const equipos = equiposDivision || []
          const coincidenciasOriginales = equipos.filter(
            equipo => nombreEnMayusculas(equipo.nombre) ===
              nombreEnMayusculas(solicitud.nombre_equipo)
          )
          const coincidenciasNuevas = equipos.filter(
            equipo => nombreEnMayusculas(equipo.nombre) === cambios.nombre_equipo
          )

          if (coincidenciasOriginales.length > 1 || coincidenciasNuevas.length > 1) {
            throw new Error(
              'Hay varios equipos con ese nombre en la división. No se guardó nada. ' +
              'Revisa Administración → Equipos para evitar modificar el equipo equivocado.'
            )
          }

          const equipoConNombreOriginal = coincidenciasOriginales[0] || null
          const equipoConNombreNuevo = coincidenciasNuevas[0] || null

          if (equipoConNombreOriginal && equipoConNombreNuevo &&
              equipoConNombreOriginal.id !== equipoConNombreNuevo.id) {
            throw new Error(
              'El nombre nuevo ya pertenece a otro equipo de esta división. ' +
              'No se guardó nada para evitar confundir dos equipos diferentes.'
            )
          }

          let equipo = equipoConNombreOriginal || equipoConNombreNuevo

          if (equipo) {
            const { data: inscripciones, error: errorInscripcion } = await supabase
              .from('inscripciones_equipo')
              .select('equipo_id')
              .eq('equipo_id', equipo.id)
              .eq('division_id', solicitud.division_id)
              .limit(1)

            if (errorInscripcion) {
              throw new Error('No se pudo comprobar la inscripción oficial: ' + errorInscripcion.message)
            }

            if (!inscripciones?.length) {
              // No asumir que es el mismo equipo si no está inscrito.
              equipo = null
            }
          }

          if (equipo && equipoConNombreOriginal) {
            // Caso habitual: el nombre de la solicitud aún coincide con el
            // equipo oficial. Actualizamos ambos sin cambiar su ID.
            if (!window.confirm(
              `¿Actualizar la solicitud y el equipo oficial "${equipo.nombre}"?\n\n` +
              'Se conservarán los jugadores, partidos, resultados y estadísticas.'
            )) return

            equipoOriginal = equipo
            nombreEquipoTrasActualizacion = cambioNombre ? cambios.nombre_equipo : equipo.nombre

            const { data: equipoGuardado, error: errorEquipo } = await supabase
              .from('equipos')
              .update({
                ...(cambioNombre ? { nombre: cambios.nombre_equipo } : {}),
                ...(cambioTelefono ? { telefono: cambios.telefono } : {})
              })
              .eq('id', equipo.id)
              .eq('division_id', solicitud.division_id)
              .eq('nombre', equipo.nombre)
              .select('id')

            if (errorEquipo || !equipoGuardado?.length) {
              throw new Error(
                'No se pudo actualizar el equipo oficial: ' +
                (errorEquipo?.message || 'el registro cambió. Actualiza la lista.')
              )
            }

            equipoActualizado = true
          } else if (equipo && equipoConNombreNuevo) {
            // Caso LA VALLARTA FC: el equipo ya se renombró en Equipos.
            // Actualizar la solicitud sin intentar renombrar otra vez el equipo.
            if (!window.confirm(
              `El equipo oficial ya aparece como "${equipo.nombre}" en esta división.\n\n` +
              '¿Actualizar la solicitud para que coincida con ese nombre?' +
              (cambioTelefono ? '\nTambién se actualizará el teléfono del equipo oficial.' : '')
            )) return

            solicitudReconciliada = true

            if (cambioTelefono) {
              equipoOriginal = equipo
              nombreEquipoTrasActualizacion = equipo.nombre

              const { data: equipoGuardado, error: errorEquipo } = await supabase
                .from('equipos')
                .update({ telefono: cambios.telefono })
                .eq('id', equipo.id)
                .eq('division_id', solicitud.division_id)
                .eq('nombre', equipo.nombre)
                .select('id')

              if (errorEquipo || !equipoGuardado?.length) {
                throw new Error(
                  'No se pudo actualizar el teléfono del equipo oficial: ' +
                  (errorEquipo?.message || 'el registro cambió. Actualiza la lista.')
                )
              }

              equipoActualizado = true
            }
          } else {
            // No hay coincidencia segura. Permitir corregir el expediente
            // sin tocar equipos oficiales, y dejarlo claro al administrador.
            if (!window.confirm(
              'No se pudo identificar un equipo oficial único con el nombre anterior ni con el nuevo.\n\n' +
              '¿Guardar SOLAMENTE la corrección de esta solicitud?\n\n' +
              'Ningún equipo oficial, partido o estadística será modificado.'
            )) return
          }
        }
      }

      const { data: solicitudGuardada, error: errorSolicitud } = await supabase
        .from('solicitudes_inscripcion')
        .update(cambios)
        .eq('id', solicitud.id)
        .eq('estado', solicitud.estado)
        .eq('archivada', solicitud.archivada)
        .eq('nombre_equipo', solicitud.nombre_equipo)
        .select('id')

      if (errorSolicitud || !solicitudGuardada?.length) {
        const detalle = errorSolicitud?.message || 'la solicitud cambió. Actualiza la lista.'

        if (equipoActualizado && equipoOriginal) {
          // Compensación si falló la segunda actualización. No es una
          // transacción de base de datos: si falla, avisamos para revisión.
          const { data: restaurado, error: errorRestaurar } = await supabase
            .from('equipos')
            .update({
              ...(cambioNombre ? { nombre: equipoOriginal.nombre } : {}),
              ...(cambioTelefono ? { telefono: equipoOriginal.telefono } : {})
            })
            .eq('id', equipoOriginal.id)
            .eq('nombre', nombreEquipoTrasActualizacion)
            .select('id')

          if (errorRestaurar || !restaurado?.length) {
            throw new Error(
              'ATENCIÓN: falló guardar la solicitud (' + detalle +
              ') y no se pudo restaurar automáticamente el equipo oficial. Revisa Administración → Equipos antes de continuar.'
            )
          }
        }

        throw new Error('No se pudo guardar la solicitud: ' + detalle)
      }

      setEditandoId(null)
      setNombreEditado(false)
      setMensaje(
        solicitudReconciliada
          ? 'Solicitud sincronizada con el nombre que ya aparece en Equipos.' +
            (equipoActualizado ? ' También se actualizó el teléfono oficial.' : '')
          : equipoActualizado
            ? 'Solicitud y equipo oficial actualizados correctamente.'
            : 'Solicitud actualizada correctamente. No se modificó ningún equipo oficial.'
      )
      await refrescarDespuesDeCambio()
    } catch (error) {
      setMensaje(error.message || 'No se pudieron guardar los cambios.')
    } finally {
      setProcesando(null)
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
          disabled={editandoId !== null || procesando !== null}
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
          disabled={cargando || procesando !== null || editandoId !== null}
          style={{ padding: 10 }}
        >
          Actualizar lista
        </button>
      </div>

      {mensaje && editandoId === null && <p role="status">{mensaje}</p>}

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

                  {editandoId === s.id && (
                    <form
                      onSubmit={evento => guardarEdicion(evento, s)}
                      style={{
                        padding: 16,
                        background: '#f5f7fa',
                        border: '1px solid #d6dce5',
                        borderRadius: 8,
                        marginBottom: 18
                      }}
                    >
                      <h3 style={{ marginTop: 0 }}>Editar solicitud</h3>
                      {mensaje && <p role="alert">{mensaje}</p>}

                      <label>
                        Nombre del equipo *
                        <input
                          style={estiloCampo}
                          required
                          maxLength={120}
                          value={formEdicion.nombre_equipo}
                          onChange={e => {
                            setNombreEditado(true)
                            setFormEdicion(actual => ({
                              ...actual,
                              nombre_equipo: e.target.value.toLocaleUpperCase('es')
                            }))
                          }}
                        />
                      </label>

                      <label>
                        Representante *
                        <input
                          style={estiloCampo}
                          required
                          maxLength={120}
                          value={formEdicion.representante}
                          onChange={e => setFormEdicion(actual => ({
                            ...actual, representante: e.target.value
                          }))}
                        />
                      </label>

                      <label>
                        Teléfono *
                        <input
                          style={estiloCampo}
                          type="tel"
                          required
                          maxLength={30}
                          value={formEdicion.telefono}
                          onChange={e => setFormEdicion(actual => ({
                            ...actual, telefono: e.target.value
                          }))}
                        />
                      </label>

                      <label>
                        Correo electrónico (opcional)
                        <input
                          style={estiloCampo}
                          type="email"
                          maxLength={254}
                          value={formEdicion.correo}
                          onChange={e => setFormEdicion(actual => ({
                            ...actual, correo: e.target.value
                          }))}
                        />
                      </label>

                      {s.estado === 'aprobada' && (
                        <p style={{ fontSize: 13, color: '#555' }}>
                          Si el equipo ya fue renombrado en Administración → Equipos,
                          podrás actualizar esta solicitud para que coincidan.
                          Si no encontramos un equipo oficial único, podrás guardar
                          solo la solicitud, con confirmación y sin alterar equipos.
                        </p>
                      )}

                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          type="submit"
                          disabled={procesando !== null}
                          style={{
                            background: '#0b2341',
                            color: 'white',
                            padding: '10px 15px',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer'
                          }}
                        >
                          {procesando === s.id ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                        <button
                          type="button"
                          disabled={procesando !== null}
                          onClick={cancelarEdicion}
                          style={{ padding: '10px 15px', cursor: 'pointer' }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}

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
                    {editandoId !== s.id && (
                      <button
                        type="button"
                        disabled={procesando !== null || editandoId !== null}
                        onClick={() => comenzarEdicion(s)}
                        style={{
                          background: '#0b2341',
                          color: 'white',
                          padding: 10,
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer'
                        }}
                      >
                        Editar solicitud
                      </button>
                    )}

                    {!s.archivada && s.estado === 'pendiente' && (
                      <>
                        <button
                          type="button"
                          disabled={procesando !== null || editandoId !== null}
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
                          disabled={procesando !== null || editandoId !== null}
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
                      disabled={procesando !== null || editandoId !== null}
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
                disabled={pagina === 0 || cargando || editandoId !== null || procesando !== null}
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
                  editandoId !== null ||
                  procesando !== null ||
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
