'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function PatrocinadoresAdminPage() {
  const [patrocinadores, setPatrocinadores] = useState([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [enlace, setEnlace] = useState('')
  const [imagenUrl, setImagenUrl] = useState('')
  const [archivoImagen, setArchivoImagen] = useState(null)
  const [tipo, setTipo] = useState('normal')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [editandoId, setEditandoId] = useState(null)

  useEffect(() => {
    cargarPatrocinadores()
  }, [])

  async function cargarPatrocinadores() {
    const { data, error } = await supabase
      .from('patrocinadores')
      .select('*')
      .order('nombre')

    if (error) {
      console.error(error)
      setMensaje('Error al cargar los patrocinadores.')
      return
    }

    setPatrocinadores(data || [])
  }

  function limpiarFormulario() {
    setNombre('')
    setTelefono('')
    setEnlace('')
    setImagenUrl('')
    setArchivoImagen(null)
    setTipo('normal')
    setFechaInicio('')
    setFechaFin('')
    setEditandoId(null)
  }

  async function subirImagen() {
    if (!archivoImagen) {
      return imagenUrl || null
    }

    const extension = archivoImagen.name.split('.').pop()
    const nombreArchivo =
      `${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('patrocinadores')
      .upload(nombreArchivo, archivoImagen)

    if (uploadError) {
      throw uploadError
    }

    const { data } = supabase.storage
      .from('patrocinadores')
      .getPublicUrl(nombreArchivo)

    return data.publicUrl
  }

  async function guardarPatrocinador(e) {
    e.preventDefault()

    if (!nombre.trim()) {
      setMensaje('Escribe el nombre del patrocinador.')
      return
    }

    setGuardando(true)
    setMensaje('')

    try {
      const urlFinal = await subirImagen()

      const datos = {
        nombre: nombre.trim(),
        telefono: telefono.trim() || null,
        enlace: enlace.trim() || null,
        imagen_url: urlFinal,
        tipo,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null
      }

      let error

      if (editandoId) {
        const resultado = await supabase
          .from('patrocinadores')
          .update(datos)
          .eq('id', editandoId)

        error = resultado.error
      } else {
        const resultado = await supabase
          .from('patrocinadores')
          .insert({
            ...datos,
            activo: true
          })

        error = resultado.error
      }

      if (error) {
        throw error
      }

      setMensaje(
        editandoId
          ? 'Patrocinador actualizado correctamente.'
          : 'Patrocinador guardado correctamente.'
      )

      limpiarFormulario()
      await cargarPatrocinadores()
    } catch (error) {
      console.error(error)
      setMensaje(`Error al guardar: ${error.message}`)
    }

    setGuardando(false)
  }

  function editarPatrocinador(patrocinador) {
    setEditandoId(patrocinador.id)
    setNombre(patrocinador.nombre || '')
    setTelefono(patrocinador.telefono || '')
    setEnlace(patrocinador.enlace || '')
    setImagenUrl(patrocinador.imagen_url || '')
    setArchivoImagen(null)
    setTipo(patrocinador.tipo || 'normal')
    setFechaInicio(patrocinador.fecha_inicio || '')
    setFechaFin(patrocinador.fecha_fin || '')
    setMensaje('Editando patrocinador.')

    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function cambiarEstado(patrocinador) {
    const { error } = await supabase
      .from('patrocinadores')
      .update({
        activo: !patrocinador.activo
      })
      .eq('id', patrocinador.id)

    if (error) {
      console.error(error)
      setMensaje(`Error al cambiar estado: ${error.message}`)
      return
    }

    setMensaje(
      patrocinador.activo
        ? 'Patrocinador desactivado.'
        : 'Patrocinador activado.'
    )

    await cargarPatrocinadores()
  }

  async function eliminarPatrocinador(patrocinador) {
    const confirmar = window.confirm(
      `¿Seguro que deseas eliminar a "${patrocinador.nombre}"?`
    )

    if (!confirmar) return

    const { error } = await supabase
      .from('patrocinadores')
      .delete()
      .eq('id', patrocinador.id)

    if (error) {
      console.error(error)
      setMensaje(`Error al eliminar: ${error.message}`)
      return
    }

    if (editandoId === patrocinador.id) {
      limpiarFormulario()
    }

    setMensaje('Patrocinador eliminado correctamente.')
    await cargarPatrocinadores()
  }

  return (
    <main
      style={{
        padding: '32px',
        maxWidth: '1000px',
        margin: '0 auto'
      }}
    >
      <h1>Patrocinadores</h1>
      <p>Administración de patrocinadores de YSASL.</p>

      <form
        onSubmit={guardarPatrocinador}
        style={{
          display: 'grid',
          gap: '14px',
          marginTop: '30px',
          marginBottom: '30px'
        }}
      >
        <div>
          <label><strong>Nombre del negocio</strong></label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label><strong>Teléfono</strong></label>
          <input
            type="text"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label><strong>Enlace / página web</strong></label>
          <input
            type="text"
            value={enlace}
            onChange={(e) => setEnlace(e.target.value)}
            placeholder="https://..."
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label><strong>Logo o imagen del patrocinador</strong></label>

          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const archivo = e.target.files?.[0] || null
              setArchivoImagen(archivo)
            }}
            style={{
              display: 'block',
              marginTop: '8px'
            }}
          />

          {archivoImagen && (
            <p style={{ marginTop: '8px' }}>
              Imagen seleccionada: <strong>{archivoImagen.name}</strong>
            </p>
          )}

          {!archivoImagen && imagenUrl && (
            <div style={{ marginTop: '10px' }}>
              <p>Logo actual:</p>
              <img
                src={imagenUrl}
                alt="Logo del patrocinador"
                style={{
                  maxWidth: '200px',
                  maxHeight: '120px',
                  objectFit: 'contain'
                }}
              />
            </div>
          )}
        </div>

        <div>
          <label><strong>Tipo de patrocinador</strong></label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          >
            <option value="normal">Normal</option>
            <option value="destacado">Destacado</option>
            <option value="principal">Principal</option>
          </select>
        </div>

        <div>
          <label><strong>Fecha de inicio</strong></label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <div>
          <label><strong>Fecha de vencimiento</strong></label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              padding: '10px',
              marginTop: '5px'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={guardando}
          style={{
            padding: '12px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {guardando
            ? 'Guardando...'
            : editandoId
              ? 'Actualizar patrocinador'
              : 'Guardar patrocinador'}
        </button>

        {editandoId && (
          <button
            type="button"
            onClick={() => {
              limpiarFormulario()
              setMensaje('Edición cancelada.')
            }}
            style={{
              padding: '10px',
              cursor: 'pointer'
            }}
          >
            Cancelar edición
          </button>
        )}
      </form>

      {mensaje && (
        <p>
          <strong>{mensaje}</strong>
        </p>
      )}

      <h2>Patrocinadores registrados</h2>

      {patrocinadores.length === 0 ? (
        <p>No hay patrocinadores registrados.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {patrocinadores.map((patrocinador) => (
            <div
              key={patrocinador.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '16px'
              }}
            >
              {patrocinador.imagen_url && (
                <img
                  src={patrocinador.imagen_url}
                  alt={patrocinador.nombre}
                  style={{
                    maxWidth: '180px',
                    maxHeight: '100px',
                    objectFit: 'contain',
                    marginBottom: '10px'
                  }}
                />
              )}

              <div>
                <strong>{patrocinador.nombre}</strong>
              </div>

              {patrocinador.telefono && (
                <div>Teléfono: {patrocinador.telefono}</div>
              )}

              <div>Tipo: {patrocinador.tipo || 'normal'}</div>

              <div>
                Estado: {patrocinador.activo ? 'Activo' : 'Inactivo'}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginTop: '12px'
                }}
              >
                <button
                  type="button"
                  onClick={() => editarPatrocinador(patrocinador)}
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() => cambiarEstado(patrocinador)}
                >
                  {patrocinador.activo ? 'Desactivar' : 'Activar'}
                </button>

                <button
                  type="button"
                  onClick={() => eliminarPatrocinador(patrocinador)}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
