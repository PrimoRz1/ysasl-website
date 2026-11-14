'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import './print.css'

const MAX_JUGADORES = 25

function ordenarJugadores(a, b) {
  const aNumero = a.numero !== null && a.numero !== undefined && a.numero !== ''
  const bNumero = b.numero !== null && b.numero !== undefined && b.numero !== ''
  if (aNumero && bNumero && Number(a.numero) !== Number(b.numero)) {
    return Number(a.numero) - Number(b.numero)
  }
  if (aNumero !== bNumero) return aNumero ? -1 : 1
  return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es')
}

export default function ImprimirPlantillaPage() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [error, setError] = useState('')
  const [equipos, setEquipos] = useState([])
  const [divisiones, setDivisiones] = useState([])
  const [temporadas, setTemporadas] = useState([])
  const [inscripciones, setInscripciones] = useState([])
  const [equipoId, setEquipoId] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [jugadores, setJugadores] = useState([])
  const [cargandoJugadores, setCargandoJugadores] = useState(false)
  const [errorJugadores, setErrorJugadores] = useState('')
  const [fecha, setFecha] = useState('')
  const [jornada, setJornada] = useState('')

  useEffect(() => {
    let vigente = true

    async function iniciar() {
      try {
        const { data: auth, error: errorAuth } = await supabase.auth.getUser()
        if (errorAuth || !auth.user) {
          router.replace('/login')
          return
        }

        const [resPerfil, resPermisos] = await Promise.all([
          supabase.from('perfiles').select('rol').eq('id', auth.user.id).maybeSingle(),
          supabase.from('delegados_equipo')
            .select('equipo_id')
            .eq('usuario_id', auth.user.id)
            .eq('activo', true)
        ])
        if (resPerfil.error) throw resPerfil.error
        if (resPermisos.error) throw resPermisos.error
        if (!vigente) return

        const esAdmin = resPerfil.data?.rol === 'admin'
        const equiposAsignados = new Set((resPermisos.data || []).map(
          (permiso) => Number(permiso.equipo_id)
        ))
        if (!esAdmin && equiposAsignados.size === 0) {
          router.replace('/mis-paneles')
          return
        }

        const [resEquipos, resDivisiones, resTemporadas, resInscripciones] = await Promise.all([
          supabase.from('equipos').select('id, nombre, division_id').order('nombre'),
          supabase.from('divisiones').select('id, nombre, temporada_id'),
          supabase.from('temporadas').select('id, nombre, activa'),
          supabase.from('inscripciones_equipo')
            .select('equipo_id, division_id')
            .eq('activo', true)
        ])

        const fallo = [resEquipos, resDivisiones, resTemporadas, resInscripciones]
          .find((resultado) => resultado.error)
        if (fallo) throw fallo.error
        if (!vigente) return

        const equiposPermitidos = (resEquipos.data || []).filter(
          (equipo) => esAdmin || equiposAsignados.has(Number(equipo.id))
        )
        setEquipos(equiposPermitidos)
        setDivisiones(resDivisiones.data || [])
        setTemporadas(resTemporadas.data || [])
        setInscripciones(resInscripciones.data || [])

        const equipoUrl = new URLSearchParams(window.location.search).get('equipo')
        const equipoSolicitado = equiposPermitidos.find(
          (equipo) => String(equipo.id) === equipoUrl
        )
        if (equipoSolicitado) {
          setEquipoId(String(equipoSolicitado.id))
        } else if (!esAdmin && equiposPermitidos.length > 0) {
          setEquipoId(String(equiposPermitidos[0].id))
        }

        setAutorizado(true)
      } catch (err) {
        if (vigente) setError('No se pudo preparar la hoja: ' + (err.message || 'Error desconocido.'))
      } finally {
        if (vigente) setVerificando(false)
      }
    }

    iniciar()
    return () => { vigente = false }
  }, [router])

  const equipoSeleccionado = equipos.find((equipo) => String(equipo.id) === equipoId)

  const divisionesEquipo = (() => {
    if (!equipoSeleccionado) return []
    const ids = new Set(inscripciones
      .filter((inscripcion) => Number(inscripcion.equipo_id) === Number(equipoId))
      .map((inscripcion) => Number(inscripcion.division_id)))

    // Para equipos sin inscripción activa, mostrar la división registrada en su ficha.
    if (ids.size === 0 && equipoSeleccionado.division_id) {
      ids.add(Number(equipoSeleccionado.division_id))
    }

    return divisiones.filter((division) => ids.has(Number(division.id)))
      .sort((a, b) => {
        const torneoA = temporadas.find((torneo) => Number(torneo.id) === Number(a.temporada_id))
        const torneoB = temporadas.find((torneo) => Number(torneo.id) === Number(b.temporada_id))
        return Number(Boolean(torneoB?.activa)) - Number(Boolean(torneoA?.activa)) ||
          Number(b.temporada_id) - Number(a.temporada_id)
      })
  })()

  useEffect(() => {
    setDivisionId((actual) => (
      divisionesEquipo.some((division) => String(division.id) === actual)
        ? actual
        : (divisionesEquipo[0] ? String(divisionesEquipo[0].id) : '')
    ))
  }, [equipoId, inscripciones, divisiones, temporadas, equipos])

  useEffect(() => {
    if (!autorizado || !equipoSeleccionado) {
      setJugadores([])
      setErrorJugadores('')
      setCargandoJugadores(false)
      return
    }

    let vigente = true
    setCargandoJugadores(true)
    setJugadores([])
    setErrorJugadores('')

    async function cargarPlantilla() {
      const { data, error: errorConsulta } = await supabase.from('jugadores')
        .select('id, equipo_id, nombre, numero')
        .eq('equipo_id', Number(equipoId))
        .eq('activo', true)
        .order('nombre')

      if (!vigente) return
      if (errorConsulta) {
        setErrorJugadores('No se pudo cargar la plantilla: ' + errorConsulta.message)
      } else {
        setJugadores((data || []).sort(ordenarJugadores))
      }
      setCargandoJugadores(false)
    }

    cargarPlantilla()
    return () => { vigente = false }
  }, [autorizado, equipoId, equipos])

  const divisionSeleccionada = divisionesEquipo.find(
    (division) => String(division.id) === divisionId
  )
  const temporadaSeleccionada = temporadas.find(
    (torneo) => Number(torneo.id) === Number(divisionSeleccionada?.temporada_id)
  )
  const filas = Array.from({ length: MAX_JUGADORES }, (_, indice) => jugadores[indice] || null)
  const excesoJugadores = jugadores.length > MAX_JUGADORES
  const listaPreparada = autorizado && equipoSeleccionado && !cargandoJugadores &&
    !errorJugadores && !excesoJugadores

  function imprimir() {
    if (!listaPreparada) return
    window.print()
  }

  if (verificando) {
    return <main style={{ padding: 30 }}>Verificando acceso a la plantilla...</main>
  }

  if (!autorizado) {
    return (
      <main style={{ maxWidth: 850, margin: '40px auto', padding: 20 }}>
        <h1>Imprimir plantilla</h1>
        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
        <button type="button" onClick={() => router.push('/mis-paneles')}>
          Volver a mis paneles
        </button>
      </main>
    )
  }

  return (
    <main className="pagina-plantilla-arbitros">
      <section className="controles-plantilla no-print">
        <h1>Imprimir plantilla para árbitros</h1>
        <p>
          Hoja de asistencia con 25 renglones. Los jugadores activos aparecen
          automáticamente; los espacios restantes quedan en blanco para anotaciones a mano.
        </p>

        <div className="campos-control-plantilla">
          <label>
            Equipo
            <select
              value={equipoId}
              onChange={(evento) => {
                setEquipoId(evento.target.value)
                setDivisionId('')
              }}
            >
              <option value="">Seleccionar equipo</option>
              {equipos.map((equipo) => (
                <option key={equipo.id} value={equipo.id}>{equipo.nombre}</option>
              ))}
            </select>
          </label>

          <label>
            Torneo y división
            <select
              value={divisionId}
              onChange={(evento) => setDivisionId(evento.target.value)}
              disabled={!equipoId || divisionesEquipo.length === 0}
            >
              {divisionesEquipo.length === 0 && <option value="">Sin división asignada</option>}
              {divisionesEquipo.map((division) => {
                const torneo = temporadas.find(
                  (item) => Number(item.id) === Number(division.temporada_id)
                )
                return (
                  <option key={division.id} value={division.id}>
                    {(torneo?.nombre || 'Torneo') + ' — ' + division.nombre}
                  </option>
                )
              })}
            </select>
          </label>

          <label>
            Fecha del partido
            <input type="date" value={fecha} onChange={(evento) => setFecha(evento.target.value)} />
          </label>

          <label>
            Jornada
            <input
              type="text"
              value={jornada}
              onChange={(evento) => setJornada(evento.target.value)}
              maxLength={35}
              placeholder="Ejemplo: 5"
            />
          </label>
        </div>

        {cargandoJugadores && <p>Cargando jugadores activos...</p>}
        {errorJugadores && <p role="alert" style={{ color: '#b91c1c' }}>{errorJugadores}</p>}
        {excesoJugadores && (
          <p role="alert" style={{ color: '#b91c1c', fontWeight: 'bold' }}>
            Este equipo tiene {jugadores.length} jugadores activos. El límite es 25.
            Corrige la plantilla antes de imprimir para no omitir a nadie.
          </p>
        )}
        {equipoSeleccionado && !cargandoJugadores && !errorJugadores && !excesoJugadores && (
          <p>Jugadores registrados: <strong>{jugadores.length}</strong>. Renglones en blanco: <strong>{MAX_JUGADORES - jugadores.length}</strong>.</p>
        )}

        <div className="botones-plantilla">
          <button type="button" onClick={imprimir} disabled={!listaPreparada}>
            Imprimir plantilla
          </button>
          <button type="button" onClick={() => router.back()} className="boton-volver-plantilla">
            Regresar
          </button>
        </div>
      </section>

      {listaPreparada && (
        <article className="hoja-plantilla" aria-label="Hoja de control de asistencia para árbitros">
          <div className="encabezado-plantilla">
            <div>
              <div className="marca-plantilla">YSASL</div>
              <div className="subtitulo-plantilla">Yuba Sutter Adult Soccer League</div>
            </div>
            <div className="tipo-plantilla">CONTROL DE ASISTENCIA</div>
          </div>

          <div className="datos-plantilla">
            <div><strong>Equipo:</strong> {equipoSeleccionado.nombre}</div>
            <div><strong>División:</strong> {divisionSeleccionada?.nombre || '________________'}</div>
            <div><strong>Torneo:</strong> {temporadaSeleccionada?.nombre || '________________'}</div>
            <div><strong>Fecha:</strong> {fecha ? `${fecha.slice(5, 7)}/${fecha.slice(8, 10)}/${fecha.slice(0, 4)}` : '____ / ____ / ______'}</div>
            <div><strong>Jornada:</strong> {jornada.trim() || '____________'}</div>
          </div>

          <table className="tabla-plantilla">
            <thead>
              <tr>
                <th className="columna-orden">N.º</th>
                <th className="columna-camiseta">Camiseta</th>
                <th>Nombre del jugador</th>
                <th className="columna-presente">Presente ✓</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((jugador, indice) => (
                <tr key={jugador?.id || 'blanco-' + indice}>
                  <td className="celda-centro">{indice + 1}</td>
                  <td className="celda-centro">{jugador?.numero ?? ''}</td>
                  <td>{jugador?.nombre || ''}</td>
                  <td className="celda-centro"><span className="casilla-asistencia" aria-hidden="true" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="nota-plantilla">
            Marcar con una palomita a los jugadores presentes. Los renglones vacíos
            son para anotaciones manuales y no sustituyen el registro oficial en YSASL.
          </p>
        </article>
      )}
    </main>
  )
}
