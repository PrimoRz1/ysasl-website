import { supabase } from '../lib/supabase'

export default async function Home() {
  const { data: divisiones, error } = await supabase
    .from('divisiones')
    .select('id, nombre')
    .order('orden')

  return (
    <main>
      <h1>Yuba Sutter Adult Soccer League</h1>
      <h2>YSASL</h2>
      <p>Sitio oficial de la liga.</p>

      <h3>Divisiones</h3>

      {error && (
        <p>Error conectando con Supabase: {error.message}</p>
      )}

      {divisiones?.map((division) => (
        <p key={division.id}>{division.nombre}</p>
      ))}
    </main>
  )
}
