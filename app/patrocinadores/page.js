import { supabase } from '../../lib/supabase'

export const dynamic = 'force-dynamic'

export default async function PatrocinadoresPage() {
  const { data: patrocinadores, error } = await supabase
    .from('patrocinadores')
    .select('id, nombre, telefono, enlace, imagen_url, tipo')
    .eq('activo', true)
    .order('nombre')

  if (error) {
    console.error(error)
  }

  const lista = patrocinadores || []

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '40px 20px'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '35px' }}>
        <h1>Patrocinadores</h1>
        <p>
          Gracias a los negocios que apoyan a Yuba Sutter Adult Soccer League.
        </p>
      </div>

      {lista.length === 0 ? (
        <p style={{ textAlign: 'center' }}>
          No hay patrocinadores activos en este momento.
        </p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px'
          }}
        >
          {lista.map((patrocinador) => (
            <div
              key={patrocinador.id}
              style={{
                border: '1px solid #ddd',
                borderRadius: '12px',
                padding: '22px',
                textAlign: 'center',
                background: '#fff'
              }}
            >
              {patrocinador.imagen_url && (
                <div
                  style={{
                    height: '140px',
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
                      maxWidth: '200px',
                      maxHeight: '130px',
                      objectFit: 'contain'
                    }}
                  />
                </div>
              )}

              <h2 style={{ marginBottom: '10px' }}>
                {patrocinador.nombre}
              </h2>

              {patrocinador.telefono && (
                <p>
                  Teléfono: {patrocinador.telefono}
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
          ))}
        </div>
      )}
    </main>
  )
}
