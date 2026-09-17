import { supabase } from '../lib/supabase'

export default async function Home() {
  const { data: divisiones, error: errorDivisiones } = await supabase
    .from('divisiones')
    .select('id, nombre')
    .order('orden')

  const { data: equipos, error: errorEquipos } = await supabase
    .from('equipos')
    .select('id, nombre, division_id')
    .eq('activo', true)
    .order('nombre')

  return (
    <main>
      <h1>Yuba Sutter Adult Soccer League</h1>
      <h2>YSASL</h2>
      <p>Sitio oficial de la liga.</p>

      {(errorDivisiones || errorEquipos) && (
        <p>
          Error conectando con Supabase:
          {' '}
          {errorDivisiones?.message || errorEquipos?.message}
        </p>
      )}

      {divisiones?.map((division) => (
        <section key={division.id}>
          <h2>{division.nombre}</h2>

          {equipos
            ?.filter((equipo) => equipo.division_id === division.id)
            .map((equipo) => (
              <p key={equipo.id}>{equipo.nombre}</p>
            ))}
        </section>
      ))}
    </main>
  )
}
