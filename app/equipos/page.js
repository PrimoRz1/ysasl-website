import { supabase } from '../../lib/supabase'
import Link from 'next/link'
export const dynamic = 'force-dynamic'

export default async function EquiposPage() {
  const { data: divisiones, error: errorDivisiones } = await supabase
    .from('divisiones')
    .select('id, nombre')
    .order('orden')

  const { data: inscripciones, error: errorInscripciones } = await supabase
    .from('inscripciones_equipo')
    .select('id, equipo_id, division_id')
    .eq('activo', true)

  const { data: equipos, error: errorEquipos } = await supabase
    .from('equipos')
    .select('id, nombre, escudo_url, activo')
    .eq('activo', true)
    .order('nombre')

  const hayError =
    errorDivisiones || errorInscripciones || errorEquipos

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '40px 20px',
      }}
    >
      <h1 style={{ fontSize: '32px', marginBottom: '8px' }}>
        Equipos
      </h1>

      <p style={{ marginBottom: '35px' }}>
        Yuba Sutter Adult Soccer League
      </p>

      {hayError && (
        <p>
          Error conectando con Supabase:{' '}
          {errorDivisiones?.message ||
            errorInscripciones?.message ||
            errorEquipos?.message}
        </p>
      )}

      {divisiones?.map((division) => {
        const equiposDivision = inscripciones
          ?.filter(
            (inscripcion) =>
              inscripcion.division_id === division.id
          )
          .map((inscripcion) =>
            equipos?.find(
              (equipo) => equipo.id === inscripcion.equipo_id
            )
          )
          .filter(Boolean)
          .sort((a, b) =>
            a.nombre.localeCompare(b.nombre)
          )

        return (
          <section
            key={division.id}
            style={{ marginBottom: '45px' }}
          >
            <h2 style={{ marginBottom: '20px' }}>
              {division.nombre}
            </h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '18px',
              }}
            >
              {equiposDivision?.map((equipo) => (
                <Link
  href={`/equipos/${equipo.id}`}
                  key={equipo.id}
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: '10px',
                    padding: '22px',
                    textAlign: 'center',
                    background: 'white',
                  }}
                >
                  {equipo.escudo_url ? (
                    <img
                      src={equipo.escudo_url}
                      alt={equipo.nombre}
                      style={{
                        width: '70px',
                        height: '70px',
                        objectFit: 'contain',
                        marginBottom: '12px',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '70px',
                        height: '70px',
                        borderRadius: '50%',
                        background: '#0b2341',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '22px',
                        margin: '0 auto 12px',
                      }}
                    >
                      {equipo.nombre.charAt(0)}
                    </div>
                  )}

                  <strong style={{ fontSize: '17px' }}>
                    {equipo.nombre}
                  </strong>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}
