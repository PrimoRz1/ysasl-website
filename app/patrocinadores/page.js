import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

export default async function PatrocinadoresPage() {
  const { data: patrocinadores, error } = await supabase
    .from('patrocinadores')
    .select('id, nombre, telefono, direccion, descripcion, enlace, imagen_url, tipo, fecha_inicio, fecha_fin')
    .eq('activo', true)
    .order('nombre')

  if (error) {
    console.error(error)
  }

  const hoy = new Date().toISOString().split('T')[0]

  const activos = (patrocinadores || []).filter((p) => {
    const inicioValido = !p.fecha_inicio || p.fecha_inicio <= hoy
    const finValido = !p.fecha_fin || p.fecha_fin >= hoy
    return inicioValido && finValido
  })

  const principales = activos.filter((p) => p.tipo === 'principal')
  const destacados = activos.filter((p) => p.tipo === 'destacado')
  const normales = activos.filter(
    (p) => !p.tipo || p.tipo === 'normal'
  )

  function Tarjeta({ patrocinador, nivel }) {
    const esPrincipal = nivel === 'principal'
    const esDestacado = nivel === 'destacado'

    return (
      <div
        style={{
          border: esPrincipal ? '2px solid #0b2341' : '1px solid #ddd',
          borderRadius: '14px',
          padding: esPrincipal ? '30px' : '22px',
          textAlign: 'center',
          background: '#fff',
          boxShadow: esPrincipal
            ? '0 4px 14px rgba(0,0,0,0.12)'
            : '0 2px 6px rgba(0,0,0,0.06)'
        }}
      >
        {patrocinador.imagen_url && (
          <div
            style={{
              height: esPrincipal ? '190px' : esDestacado ? '150px' : '120px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '15px'
            }}
          >
            <img
              src={patrocinador.imagen_url}
              alt={patrocinador.nombre}
              style={{
                maxWidth: esPrincipal ? '280px' : esDestacado ? '220px' : '180px',
                maxHeight: esPrincipal ? '180px' : esDestacado ? '140px' : '110px',
                objectFit: 'contain'
              }}
            />
          </div>
        )}

        <h2
          style={{
            fontSize: esPrincipal ? '26px' : esDestacado ? '22px' : '19px',
            margin: '8px 0'
          }}
        >
          {patrocinador.nombre}
        </h2>

        {patrocinador.telefono && (
          <p>Teléfono: {patrocinador.telefono}</p>
        )}
{patrocinador.direccion && (
  <p style={{ fontSize: '14px', margin: '6px 0' }}>
    📍 {patrocinador.direccion}
  </p>
)}

{patrocinador.descripcion && (
  <p style={{ fontSize: '14px', margin: '6px 0' }}>
    {patrocinador.descripcion}
  </p>
)}

        {patrocinador.enlace && (
          <a
            href={patrocinador.enlace}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visitar página
          </a>
        )}
      </div>
    )
  }

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '40px 20px'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1>Patrocinadores</h1>
        <p>
          Gracias a los negocios que apoyan a Yuba Sutter Adult Soccer League.
        </p>
      </div>

      {principales.length > 0 && (
        <section style={{ marginBottom: '45px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
            Patrocinadores Principales
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '24px'
            }}
          >
            {principales.map((p) => (
              <Tarjeta key={p.id} patrocinador={p} nivel="principal" />
            ))}
          </div>
        </section>
      )}

      {destacados.length > 0 && (
        <section style={{ marginBottom: '45px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
            Patrocinadores Destacados
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '20px'
            }}
          >
            {destacados.map((p) => (
              <Tarjeta key={p.id} patrocinador={p} nivel="destacado" />
            ))}
          </div>
        </section>
      )}

      {normales.length > 0 && (
        <section>
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>
            Patrocinadores
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '18px'
            }}
          >
            {normales.map((p) => (
              <Tarjeta key={p.id} patrocinador={p} nivel="normal" />
            ))}
          </div>
        </section>
      )}

      {activos.length === 0 && (
        <p style={{ textAlign: 'center' }}>
          No hay patrocinadores activos en este momento.
        </p>
      )}
    </main>
  )
}
