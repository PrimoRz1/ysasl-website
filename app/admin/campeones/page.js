
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const campo = {
  width: '100%',
  padding: '12px',
  border: '1px solid #ccc',
  borderRadius: '8px',
  marginTop: '6px',
  boxSizing: 'border-box',
}

const nombresPosicion = {
  campeon: '🥇 Campeón',
  subcampeon: '🥈 Subcampeón',
  tercer_lugar: '🥉 Tercer lugar',
}

export default function AdminCampeones() {
  const [autorizado, setAutorizado] = useState(null)
  const [temporada, setTemporada] = useState('')
  const [division, setDivision] = useState('')
  const [equipo, setEquipo] = useState('')
  const [posicion, setPosicion] = useState('campeon')
  const [foto, setFoto] = useState(null)
  const [campeones, setCampeones] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')

  useEffect(() => {
    async function iniciar() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setAutorizado(false)
        return
      }

      const { data, error } = await supabase.rpc('es_admin')

      if (error || data !== true) {
        setAutorizado(false)
        return
      }

      setAutorizado(true)
      cargarCampeones()
    }

    iniciar()
  }, [])

  async function cargarCampeones() {
    const { data, error } = await supabase
      .from('campeones')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setMensaje('Error al cargar finalistas: ' + error.message)
      return
    }

    setCampeones(data || [])
  }

  async function guardar(e) {
    e.preventDefault()

    if (!foto) {
      setMensaje('Selecciona una fotografía.')
      return
    }

    const tipos = ['image/jpeg', 'image/png', 'image/webp']

    if (!tipos.includes(foto.type)) {
      setMensaje('La foto debe ser JPG, PNG o WEBP.')
      return
    }

    if (foto.size > 10 * 1024 * 1024) {
      setMensaje('La foto no puede superar 10 MB.')
      return
    }

    setGuardando(true)
    setMensaje('Subiendo fotografía...')

    try {
      const extension = foto.name.split('.').pop().toLowerCase()
      const ruta = `${crypto.randomUUID()}.${extension}`

      const { error: errorFoto } = await supabase.storage
        .from('fotos-finalistas')
        .upload(ruta, foto, {
          contentType: foto.type,
          upsert: false,
        })

      if (errorFoto) throw errorFoto

      const { error: errorRegistro } = await supabase
        .from('campeones')
        .insert({
          temporada: temporada.trim(),
          division: division.trim(),
          equipo: equipo.trim(),
          posicion,
          foto_path: ruta,
        })

      if (errorRegistro) {
        setMensaje(
          'La foto se subió, pero no se guardó el registro: ' +
          errorRegistro.message +
          '. Archivo: ' + ruta
        )
        return
      }

      setMensaje('¡Fotografía del finalista registrada correctamente!')
      setTemporada('')
      setDivision('')
      setEquipo('')
      setPosicion('campeon')
      setFoto(null)
      e.target.reset()
      await cargarCampeones()
    } catch (error) {
      setMensaje('Error: ' + error.message)
    } finally {
      setGuardando(false)
    }
  }

  if (autorizado === null) {
    return <main style={{ padding: 24 }}>Verificando acceso...</main>
  }

  if (!autorizado) {
    return <main style={{ padding: 24 }}>Acceso solo para administradores.</main>
  }

  return (
    <main style={{ maxWidth: 900, margin: 'auto', padding: 24 }}>
      <h1>🏆 Administración de Finalistas</h1>
      <p>
        Agrega fotografías del campeón, subcampeón y tercer lugar de YSASL.
        Las fotografías de temporadas anteriores se conservan.
      </p>

      <form
        onSubmit={guardar}
        style={{
          display: 'grid',
          gap: 16,
          padding: 20,
          border: '1px solid #ddd',
          borderRadius: 12,
          marginTop: 24,
        }}
      >
        <label>
          Temporada
          <input
            style={campo}
            value={temporada}
            onChange={e => setTemporada(e.target.value)}
            placeholder="Ej. Primavera 2027"
            required
          />
        </label>

        <label>
          División
          <input
            style={campo}
            value={division}
            onChange={e => setDivision(e.target.value)}
            placeholder="Ej. Primera División"
            required
          />
        </label>

        <label>
          Posición
          <select
            style={campo}
            value={posicion}
            onChange={e => setPosicion(e.target.value)}
            required
          >
            <option value="campeon">🥇 Campeón</option>
            <option value="subcampeon">🥈 Subcampeón</option>
            <option value="tercer_lugar">🥉 Tercer lugar</option>
          </select>
        </label>

        <label>
          Nombre del equipo
          <input
            style={campo}
            value={equipo}
            onChange={e => setEquipo(e.target.value)}
            placeholder="Nombre del equipo"
            required
          />
        </label>

        <label>
          Fotografía del equipo
          <input
            style={campo}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={e => setFoto(e.target.files?.[0] || null)}
            required
          />
        </label>

        <button
          type="submit"
          disabled={guardando}
          style={{
            padding: 14,
            background: '#166534',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          {guardando ? 'Guardando...' : 'Subir foto del finalista'}
        </button>
      </form>

      {mensaje && <p style={{ marginTop: 20 }}>{mensaje}</p>}

      <h2 style={{ marginTop: 40 }}>Finalistas registrados</h2>

      {campeones.length === 0 && <p>Todavía no hay finalistas registrados.</p>}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: 20,
      }}>
        {campeones.map(c => {
          const url = supabase.storage
            .from('fotos-finalistas')
            .getPublicUrl(c.foto_path).data.publicUrl

          return (
            <div key={c.id} style={{
              border: '1px solid #ddd',
              borderRadius: 12,
              overflow: 'hidden',
            }}>
              <img
                src={url}
                alt={c.equipo}
                style={{ width: '100%', height: 180, objectFit: 'cover' }}
              />
              <div style={{ padding: 14 }}>
                <strong>{nombresPosicion[c.posicion] || '🏆 Campeón'}</strong>
                <p><strong>{c.equipo}</strong></p>
                <p>{c.division}</p>
                <p>{c.temporada}</p>
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}
