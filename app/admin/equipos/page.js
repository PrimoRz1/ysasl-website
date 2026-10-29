
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

function nombreEnMayusculas(valor) {
  return String(valor || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('es')
}

export default function AdminEquiposPage() {
  const [equipos, setEquipos] = useState([])
  const [divisiones, setDivisiones] = useState([])
  const [temporadas, setTemporadas] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [nombre, setNombre] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [nombreEditado, setNombreEditado] = useState('')
  const [inscripcionEditadaId, setInscripcionEditadaId] = useState('')
  const [divisionEditadaId, setDivisionEditadaId] = useState('')
  const [archivoEscudo, setArchivoEscudo] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const [rEquipos, rDivisiones, rTemporadas, rInscripciones] = await Promise.all([
      supabase.from('equipos').select('id, nombre, activo, escudo_url').order('nombre'),
      supabase.from('divisiones').select('id, nombre, temporada_id').order('orden'),
      supabase.from('temporadas').select('id, nombre, activa').order('id', { ascending: false }),
      supabase.from('inscripciones_equipo').select('id, equipo_id, division_id, activo')
    ])

    const fallo = [rEquipos, rDivisiones, rTemporadas, rInscripciones].find((r) => r.error)
    if (fallo) {
      console.error(fallo.error)
      setMensaje(`Error al cargar datos: ${fallo.error.message}`)
      return
    }

    setEquipos(rEquipos.data || [])
    setDivisiones(rDivisiones.data || [])
    setTemporadas(rTemporadas.data || [])
    setInscripciones(rInscripciones.data || [])
  }

  function etiquetaDivision(id) {
    const division = divisiones.find((d) => d.id === Number(id))
    if (!division) return 'Sin división'
    const temporada = temporadas.find((t) => t.id === division.temporada_id)
    return `${temporada?.nombre || 'Sin torneo'} — ${division.nombre}`
  }

  function inscripcionesActivas(equipoId) {
    return inscripciones.filter((i) => i.equipo_id === equipoId && i.activo)
  }

  function obtenerTorneoDivision(equipoId) {
    const activas = inscripcionesActivas(equipoId)
    return activas.length
      ? activas.map((i) => etiquetaDivision(i.division_id)).join(' | ')
      : 'Sin división'
  }

  async function crearEquipo() {
    if (ocupado) return
    if (!nombreEnMayusculas(nombre) || !divisionId) {
      setMensaje('Escribe el nombre y selecciona una división.')
      return
    }

    setOcupado(true)
    setMensaje('')
    try {
      const { data: equipo, error } = await supabase
        .from('equipos')
        .insert({ nombre: nombreEnMayusculas(nombre), activo: true })
        .select('id')
        .single()

      if (error || !equipo) throw new Error(error?.message || 'No se creó el equipo.')

      const { error: errorInscripcion } = await supabase
        .from('inscripciones_equipo')
        .insert({ equipo_id: equipo.id, division_id: Number(divisionId), activo: true })

      if (errorInscripcion) {
        setMensaje(`Se creó el equipo ID ${equipo.id}, pero falló la inscripción: ${errorInscripcion.message}. No lo agregues de nuevo; revisemos ese equipo.`)
        await cargarDatos()
        return
      }

      setNombre('')
      setDivisionId('')
      await cargarDatos()
      setMensaje('Equipo creado correctamente.')
    } catch (error) {
      setMensaje(`No se pudo crear el equipo: ${error.message}`)
    } finally {
      setOcupado(false)
    }
  }

  function empezarEdicion(equipo) {
    const primera = inscripcionesActivas(equipo.id)[0]
    setArchivoEscudo(null)
    setEditandoId(equipo.id)
    setNombreEditado(equipo.nombre)
    setInscripcionEditadaId(primera ? String(primera.id) : '')
    setDivisionEditadaId(primera ? String(primera.division_id) : '')
    setMensaje('')
  }

  async function guardarNombre(equipo) {
    if (ocupado) return

    const nombreAnterior = equipo.nombre
    const nuevoNombre = nombreEnMayusculas(nombreEditado)
    if (!nuevoNombre) {
      setMensaje('El nombre no puede estar vacío.')
      return
    }
    if (nuevoNombre === nombreAnterior) {
      setMensaje('El nombre no cambió.')
      return
    }

    setOcupado(true)
    setMensaje('')

    // Guardamos los registros modificados para intentar revertir los cambios
    // si falla una actualización posterior. Esto NO reemplaza una transacción SQL.
    let equipoRenombrado = false
    const solicitudesRenombradas = []

    try {
      // 1. Comprobar que el nombre oficial no cambió desde que abrimos la página.
      const { data: equipoActual, error: errorActual } = await supabase
        .from('equipos')
        .select('id, nombre')
        .eq('id', equipo.id)
        .single()

      if (errorActual || !equipoActual) {
        throw new Error('No se pudo verificar el equipo: ' + (errorActual?.message || 'no encontrado.'))
      }
      if (equipoActual.nombre !== nombreAnterior) {
        throw new Error('El equipo ya fue modificado desde otra pantalla. Actualiza la página antes de continuar.')
      }

      // 2. Buscar únicamente las divisiones en las que ESTE equipo está inscrito.
      const { data: altas, error: errorAltas } = await supabase
        .from('inscripciones_equipo')
        .select('division_id')
        .eq('equipo_id', equipo.id)
        .eq('activo', true)

      if (errorAltas) {
        throw new Error('No se pudieron verificar las divisiones del equipo: ' + errorAltas.message)
      }

      const idsDivision = [...new Set((altas || []).map(a => Number(a.division_id)).filter(Number.isFinite))]
      let solicitudesParaActualizar = []
      let solicitudesYaCoinciden = 0

      if (idsDivision.length > 0) {
        // 3. Validar que no exista otro equipo con el nombre nuevo en la misma división.
        // También comprobamos que el nombre anterior identifique a un único equipo.
        const { data: altasDivision, error: errorAltasDivision } = await supabase
          .from('inscripciones_equipo')
          .select('equipo_id, division_id')
          .in('division_id', idsDivision)
          .eq('activo', true)
          .limit(1000)

        if (errorAltasDivision) throw new Error('No se pudieron verificar las inscripciones: ' + errorAltasDivision.message)
        if ((altasDivision || []).length >= 1000) {
          throw new Error('Hay demasiadas inscripciones para comprobar de forma segura. No se guardó nada.')
        }

        const idsEquipos = [...new Set((altasDivision || []).map(a => a.equipo_id))]
        const { data: nombresDivision, error: errorNombres } = idsEquipos.length
          ? await supabase.from('equipos').select('id, nombre').in('id', idsEquipos)
          : { data: [], error: null }

        if (errorNombres) throw new Error('No se pudieron comparar los nombres oficiales: ' + errorNombres.message)
        const nombresPorId = new Map((nombresDivision || []).map(e => [String(e.id), nombreEnMayusculas(e.nombre)]))
        const anteriorNormalizado = nombreEnMayusculas(nombreAnterior)

        for (const idDivision of idsDivision) {
          const equiposDeEstaDivision = (altasDivision || [])
            .filter(a => Number(a.division_id) === idDivision)

          const mismoNombreAnterior = equiposDeEstaDivision.filter(
            a => nombresPorId.get(String(a.equipo_id)) === anteriorNormalizado
          )
          if (mismoNombreAnterior.length !== 1 || String(mismoNombreAnterior[0].equipo_id) !== String(equipo.id)) {
            throw new Error('El nombre anterior no identifica un equipo único en una de sus divisiones. No se guardó nada.')
          }

          const otroConNombreNuevo = equiposDeEstaDivision.some(
            a => String(a.equipo_id) !== String(equipo.id) &&
              nombresPorId.get(String(a.equipo_id)) === nuevoNombre
          )
          if (otroConNombreNuevo) {
            throw new Error('Ya existe otro equipo con el nombre nuevo en una de sus divisiones. No se guardó nada.')
          }
        }

        // 4. Encontrar solicitudes APROBADAS que todavía tienen el nombre anterior.
        // La combinación de división, torneo y nombre debe ser inequívoca.
        const { data: solicitudes, error: errorSolicitudes } = await supabase
          .from('solicitudes_inscripcion')
          .select('id, nombre_equipo, division_id, temporada_id')
          .eq('estado', 'aprobada')
          .in('division_id', idsDivision)
          .limit(1000)

        if (errorSolicitudes) {
          throw new Error('No se pudieron verificar las solicitudes aprobadas: ' + errorSolicitudes.message)
        }
        if ((solicitudes || []).length >= 1000) {
          throw new Error('Hay demasiadas solicitudes para sincronizar con seguridad. No se guardó nada.')
        }

        for (const idDivision of idsDivision) {
          const division = divisiones.find(d => Number(d.id) === idDivision)
          if (!division) {
            throw new Error('No se encontró una división del equipo. Actualiza la página antes de continuar.')
          }

          const coincidencias = (solicitudes || []).filter(s =>
            Number(s.division_id) === idDivision &&
            Number(s.temporada_id) === Number(division.temporada_id) &&
            nombreEnMayusculas(s.nombre_equipo) === anteriorNormalizado
          )

          const yaConNombreNuevo = (solicitudes || []).filter(s =>
            Number(s.division_id) === idDivision &&
            Number(s.temporada_id) === Number(division.temporada_id) &&
            nombreEnMayusculas(s.nombre_equipo) === nuevoNombre
          )

          if (coincidencias.length > 1 || yaConNombreNuevo.length > 1) {
            throw new Error(
              'Hay varias solicitudes aprobadas con nombres coincidentes en ' +
              etiquetaDivision(idDivision) + '. Revísalas antes de cambiar el equipo.'
            )
          }
          if (coincidencias.length === 1 && yaConNombreNuevo.length === 1 &&
              coincidencias[0].id !== yaConNombreNuevo[0].id) {
            throw new Error(
              'El nombre nuevo ya pertenece a otra solicitud aprobada de ' +
              etiquetaDivision(idDivision) + '. No se guardó nada.'
            )
          }
          if (coincidencias.length === 1) {
            solicitudesParaActualizar.push(coincidencias[0])
          } else if (yaConNombreNuevo.length === 1) {
            // La solicitud se había corregido antes que el equipo oficial.
            solicitudesYaCoinciden++
          }
        }
      }

      const aviso = solicitudesParaActualizar.length
        ? `¿Cambiar el nombre de "${nombreAnterior}" a "${nuevoNombre}" y actualizar ` +
          `${solicitudesParaActualizar.length} solicitud(es) aprobada(s) correspondiente(s)?`
        : solicitudesYaCoinciden
          ? `La solicitud aprobada ya tiene el nombre "${nuevoNombre}".\n\n` +
            '¿Actualizar solamente el equipo oficial para que coincidan?'
          : `No encontramos una solicitud aprobada con el nombre anterior para sincronizar.\n\n` +
            `¿Cambiar SOLO el nombre del equipo oficial a "${nuevoNombre}"?`

      if (!window.confirm(aviso + '\n\nSe conservarán los jugadores, partidos y resultados.')) return

      // 5. Cambiar el equipo sin modificar su ID ni ninguna relación existente.
      const { data: equipoGuardado, error: errorGuardarEquipo } = await supabase
        .from('equipos')
        .update({ nombre: nuevoNombre })
        .eq('id', equipo.id)
        .eq('nombre', nombreAnterior)
        .select('id')

      if (errorGuardarEquipo || !equipoGuardado?.length) {
        throw new Error('No se pudo guardar el nombre del equipo: ' +
          (errorGuardarEquipo?.message || 'el registro cambió o faltan permisos.'))
      }
      equipoRenombrado = true

      // 6. Sincronizar cada solicitud sin cambiar su estado ni crear equipos.
      for (const solicitud of solicitudesParaActualizar) {
        const { data: guardadas, error: errorGuardarSolicitud } = await supabase
          .from('solicitudes_inscripcion')
          .update({ nombre_equipo: nuevoNombre })
          .eq('id', solicitud.id)
          .eq('estado', 'aprobada')
          .eq('division_id', solicitud.division_id)
          .eq('nombre_equipo', solicitud.nombre_equipo)
          .select('id')

        if (errorGuardarSolicitud || !guardadas?.length) {
          throw new Error('No se pudo sincronizar una solicitud aprobada: ' +
            (errorGuardarSolicitud?.message || 'el registro cambió o faltan permisos.'))
        }
        solicitudesRenombradas.push(solicitud)
      }

      await cargarDatos()
      setEditandoId(null)
      setNombreEditado('')
      setMensaje(
        solicitudesParaActualizar.length
          ? `Nombre actualizado en Equipos y en ${solicitudesParaActualizar.length} solicitud(es) aprobada(s).` +
            (solicitudesYaCoinciden ? ` Otras ${solicitudesYaCoinciden} ya tenían ese nombre.` : '')
          : solicitudesYaCoinciden
            ? 'Nombre actualizado en Equipos. La solicitud aprobada ya tenía el nombre correcto.'
            : 'Nombre actualizado en Equipos. No se encontró una solicitud aprobada con el nombre anterior; revisa Solicitudes de inscripción si es necesario.'
      )
    } catch (error) {
      // Si una actualización posterior falla, intentar dejar ambos registros
      // como estaban. Si la reversión falla, advertirlo expresamente.
      const erroresReversion = []
      for (const solicitud of [...solicitudesRenombradas].reverse()) {
        const { data, error: errorRevertir } = await supabase
          .from('solicitudes_inscripcion')
          .update({ nombre_equipo: solicitud.nombre_equipo })
          .eq('id', solicitud.id)
          .eq('nombre_equipo', nuevoNombre)
          .select('id')

        if (errorRevertir || !data?.length) erroresReversion.push('solicitud ' + solicitud.id)
      }

      if (equipoRenombrado) {
        const { data, error: errorRevertir } = await supabase
          .from('equipos')
          .update({ nombre: nombreAnterior })
          .eq('id', equipo.id)
          .eq('nombre', nuevoNombre)
          .select('id')

        if (errorRevertir || !data?.length) erroresReversion.push('equipo ' + equipo.id)
      }

      await cargarDatos()
      setMensaje(erroresReversion.length
        ? `ATENCIÓN: ${error.message} No se pudo restaurar: ${erroresReversion.join(', ')}. Revisa Equipos y Solicitudes de inscripción antes de continuar.`
        : `No se completó el cambio: ${error.message} No se dejaron cambios parciales conocidos.`
      )
    } finally {
      setOcupado(false)
    }
  }

  async function contarPartidos(equipoId) {
    const { count, error } = await supabase
      .from('partidos')
      .select('id', { count: 'exact', head: true })
      .or(`local_id.eq.${equipoId},visitante_id.eq.${equipoId}`)

    if (error) throw error
    return count ?? 0
  }

  async function cambiarDivision(equipo) {
    if (ocupado) return
    const actual = inscripciones.find(
      (i) => i.id === Number(inscripcionEditadaId) && i.equipo_id === equipo.id && i.activo
    )
    const origen = divisiones.find((d) => d.id === actual?.division_id)
    const destino = divisiones.find((d) => d.id === Number(divisionEditadaId))

    if (!actual || !origen || !destino) {
      setMensaje('Selecciona una inscripción y una división válidas.')
      return
    }
    if (origen.id === destino.id) {
      setMensaje('La división no cambió.')
      return
    }
    if (origen.temporada_id !== destino.temporada_id) {
      setMensaje('Solo se permite cambiar a otra división del mismo torneo.')
      return
    }
    if (inscripciones.some((i) => i.id !== actual.id && i.equipo_id === equipo.id && i.division_id === destino.id && i.activo)) {
      setMensaje('El equipo ya tiene una inscripción activa en esa división.')
      return
    }

    setOcupado(true)
    try {
      const partidos = await contarPartidos(equipo.id)
      if (partidos > 0) {
        setMensaje(`No se puede cambiar la división: ${equipo.nombre} tiene ${partidos} partido(s) registrados. Así protegemos el calendario y los resultados.`)
        return
      }
      if (!window.confirm(`¿Cambiar ${equipo.nombre} de ${etiquetaDivision(origen.id)} a ${etiquetaDivision(destino.id)}?`)) return

      const { data, error } = await supabase
        .from('inscripciones_equipo')
        .update({ division_id: destino.id })
        .eq('id', actual.id)
        .eq('equipo_id', equipo.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('No se actualizó la inscripción. Revisa los permisos de Supabase.')
      await cargarDatos()
      setEditandoId(null)
      setMensaje('División actualizada correctamente.')
    } catch (error) {
      setMensaje(`No se pudo cambiar la división: ${error.message}`)
    } finally {
      setOcupado(false)
    }
  }

  async function eliminarEquipo(equipo) {
    if (ocupado) return
    setOcupado(true)
    setMensaje('')
    try {
      const [partidos, rJugadores, rEventos] = await Promise.all([
        contarPartidos(equipo.id),
        supabase.from('jugadores').select('id', { count: 'exact', head: true }).eq('equipo_id', equipo.id),
        supabase.from('eventos_partido').select('id', { count: 'exact', head: true }).eq('equipo_id', equipo.id)
      ])
      if (rJugadores.error) throw rJugadores.error
      if (rEventos.error) throw rEventos.error

      const jugadores = rJugadores.count ?? 0
      const eventos = rEventos.count ?? 0
      if (partidos > 0 || jugadores > 0 || eventos > 0) {
        setMensaje(`No se eliminó ${equipo.nombre}: tiene ${partidos} partido(s), ${jugadores} jugador(es) y ${eventos} evento(s). No borraremos esos datos.`)
        return
      }

      const confirmacion = window.prompt(
        `ELIMINACIÓN PERMANENTE DE ${equipo.nombre}.\n\nTambién se borrarán sus inscripciones y preferencias de horario.\nPara confirmar, escribe exactamente el nombre del equipo:`
      )
      if (confirmacion !== equipo.nombre) {
        setMensaje('Eliminación cancelada. No se cambió ningún equipo.')
        return
      }

      const { data, error } = await supabase
        .from('equipos')
        .delete()
        .eq('id', equipo.id)
        .select('id')

      if (error) throw error
      if (!data?.length) throw new Error('No se eliminó el equipo. Revisa los permisos de Supabase.')
      await cargarDatos()
      if (editandoId === equipo.id) setEditandoId(null)
      setMensaje(`Se eliminó ${equipo.nombre} correctamente.`)
    } catch (error) {
      setMensaje(`No se pudo eliminar el equipo: ${error.message}`)
    } finally {
      setOcupado(false)
    }
  }

  const BUCKET_ESCUDOS = 'escudos-equipos'

  function rutaEscudo(url) {
    if (!url) return null
    const marcador = `/storage/v1/object/public/${BUCKET_ESCUDOS}/`
    const indice = url.indexOf(marcador)
    if (indice === -1) return null
    return decodeURIComponent(url.slice(indice + marcador.length).split('?')[0])
  }

  async function subirEscudo(equipo) {
    if (ocupado || !archivoEscudo) {
      setMensaje('Selecciona primero una imagen para el escudo.')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(archivoEscudo.type)) {
      setMensaje('Utiliza una imagen PNG, JPG o WEBP.')
      return
    }
    if (archivoEscudo.size > 2 * 1024 * 1024) {
      setMensaje('El archivo no puede superar los 2 MB.')
      return
    }
    setOcupado(true)
    setMensaje('')
    try {
      const extension = archivoEscudo.type === 'image/png' ? 'png' : archivoEscudo.type === 'image/webp' ? 'webp' : 'jpg'
      const rutaNueva = `${equipo.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`
      const { error: errorSubida } = await supabase.storage.from(BUCKET_ESCUDOS).upload(rutaNueva, archivoEscudo, {
        contentType: archivoEscudo.type,
        upsert: false
      })
      if (errorSubida) throw errorSubida
      const { data: urlData } = supabase.storage.from(BUCKET_ESCUDOS).getPublicUrl(rutaNueva)
      const { data: actualizados, error: errorEquipo } = await supabase.from('equipos')
        .update({ escudo_url: urlData.publicUrl }).eq('id', equipo.id).select('id')
      if (errorEquipo || !actualizados?.length) {
        await supabase.storage.from(BUCKET_ESCUDOS).remove([rutaNueva])
        throw new Error(errorEquipo?.message || 'No se pudo guardar la URL del escudo en equipos.')
      }
      const anterior = rutaEscudo(equipo.escudo_url)
      let aviso = 'Escudo guardado correctamente.'
      if (anterior) {
        const { error: errorBorrado } = await supabase.storage.from(BUCKET_ESCUDOS).remove([anterior])
        if (errorBorrado) aviso += ' El escudo anterior no se pudo borrar del almacenamiento.'
      }
      setArchivoEscudo(null)
      await cargarDatos()
      setMensaje(aviso)
    } catch (error) {
      setMensaje(`No se pudo subir el escudo: ${error.message}`)
    } finally {
      setOcupado(false)
    }
  }

  async function eliminarEscudo(equipo) {
    if (ocupado || !equipo.escudo_url) return
    if (!window.confirm(`¿Eliminar el escudo de ${equipo.nombre}?`)) return
    setOcupado(true)
    setMensaje('')
    try {
      const { data, error } = await supabase.from('equipos')
        .update({ escudo_url: null }).eq('id', equipo.id).select('id')
      if (error || !data?.length) throw new Error(error?.message || 'No se pudo actualizar el equipo.')
      const ruta = rutaEscudo(equipo.escudo_url)
      let aviso = 'Escudo eliminado del equipo.'
      if (ruta) {
        const { error: errorStorage } = await supabase.storage.from(BUCKET_ESCUDOS).remove([ruta])
        if (errorStorage) aviso += ' No se pudo eliminar el archivo del almacenamiento.'
      }
      await cargarDatos()
      setMensaje(aviso)
    } catch (error) {
      setMensaje(`No se pudo eliminar el escudo: ${error.message}`)
    } finally {
      setOcupado(false)
    }
  }

  const inscripcionActual = inscripciones.find((i) => i.id === Number(inscripcionEditadaId))
  const divisionActual = divisiones.find((d) => d.id === inscripcionActual?.division_id)
  const divisionesMismoTorneo = divisiones.filter(
    (d) => d.temporada_id === divisionActual?.temporada_id
  )
  const estiloBoton = { padding: '8px 12px', cursor: 'pointer', marginRight: '8px', marginTop: '8px' }
  const estiloInput = { padding: '8px', marginRight: '10px', maxWidth: '100%' }

  return (
    <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px' }}>
      <div style={{ marginBottom: '25px' }}>
        <button type="button" onClick={() => window.location.href = '/admin/partidos'} style={estiloBoton}>
          ← Volver a Partidos
        </button>
        <button type="button" onClick={() => window.location.href = '/admin/jugadores'} style={estiloBoton}>
          Continuar a Jugadores →
        </button>
      </div>

      <h1>Administrar Equipos</h1>
      <p>Agrega, edita y administra los equipos de YSASL.</p>

      <div style={{ border: '1px solid #ddd', padding: '20px', marginTop: '25px', marginBottom: '30px', borderRadius: '8px' }}>
        <h2>Agregar equipo</h2>
        <input
          type="text"
          placeholder="Nombre del equipo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value.toLocaleUpperCase('es'))}
          style={estiloInput}
        />
        <select value={divisionId} onChange={(e) => setDivisionId(e.target.value)} style={estiloInput}>
          <option value="">Seleccionar división</option>
          {divisiones.map((division) => (
            <option key={division.id} value={division.id}>{etiquetaDivision(division.id)}</option>
          ))}
        </select>
        <button type="button" disabled={ocupado} onClick={crearEquipo} style={estiloBoton}>
          + Agregar equipo
        </button>
      </div>

      {mensaje && (
        <p role="status" style={{ padding: '12px', border: '1px solid #ccc', borderRadius: '6px' }}>
          <strong>{mensaje}</strong>
        </p>
      )}

      <h2>Equipos ({equipos.length})</h2>
      {equipos.map((equipo) => {
        const activas = inscripcionesActivas(equipo.id)
        return (
          <div key={equipo.id} style={{ borderBottom: '1px solid #ddd', padding: '16px 0' }}>
            <strong>{equipo.nombre}</strong>
            <div style={{ marginTop: '4px', color: '#666' }}>{obtenerTorneoDivision(equipo.id)}</div>
            <button type="button" disabled={ocupado} onClick={() => editandoId === equipo.id ? setEditandoId(null) : empezarEdicion(equipo)} style={estiloBoton}>
              {editandoId === equipo.id ? 'Cancelar edición' : 'Editar equipo'}
            </button>
            <button type="button" disabled={ocupado} onClick={() => eliminarEquipo(equipo)} style={{ ...estiloBoton, color: '#b42318' }}>
              Eliminar equipo
            </button>

            {editandoId === equipo.id && (
              <div style={{ marginTop: '12px', padding: '16px', border: '1px solid #ddd', borderRadius: '8px' }}>
                <h3 style={{ marginTop: 0 }}>Editar {equipo.nombre}</h3>
                <div style={{ marginTop: '20px', marginBottom: '22px', padding: '16px', background: '#f6f9fc', borderRadius: '8px' }}>
                  <h4 style={{ marginTop: 0 }}>Escudo del equipo</h4>
                  {equipo.escudo_url ? (
                    <div style={{ marginBottom: '12px' }}>
                      <img src={equipo.escudo_url} alt={`Escudo de ${equipo.nombre}`} style={{ width: '110px', height: '110px', objectFit: 'contain' }} />
                    </div>
                  ) : <p>Este equipo todavía no tiene escudo.</p>}
                  <label htmlFor={`escudo-${equipo.id}`}>Seleccionar imagen PNG, JPG o WEBP (máximo 2 MB)</label>
                  <div style={{ marginTop: '8px' }}>
                    <input
                      id={`escudo-${equipo.id}`}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      disabled={ocupado}
                      onChange={(e) => setArchivoEscudo(e.target.files?.[0] || null)}
                    />
                  </div>
                  <button type="button" disabled={ocupado || !archivoEscudo} onClick={() => subirEscudo(equipo)} style={estiloBoton}>
                    {ocupado ? 'Procesando...' : 'Subir escudo'}
                  </button>
                  {equipo.escudo_url && (
                    <button type="button" disabled={ocupado} onClick={() => eliminarEscudo(equipo)} style={{ ...estiloBoton, color: '#b42318' }}>
                      Eliminar escudo
                    </button>
                  )}
                </div>
                <p><strong>Nombre del equipo</strong></p>
                <input type="text" value={nombreEditado} onChange={(e) => setNombreEditado(e.target.value.toLocaleUpperCase('es'))} style={estiloInput} />
                <button type="button" disabled={ocupado} onClick={() => guardarNombre(equipo)} style={estiloBoton}>
                  Guardar nombre
                </button>

                {activas.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <p><strong>Cambiar división (solo si el equipo no tiene partidos)</strong></p>
                    {activas.length > 1 && (
                      <select
                        value={inscripcionEditadaId}
                        onChange={(e) => {
                          const nueva = activas.find((i) => String(i.id) === e.target.value)
                          setInscripcionEditadaId(e.target.value)
                          setDivisionEditadaId(nueva ? String(nueva.division_id) : '')
                        }}
                        style={estiloInput}
                      >
                        {activas.map((i) => (
                          <option key={i.id} value={i.id}>{etiquetaDivision(i.division_id)}</option>
                        ))}
                      </select>
                    )}
                    <select value={divisionEditadaId} onChange={(e) => setDivisionEditadaId(e.target.value)} style={estiloInput}>
                      {divisionesMismoTorneo.map((d) => (
                        <option key={d.id} value={d.id}>{etiquetaDivision(d.id)}</option>
                      ))}
                    </select>
                    <button type="button" disabled={ocupado} onClick={() => cambiarDivision(equipo)} style={estiloBoton}>
                      Guardar división
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </main>
  )
}
