
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function InscripcionesPage() {
  const [torneos, setTorneos] = useState([])
  const [divisiones, setDivisiones] = useState([])
  const [torneoId, setTorneoId] = useState('')
  const [divisionId, setDivisionId] = useState('')

  const [nombreEquipo, setNombreEquipo] = useState('')
  const [representante, setRepresentante] = useState('')
  const [telefono, setTelefono] = useState('')
  const [correo, setCorreo] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')

  useEffect(() => {
    async function cargarOpciones() {
      try {
        const [resultadoTorneos, resultadoDivisiones] =
          await Promise.all([
            supabase
              .from('temporadas')
              .select('id, nombre')
              
              .order('id', { ascending: false }),

            supabase
              .from('divisiones')
              .select('id, nombre, temporada_id')
            .eq('inscripciones_abiertas', true)
              .order('orden', { ascending: true })
          ])

        if (resultadoTorneos.error) {
          throw resultadoTorneos.error
        }

        if (resultadoDivisiones.error) {
          throw resultadoDivisiones.error
        }

        const divisionesAbiertas = resultadoDivisiones.data || []

const torneosDisponibles = (resultadoTorneos.data || []).filter(
  (torneo) =>
    divisionesAbiertas.some(
      (division) =>
        Number(division.temporada_id) === Number(torneo.id)
    )
)

setTorneos(torneosDisponibles)
setDivisiones(divisionesAbiertas)
      } catch (error) {
        console.error(error)
        setErrorCarga(
          'No se pudieron cargar los torneos. Intenta nuevamente.'
        )
      } finally {
        setCargando(false)
      }
    }

    cargarOpciones()
  }, [])

  const divisionesDisponibles = divisiones.filter(
    (division) => String(division.temporada_id) === torneoId
  )

  async function enviarSolicitud(e) {
    e.preventDefault()
    setMensaje('')

    const torneoValido = torneos.some(
      (torneo) => String(torneo.id) === torneoId
    )

    const divisionValida = divisionesDisponibles.some(
      (division) => String(division.id) === divisionId
    )

    if (!torneoValido || !divisionValida) {
      setMensaje('Selecciona un torneo y una división válidos.')
      return
    }

    setGuardando(true)

    try {
      const { error } = await supabase
        .from('solicitudes_inscripcion')
        .insert({
          temporada_id: Number(torneoId),
          division_id: Number(divisionId),
          nombre_equipo: nombreEquipo.trim(),
          representante: representante.trim(),
          telefono: telefono.trim(),
          correo: correo.trim() || null,
          estado: 'pendiente'
        })

      if (error) throw error

      setMensaje(
        'Solicitud enviada correctamente. La liga revisará tu inscripción.'
      )

      setTorneoId('')
      setDivisionId('')
      setNombreEquipo('')
      setRepresentante('')
      setTelefono('')
      setCorreo('')
    } catch (error) {
      console.error(error)
      setMensaje(
        'No se pudo enviar la solicitud. Comunícate con la administración.'
      )
    } finally {
      setGuardando(false)
    }
  }

  const campo = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px',
    marginTop: '6px',
    marginBottom: '18px',
    border: '1px solid #ccc',
    borderRadius: '6px'
  }

  return (
    <main
      style={{
        maxWidth: '650px',
        margin: '40px auto',
        padding: '20px'
      }}
    >
      <h1>Inscribir mi equipo</h1>

      <p>
        Selecciona el torneo y la división donde deseas
        inscribir a tu equipo en Yuba Sutter Adult Soccer League.
      </p>

      {cargando && <p>Cargando torneos disponibles...</p>}

      {errorCarga && (
        <p role="alert" style={{ color: 'red' }}>
          {errorCarga}
        </p>
      )}

      {!cargando && !errorCarga && torneos.length === 0 && (
        <p>
          Actualmente no hay torneos con inscripciones abiertas.
        </p>
      )}

      {!cargando && !errorCarga && torneos.length > 0 && (
        <form onSubmit={enviarSolicitud}>
          <label>
            Torneo *
            <select
              style={campo}
              required
              value={torneoId}
              onChange={(e) => {
                setTorneoId(e.target.value)
                setDivisionId('')
              }}
            >
              <option value="">Selecciona un torneo</option>
              {torneos.map((torneo) => (
                <option key={torneo.id} value={torneo.id}>
                  {torneo.nombre}
                </option>
              ))}
            </select>
          </label>

          <label>
            División *
            <select
              style={campo}
              required
              value={divisionId}
              disabled={!torneoId}
              onChange={(e) => setDivisionId(e.target.value)}
            >
              <option value="">Selecciona una división</option>
              {divisionesDisponibles.map((division) => (
                <option key={division.id} value={division.id}>
                  {division.nombre}
                </option>
              ))}
            </select>
          </label>

          {torneoId && divisionesDisponibles.length === 0 && (
            <p>
              Este torneo todavía no tiene divisiones disponibles.
            </p>
          )}

          <label>
            Nombre del equipo *
            <input
              style={campo}
              required
              value={nombreEquipo}
              onChange={(e) => setNombreEquipo(e.target.value)}
            />
          </label>

          <label>
            Nombre del representante *
            <input
              style={campo}
              required
              value={representante}
              onChange={(e) => setRepresentante(e.target.value)}
            />
          </label>

          <label>
            Teléfono *
            <input
              style={campo}
              type="tel"
              required
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </label>

          <label>
            Correo electrónico (opcional)
            <input
              style={campo}
              type="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
            />
          </label>

          <button
            type="submit"
            disabled={guardando || !divisionId}
            style={{
              background: '#0b2341',
              color: 'white',
              padding: '13px 22px',
              border: 'none',
              borderRadius: '6px',
              cursor: guardando ? 'wait' : 'pointer'
            }}
          >
            {guardando ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>
      )}

      {mensaje && (
        <p role="status" style={{ marginTop: '20px' }}>
          {mensaje}
        </p>
      )}
    </main>
  )
}
