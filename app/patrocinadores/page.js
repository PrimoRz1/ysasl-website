
import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

export default async function PatrocinadoresPage() {
  const { data: patrocinadores, error } = await supabase
    .from('patrocinadores')
    .select('id, nombre, telefono, direccion, descripcion, enlace, imagen_url, tipo, fecha_inicio, fecha_fin')
    .eq('activo', true)
    .order('nombre')

  if (error) console.error('Error cargando patrocinadores:', error)

  const hoy = new Date().toISOString().split('T')[0]

  const activos = (patrocinadores || []).filter((p) => {
    return (
      (!p.fecha_inicio || p.fecha_inicio <= hoy) &&
      (!p.fecha_fin || p.fecha_fin >= hoy)
    )
  })

  const principales = activos.filter((p) => p.tipo === 'principal')
  const destacados = activos.filter((p) => p.tipo === 'destacado')
  const normales = activos.filter(
    (p) => !p.tipo || p.tipo === 'normal'
  )

  function Tarjeta({ patrocinador, nivel }) {
    const principal = nivel === 'principal'
    const destacado = nivel === 'destacado'

    return (
      <article style={{
        border: principal ? '2px solid #0b2948' : '1px solid #ddd',
        borderRadius: '12px',
        background: '#fff',
        padding: '20px',
        textAlign: 'center',
        boxShadow: principal
          ? '0 4px 12px rgba(0,0,0,0.1)'
          : '0 2px 6px rgba(0,0,0,0.05)'
      }}>
        {patrocinador.imagen_url && (
          <img
            src={patrocinador.imagen_url}
            alt={`Logotipo de ${patrocinador.nombre}`}
            style={{
              display: 'block',
              width: '100%',
              maxWidth: principal ? '240px' : destacado ? '190px' : '150px',
              height: principal ? '130px' : destacado ? '110px' : '90px',
              objectFit: 'contain',
              margin: '0 auto 12px'
            }}
          />
        )}

        <h3 style={{
          fontSize: principal ? '23px' : destacado ? '20px' : '18px',
          margin: '8px 0'
        }}>
          {patrocinador.nombre}
        </h3>

        {patrocinador.telefono && (
          <p style={{ margin: '6px 0', fontSize: '14px' }}>
            📞 <a href={`tel:${patrocinador.telefono.replace(/[^\d+]/g, '')}`}>
              {patrocinador.telefono}
            </a>
          </p>
        )}

        {patrocinador.direccion && (
          <p style={{ margin: '6px 0', fontSize: '14px' }}>
            📍 {patrocinador.direccion}
          </p>
        )}

        {patrocinador.descripcion && (
          <p style={{
            margin: '10px auto',
            fontSize: '14px',
            lineHeight: '1.5',
            maxWidth: '450px'
          }}>
            {patrocinador.descripcion}
          </p>
        )}

        {patrocinador.enlace && (
          <a
            href={patrocinador.enlace}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: '10px',
              padding: '9px 16px',
              background: '#0b2948',
              color: '#fff',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: '13px'
            }}
          >
            Visitar negocio
          </a>
        )}
      </article>
    )
  }

  function Seccion({ titulo, lista, nivel, ancho }) {
    if (lista.length === 0) return null

    return (
      <section style={{ marginBottom: '36px' }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '20px',
          fontSize: '22px'
        }}>
          {titulo}
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${ancho}px), 1fr))`,
          gap: '20px'
        }}>
          {lista.map((p) => (
            <Tarjeta
              key={p.id}
              patrocinador={p}
              nivel={nivel}
            />
          ))}
        </div>
      </section>
    )
  }

  return (
    <main style={{
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '30px 20px'
    }}>
      <header style={{
        textAlign: 'center',
        marginBottom: '32px'
      }}>
        <h1>Patrocinadores</h1>
        <p>
          Gracias a los negocios que apoyan a
          Yuba Sutter Adult Soccer League.
        </p>
      </header>

      <Seccion
        titulo="Patrocinadores Principales"
        lista={principales}
        nivel="principal"
        ancho={320}
      />

      <Seccion
        titulo="Patrocinadores Destacados"
        lista={destacados}
        nivel="destacado"
        ancho={260}
      />

      <Seccion
        titulo="Patrocinadores"
        lista={normales}
        nivel="normal"
        ancho={220}
      />

      {activos.length === 0 && (
        <p style={{ textAlign: 'center' }}>
          No hay patrocinadores activos en este momento.
        </p>
      )}
    </main>
  )
}
