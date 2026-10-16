
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const posiciones = [
  { id: 'campeon', nombre: '🥇 Campeón' },
  { id: 'subcampeon', nombre: '🥈 Subcampeón' },
  { id: 'tercer_lugar', nombre: '🥉 Tercer lugar' },
]

export default function CampeonesPage() {
  const [registros, setRegistros] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [temporada, setTemporada] = useState('todas')
  const [division, setDivision] = useState('todas')

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data, error } = await supabase
        .from('campeones')
        .select('id, temporada, division, equipo, posicion, foto_path, created_at')
        .order('created_at', { ascending: false })

      if (!activo) return

      if (error) {
        setError('No se pudieron cargar los campeones: ' + error.message)
      } else {
        // Los equipos de prueba no aparecen en la página pública.
        setRegistros((data || []).filter(r => !/prueba/i.test(r.temporada || '')))
      }
      setCargando(false)
    }

    cargar()
    return () => { activo = false }
  }, [])

  const temporadas = [...new Set(registros.map(r => r.temporada).filter(Boolean))]
  const divisiones = [...new Set(
    registros
      .filter(r => temporada === 'todas' || r.temporada === temporada)
      .map(r => r.division)
      .filter(Boolean)
  )]

  const filtrados = registros.filter(r =>
    (temporada === 'todas' || r.temporada === temporada) &&
    (division === 'todas' || r.division === division)
  )

  const grupos = []
  for (const registro of filtrados) {
    let grupo = grupos.find(g =>
      g.temporada === registro.temporada && g.division === registro.division
    )
    if (!grupo) {
      grupo = { temporada: registro.temporada, division: registro.division, registros: [] }
      grupos.push(grupo)
    }
    grupo.registros.push(registro)
  }

  const estiloSelector = {
    padding: 10,
    border: '1px solid #ccc',
    borderRadius: 8,
    width: '100%',
    marginTop: 6,
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1>🏆 Campeones de YSASL</h1>
      <p>Conoce a nuestros campeones, subcampeones y terceros lugares.</p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        margin: '28px 0',
      }}>
        <label>
          Temporada
          <select
            style={estiloSelector}
            value={temporada}
            onChange={e => { setTemporada(e.target.value); setDivision('todas') }}
          >
            <option value="todas">Todas las temporadas</option>
            {temporadas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>
          División
          <select
            style={estiloSelector}
            value={division}
            onChange={e => setDivision(e.target.value)}
          >
            <option value="todas">Todas las divisiones</option>
            {divisiones.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
      </div>

      {cargando && <p>Cargando campeones...</p>}
      {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
      {!cargando && !error && grupos.length === 0 && (
        <p>Próximamente publicaremos las fotografías de nuestros campeones.</p>
      )}

      {grupos.map(grupo => (
        <section key={`${grupo.temporada}-${grupo.division}`} style={{ marginBottom: 40 }}>
          <h2 style={{ borderBottom: '2px solid #166534', paddingBottom: 10 }}>
            {grupo.temporada} — {grupo.division}
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 18,
            marginTop: 20,
          }}>
            {posiciones.map(lugar => {
              const equipo = grupo.registros.find(r =>
                (r.posicion || 'campeon') === lugar.id
              )
              const fotoUrl = equipo?.foto_path
                ? supabase.storage.from('fotos-finalistas').getPublicUrl(equipo.foto_path).data.publicUrl
                : null

              return (
                <article key={lugar.id} style={{
                  border: '1px solid #ddd',
                  borderRadius: 12,
                  overflow: 'hidden',
                  textAlign: 'center',
                  background: '#fff',
                }}>
                  <h3 style={{ padding: '16px 12px 0' }}>{lugar.nombre}</h3>
                  {fotoUrl ? (
                    <img
                      src={fotoUrl}
                      alt={`Fotografía de ${equipo.equipo}`}
                      style={{ width: '100%', height: 210, objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{
                      height: 210,
                      background: '#f3f4f6',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#666',
                    }}>
                      📷 Fotografía pendiente
                    </div>
                  )}
                  <p style={{ padding: '0 12px 16px', fontWeight: 'bold' }}>
                    {equipo?.equipo || 'Por definir'}
                  </p>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </main>
  )
}
