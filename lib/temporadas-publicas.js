// Solo torneos y divisiones reales; nunca mostrar simulaciones en páginas públicas.
function esPrueba(nombre) {
  return /prueba|simulaci[oó]n|test/i.test(String(nombre || ''))
}

export function filtrarTemporadasOficiales(temporadas) {
  return (temporadas || []).filter((temporada) =>
    Number(temporada.id) !== 9 && !esPrueba(temporada.nombre)
  )
}

export function filtrarDivisionesOficiales(divisiones, temporadas) {
  const idsTemporadas = new Set((temporadas || []).map((t) => Number(t.id)))
  return (divisiones || []).filter((division) =>
    ![12, 13].includes(Number(division.id)) &&
    idsTemporadas.has(Number(division.temporada_id)) &&
    !esPrueba(division.nombre)
  )
}

// Invierno 2026 (id 10) es el torneo vigente inicial. Cuando se active
// un torneo posterior que ya tenga divisiones, la portada cambiará a él.
// La temporada histórica id 1 nunca se borra ni se modifica.
export function seleccionarTemporadaVigente(temporadas, divisiones) {
  const conDivisiones = (temporadas || [])
    .filter((temporada) => (divisiones || []).some(
      (division) => Number(division.temporada_id) === Number(temporada.id)
    ))
    .sort((a, b) => Number(b.id) - Number(a.id))

  return conDivisiones.find((temporada) =>
    Number(temporada.id) >= 10 && temporada.activa === true
  ) ||
    conDivisiones.find((temporada) => Number(temporada.id) === 10) ||
    conDivisiones.find((temporada) => temporada.activa === true) ||
    conDivisiones[0] ||
    null
}
