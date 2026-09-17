import { supabase } from '../lib/supabase'

export default async function Home() {
  const { data: divisiones, error: errorDivisiones } = await supabase
    .from('divisiones')
    .select('id, nombre')
    .order('orden')

  const { data: inscripciones, error: errorInscripciones } = await supabase
    .from('inscripciones_equipo')
    .select(`
      id,
      division_id,
      equipos (
        id,
        nombre,
        activo
      )
    `)
    .eq('activo', true)

  return (
    <main>
      <h1>Yuba Sutter Adult Soccer League</h1>
      <h2>YSASL</h2>
      <p>Sitio oficial de la liga.</p>

      {(errorDivisiones || errorInscripciones) && (
        <p>
          Error conectando con Supabase:{' '}
          {errorDivisiones?.message || errorInscripciones?.message}
        </p>
      )}

      {divisiones?.map((division) => (
        <section key={division.id}>
          <h2>{division.nombre}</h2>

          {inscripciones
            ?.filter(
              (inscripcion) =>
                inscripcion.division_id === division.id &&
                inscripcion.equipos?.activo
            )
            .sort((a, b) =>
              a.equipos.nombre.localeCompare(b.equipos.nombre)
            )
            .map((inscripcion) => (
              <p key={inscripcion.id}>
                {inscripcion.equipos.nombre}
              </p>
            ))}
        </section>
      ))}
    </main>
  )
}
