// Identifica el escudo del equipo real a partir de su inscripción al torneo.
// Un equipo puede participar en varias temporadas con el mismo ID y escudo.
function normalizarNombre(nombre) {
  return String(nombre || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export function buscarEquipoConEscudo(nombre, divisionId, equipos, inscripciones) {
  const candidatos = (equipos || []).filter((equipo) =>
    normalizarNombre(equipo.nombre) === normalizarNombre(nombre) &&
    (equipo.escudo_url || equipo.logo_url || equipo.escudo_path)
  )
  if (candidatos.length === 0) return null

  // La división del torneo se relaciona mediante inscripciones_equipo;
  // equipos.division_id puede pertenecer a una temporada anterior.
  const inscritos = candidatos.filter((equipo) => (inscripciones || []).some(
    (inscripcion) => Number(inscripcion.equipo_id) === Number(equipo.id) &&
      Number(inscripcion.division_id) === Number(divisionId)
  ))
  if (inscritos.length === 1) return inscritos[0]
  if (inscritos.length > 1) return null

  // Compatibilidad con registros anteriores.
  const porDivisionAntigua = candidatos.filter((equipo) =>
    Number(equipo.division_id) === Number(divisionId)
  )
  if (porDivisionAntigua.length === 1) return porDivisionAntigua[0]
  if (porDivisionAntigua.length > 1) return null

  // Si hay un solo equipo con ese nombre, su escudo es inequívoco
  // aunque la consulta pública de inscripciones no esté disponible.
  return candidatos.length === 1 ? candidatos[0] : null
}
