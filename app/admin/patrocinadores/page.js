'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

export default function PatrocinadoresAdminPage() {
  const [patrocinadores, setPatrocinadores] = useState([])
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [enlace, setEnlace] = useState('')
  const [imagenUrl, setImagenUrl] = useState('')
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
    setTipo('normal')
    setFechaInicio('')
    setFechaFin('')
    setEditandoId(null)
  }

  async function guardarPatrocinador(e) {
    e.preventDefault()

    if (!nombre.trim()) {
      setMensaje('Escribe el nombre del patrocinador.')
      return
    }

    setGuardando(true)
    setMensaje('')

    const datos = {
      nombre: nombre.trim(),
      telefono: telefono.trim() || null,
      enlace: enlace.trim() || null,
      imagen_url: imagenUrl.trim() || null,
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
      console.error(error)
      setMensaje(`Error al guardar: ${error.message}`)
      setGuardando(false)
      return
    }

    setMensaje(
      editandoId
        ? 'Patrocinador actualizado correctamente.'
        : 'Patrocinador guardado correctamente.'
    )

    limpiarFormulario()
    await cargarPatrocinadores()
    setGuardando(false)
  }

  function editarPatrocinador(patrocinador) {
    setEditandoId(patrocinador.id)
    setNombre(patrocinador.nombre || '')
    setTelefono(patrocinador.telefono || '')
    setEnlace(patrocinador.enlace || '')
    setImagenUrl(patrocinador.imagen_url || '')
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
          <label><strong>URL del logo o imagen</strong></label>
          <input
            type="text"
            value={imagenUrl}
            onChange={(e) => setImagenUrl(e.target.value)}
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
            style={{ padding: '10px', cursor: 'pointer' }}
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
              <strong>{patrocinador.nombre}</strong>

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
