
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function AdminInscripciones() {
  const router = useRouter()
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [procesando, setProcesando] = useState(null)
  const [mensaje, setMensaje] = useState('')

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
      await cargarSolicitudes()
    }

    iniciar()
  }, [router])

  async function cargarSolicitudes() {
    setCargando(true)

    const { data, error } = await supabase
      .from('solicitudes_inscripcion')
      .select('id, nombre_equipo, representante, telefono, correo, estado, created_at, temporada_id, division_id, temporadas(nombre), divisiones(nombre)')
      .order('created_at', { ascending: false })

    if (error) {
      setMensaje('Error al cargar solicitudes: ' + error.message)
    } else {
      setSolicitudes(data || [])
    }

    setCargando(false)
  }

  async function cambiarEstado(id, estado) {
    if (!window.confirm(
      `¿Confirmas que deseas ${estado === 'aprobada' ? 'aprobar' : 'rechazar'} esta solicitud?`
    )) return

    setProcesando(id)
    setMensaje('')

    const { data, error } = await supabase
      .from('solicitudes_inscripcion')
      .update({ estado })
      .eq('id', id)
      .eq('estado', 'pendiente')
      .select('id')

    if (error) {
      setMensaje('No se pudo actualizar: ' + error.message)
    } else if (!data?.length) {
      setMensaje('La solicitud ya fue modificada. Actualiza la lista.')
    } else {
      setMensaje(`Solicitud ${estado} correctamente.`)
      await cargarSolicitudes()
    }

    setProcesando(null)
  }

  if (!autorizado) {
    return <main style={{ padding: 30 }}>Verificando acceso...</main>
  }

  return (
    <main style={{ maxWidth: 1100, margin: '40px auto', padding: 20 }}>
      <h1>Solicitudes de inscripción</h1>
      <p>Revisa las solicitudes enviadas por los equipos de YSASL.</p>

      <button onClick={cargarSolicitudes} disabled={cargando}>
        Actualizar lista
      </button>

      {mensaje && <p role="status">{mensaje}</p>}

      {cargando ? (
        <p>Cargando solicitudes...</p>
      ) : solicitudes.length === 0 ? (
        <p>No hay solicitudes registradas.</p>
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
              <p><strong>Correo:</strong> {s.correo}</p>
              <p><strong>Estado:</strong> {s.estado}</p>
              <p>
                <strong>Fecha:</strong>{' '}
                {new Date(s.created_at).toLocaleDateString('es-US')}
              </p>

              {s.estado === 'pendiente' && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <button
                    disabled={procesando !== null}
                    onClick={() => cambiarEstado(s.id, 'aprobada')}
                    style={{ background: '#16803c', color: 'white', padding: 10 }}
                  >
                    Aprobar
                  </button>
                  <button
                    disabled={procesando !== null}
                    onClick={() => cambiarEstado(s.id, 'rechazada')}
                    style={{ background: '#b91c1c', color: 'white', padding: 10 }}
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
