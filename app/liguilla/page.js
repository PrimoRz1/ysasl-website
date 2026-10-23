// Página pública de liguilla. Conserva los selectores y podio existentes
// mediante el componente cliente PodioLiguilla; añade el cuadro oficial 2026.
import { supabase } from '../../lib/supabase'
import LiguillaCuadro from '../LiguillaCuadro'
import PodioLiguilla from './PodioLiguilla'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Liguilla | Yuba Sutter Adult Soccer League',
  description: 'Cuadro oficial, resultados, campeones y tercer lugar de la liguilla YSASL.',
}

const TEMPORADA_OFICIAL_2026 = 1

function tipoDivision(nombre) {
  const texto = String(nombre || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (texto.includes('primera')) return 'primera'
  if (texto.includes('segunda')) return 'segunda'
  return null
}

export default async function LiguillaPublicaPage({ searchParams }) {
  const parametros = await searchParams
  const idSolicitado = Number(parametros?.temporada)
  const temporadaId = Number.isInteger(idSolicitado) && idSolicitado > 0
    ? idSolicitado : TEMPORADA_OFICIAL_2026
  const divisionSolicitada = Number(parametros?.divisionId)

  // Solo se consulta el catálogo. La página y el cuadro son de solo lectura.
  const { data: divisiones, error } = await supabase.from('divisiones')
    .select('id,nombre,temporada_id,orden')
    .eq('temporada_id', temporadaId)
    .order('orden')

  if (error) console.error('No se pudieron consultar las divisiones de liguilla:', error.message)
  const disponibles = divisiones || []
  const seleccionada = disponibles.find((d) => Number(d.id) === divisionSolicitada) ||
    (temporadaId === TEMPORADA_OFICIAL_2026
      ? disponibles.find((d) => tipoDivision(d.nombre) === 'segunda') : null) ||
    disponibles[0]
  const divisionId = Number(seleccionada?.id || 0)
  const tipo = tipoDivision(seleccionada?.nombre)

  return (
    <PodioLiguilla temporadaInicial={temporadaId} divisionIdInicial={divisionId}>
      {temporadaId === TEMPORADA_OFICIAL_2026 && tipo && (
        <LiguillaCuadro division={tipo} />
      )}
    </PodioLiguilla>
  )
}
