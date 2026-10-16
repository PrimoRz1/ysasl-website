'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../../lib/supabase'

// Solo se leen los resultados de la liguilla. Esta pantalla NO modifica partidos.
// Cada foto nueva crea un registro; las fotografías anteriores se conservan.
const PUESTOS = [
  { codigo: 'campeon', titulo: '🥇 Campeón' },
  { codigo: 'subcampeon', titulo: '🥈 Subcampeón' },
  { codigo: 'tercer_lugar', titulo: '🥉 Tercer lugar' },
]
const PODIO_VACIO = { campeon: null, subcampeon: null, tercer_lugar: null }
const campo = {
  width: '100%', padding: 12, border: '1px solid #cbd5e1',
  borderRadius: 8, marginTop: 6, boxSizing: 'border-box',
}
const tarjeta = {
  border: '1px solid #d5dbe2', borderRadius: 12, padding: 18,
  background: '#fafafa', minWidth: 0,
}

function resolverPartido(partido) {
  if (!partido || partido.estado !== 'finalizado' ||
      partido.goles_local == null || partido.goles_visitante == null) return null
  const local = Number(partido.goles_local)
  const visitante = Number(partido.goles_visitante)
  const localId = Number(partido.local_id)
  const visitanteId = Number(partido.visitante_id)
  if (!Number.isInteger(local) || !Number.isInteger(visitante) ||
      local < 0 || visitante < 0 || local === visitante ||
      !Number.isInteger(localId) || !Number.isInteger(visitanteId) ||
      localId <= 0 || visitanteId <= 0 || localId === visitanteId) return null
  return {
    ganadorId: local > visitante ? localId : visitanteId,
    perdedorId: local > visitante ? visitanteId : localId,
  }
}

function urlFoto(ruta) {
  if (!ruta) return ''
  return supabase.storage.from('fotos-finalistas').getPublicUrl(ruta).data.publicUrl
}

export default function AdminCampeones() {
  const [autorizado, setAutorizado] = useState(null)
  const [temporadas, setTemporadas] = useState([])
  const [divisiones, setDivisiones] = useState([])
  const [temporadaId, setTemporadaId] = useState('')
  const [divisionId, setDivisionId] = useState('')
  const [podio, setPodio] = useState(PODIO_VACIO)
  const [cargandoResultados, setCargandoResultados] = useState(false)
  const [errorResultados, setErrorResultados] = useState('')
  const [errorInicial, setErrorInicial] = useState('')
  const [fotos, setFotos] = useState({})
  const [versionInputs, setVersionInputs] = useState(0)
  const [campeones, setCampeones] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    async function iniciar() {
      try {
        const { data: { user }, error: errorUsuario } = await supabase.auth.getUser()
        if (!vigente) return
        if (errorUsuario || !user) { setAutorizado(false); return }
        const { data: esAdmin, error: errorAdmin } = await supabase.rpc('es_admin')
        if (!vigente) return
        if (errorAdmin || esAdmin !== true) { setAutorizado(false); return }
        setAutorizado(true)

        const [resTemporadas, resDivisiones, resCampeones] = await Promise.all([
          supabase.from('temporadas').select('id,nombre,activa').order('id', { ascending: false }),
          supabase.from('divisiones').select('id,nombre,temporada_id').order('id'),
          supabase.from('campeones').select('id,temporada,division,equipo,posicion,foto_path,created_at')
            .order('created_at', { ascending: false }),
        ])
        if (!vigente) return
        if (resTemporadas.error || resDivisiones.error || resCampeones.error) {
          throw new Error([resTemporadas.error, resDivisiones.error, resCampeones.error]
            .filter(Boolean).map((e) => e.message).join(' | '))
        }
        const lista = resTemporadas.data || []
        setTemporadas(lista)
        setDivisiones(resDivisiones.data || [])
        setCampeones(resCampeones.data || [])
        // Primero probamos en PRUEBA YSASL 2027; nunca seleccionamos 2026 por defecto.
        const prueba = lista.find((t) => Number(t.id) === 9)
        if (prueba) setTemporadaId(String(prueba.id))
      } catch (error) {
        if (vigente) setErrorInicial(error.message || 'No se pudieron cargar los datos.')
      } finally {
        if (vigente) setAutorizado((actual) => actual === null ? false : actual)
      }
    }
    iniciar()
    return () => { vigente = false }
  }, [])

  const temporadaActual = temporadas.find((t) => String(t.id) === temporadaId)
  const divisionActual = divisiones.find((d) => String(d.id) === divisionId)
  const divisionesDisponibles = useMemo(() => divisiones.filter(
    (d) => String(d.temporada_id) === temporadaId
  ), [divisiones, temporadaId])

  useEffect(() => {
    setDivisionId('')
  }, [temporadaId])

  useEffect(() => {
    let vigente = true
    setPodio(PODIO_VACIO)
    setErrorResultados('')
    setFotos({})
    setVersionInputs((n) => n + 1)
    setMensaje('')
    if (!divisionId) return

    const division = divisiones.find((d) => String(d.id) === divisionId)
    if (!division || String(division.temporada_id) !== temporadaId) return

    async function cargarPodio() {
      setCargandoResultados(true)
      try {
        // Mismo origen de resultados que Admin > Liguilla; solo lectura.
        const { data: partidos, error: errorPartidos } = await supabase
          .from('partidos')
          .select('id,fase,estado,goles_local,goles_visitante,local_id,visitante_id,jornadas!inner(division_id)')
          .eq('jornadas.division_id', Number(divisionId))
          .in('fase', ['final', 'tercer_lugar'])
        if (errorPartidos) throw errorPartidos
        if (!vigente) return

        const finales = (partidos || []).filter((p) => p.fase === 'final')
        const terceros = (partidos || []).filter((p) => p.fase === 'tercer_lugar')
        if (finales.length > 1 || terceros.length > 1) {
          throw new Error('Hay finales o partidos de tercer lugar duplicados. Revisa la Liguilla.')
        }
        const final = resolverPartido(finales[0])
        const tercero = resolverPartido(terceros[0])
        const ids = [...new Set([
          final?.ganadorId, final?.perdedorId, tercero?.ganadorId,
        ].filter(Boolean))]
        let nombres = new Map()
        if (ids.length) {
          const { data: equipos, error: errorEquipos } = await supabase
            .from('equipos').select('id,nombre').in('id', ids)
          if (errorEquipos) throw errorEquipos
          nombres = new Map((equipos || []).map((e) => [Number(e.id), e.nombre]))
        }
        if (!vigente) return
        const equipo = (id) => id && nombres.has(id)
          ? { id, nombre: nombres.get(id) } : null
        setPodio({
          campeon: equipo(final?.ganadorId),
          subcampeon: equipo(final?.perdedorId),
          tercer_lugar: equipo(tercero?.ganadorId),
        })
        if (!final || !tercero) {
          setErrorResultados('Solo se habilitan las fotografías de puestos definidos por partidos finalizados sin empate. Si hubo penales, primero debe registrarse el ganador.')
        }
      } catch (error) {
        if (vigente) setErrorResultados('No se pudo consultar el Podio: ' + error.message)
      } finally {
        if (vigente) setCargandoResultados(false)
      }
    }
    cargarPodio()
    return () => { vigente = false }
  }, [divisionId, temporadaId, divisiones, recarga])

  async function cargarCampeones() {
    const { data, error } = await supabase.from('campeones')
      .select('id,temporada,division,equipo,posicion,foto_path,created_at')
      .order('created_at', { ascending: false })
    if (error) throw error
    setCampeones(data || [])
  }

  async function guardar(evento) {
    evento.preventDefault()
    setMensaje('')
    if (!temporadaActual || !divisionActual || cargandoResultados || guardando) return
    const seleccionados = PUESTOS.filter((p) => fotos[p.codigo])
    if (!seleccionados.length) {
      setMensaje('Selecciona al menos una fotografía.')
      return
    }
    if (seleccionados.some((p) => !podio[p.codigo])) {
      setMensaje('Hay fotografías para puestos que todavía no están definidos.')
      return
    }
    const extensiones = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
    for (const p of seleccionados) {
      const archivo = fotos[p.codigo]
      if (!extensiones[archivo.type] || archivo.size > 10 * 1024 * 1024) {
        setMensaje(`${p.titulo}: usa una foto JPG, PNG o WEBP de máximo 10 MB.`)
        return
      }
    }
    if (!window.confirm(`¿Guardar ${seleccionados.length} fotografía(s) para ${temporadaActual.nombre} — ${divisionActual.nombre}?\n\nLos partidos y resultados NO se modificarán.`)) return

    setGuardando(true)
    const exitos = []
    const fallos = []
    try {
      for (const p of seleccionados) {
        const archivo = fotos[p.codigo]
        const equipo = podio[p.codigo]
        const ruta = `${crypto.randomUUID()}.${extensiones[archivo.type]}`
        try {
          const { error: errorFoto } = await supabase.storage
            .from('fotos-finalistas')
            .upload(ruta, archivo, { contentType: archivo.type, upsert: false })
          if (errorFoto) throw errorFoto
          const { error: errorRegistro } = await supabase.from('campeones').insert({
            temporada: temporadaActual.nombre,
            division: divisionActual.nombre,
            equipo: equipo.nombre,
            posicion: p.codigo,
            foto_path: ruta,
          })
          if (errorRegistro) {
            throw new Error(`${errorRegistro.message}. Foto almacenada: ${ruta}`)
          }
          exitos.push(p.titulo)
        } catch (error) {
          fallos.push(`${p.titulo}: ${error.message}`)
        }
      }
      if (exitos.length) {
        try { await cargarCampeones() }
        catch (error) { fallos.push('La galería no se actualizó: ' + error.message) }
      }
      // Se limpian las selecciones para evitar volver a subir una foto por accidente.
      setFotos({})
      setVersionInputs((n) => n + 1)
      setMensaje([
        exitos.length ? `✓ Guardadas: ${exitos.join(', ')}.` : '',
        fallos.length ? `⚠ No guardadas: ${fallos.join(' | ')}. Selecciona nuevamente solo las que fallaron.` : '',
      ].filter(Boolean).join(' '))
    } finally {
      setGuardando(false)
    }
  }

  if (autorizado === null) return <main style={{ padding: 24 }}>Verificando acceso...</main>
  if (!autorizado) return <main style={{ padding: 24 }}>
    Acceso solo para administradores. {errorInicial}
  </main>

  return (
    <main style={{ maxWidth: 1100, margin: '30px auto', padding: '0 20px 40px' }}>
      <a href="/admin" style={{ display: 'inline-block', marginBottom: 18 }}>← Volver a Administración</a>
      <h1>📸 Fotografías de Finalistas</h1>
      <p>Los nombres se obtienen automáticamente de los resultados de la Liguilla. No necesitas escribirlos.</p>
      <p><strong>Seguridad:</strong> aquí solo se guardan fotografías. No se modifican partidos, resultados ni temporadas.</p>

      <div style={tarjeta}>
        <label htmlFor="temporada"><strong>Temporada</strong></label>
        <select id="temporada" style={campo} value={temporadaId}
          onChange={(e) => setTemporadaId(e.target.value)} disabled={guardando}>
          <option value="">Selecciona temporada</option>
          {temporadas.map((t) => <option key={t.id} value={String(t.id)}>{t.nombre}</option>)}
        </select>
        <label htmlFor="division" style={{ display: 'block', marginTop: 16 }}><strong>División</strong></label>
        <select id="division" style={campo} value={divisionId}
          onChange={(e) => setDivisionId(e.target.value)} disabled={guardando || !temporadaId}>
          <option value="">Selecciona división</option>
          {divisionesDisponibles.map((d) =>
            <option key={d.id} value={String(d.id)}>{d.nombre}</option>)}
        </select>
        {divisionId && <button type="button" onClick={() => setRecarga((n) => n + 1)}
          disabled={guardando || cargandoResultados} style={{ marginTop: 12 }}>
          Actualizar resultados
        </button>}
      </div>

      {cargandoResultados && <p>Consultando resultados de la final y tercer lugar...</p>}
      {errorResultados && divisionId && <p style={{ color: '#9a6700' }}>{errorResultados}</p>}
      {divisionId && !cargandoResultados && <form onSubmit={guardar} style={{ marginTop: 22 }}>
        <h2>🏆 Podio automático — subir fotografías</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
          {PUESTOS.map((p) => <div key={p.codigo} style={tarjeta}>
            <h3 style={{ marginTop: 0 }}>{p.titulo}</h3>
            <p style={{ minHeight: 44, fontWeight: 'bold' }}>
              {podio[p.codigo]?.nombre || 'Por definir'}
            </p>
            <label htmlFor={`foto-${p.codigo}`}>Fotografía del equipo</label>
            <input key={`${versionInputs}-${p.codigo}`} id={`foto-${p.codigo}`}
              type="file" accept="image/jpeg,image/png,image/webp"
              disabled={!podio[p.codigo] || guardando}
              onChange={(e) => setFotos((actual) => ({
                ...actual, [p.codigo]: e.target.files?.[0] || null,
              }))} style={campo} />
          </div>)}
        </div>
        <button type="submit" disabled={guardando || cargandoResultados ||
          !PUESTOS.some((p) => fotos[p.codigo] && podio[p.codigo])}
          style={{ marginTop: 20, padding: '12px 24px', border: 0, borderRadius: 8,
            background: '#166534', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          {guardando ? 'Guardando fotografías...' : 'Guardar fotografías seleccionadas'}
        </button>
        <p style={{ color: '#555' }}>Puedes subir una, dos o tres fotografías a la vez. Las anteriores se conservan.</p>
      </form>}
      {mensaje && <p style={{ marginTop: 20, fontWeight: 'bold' }}>{mensaje}</p>}

      <h2 style={{ marginTop: 40 }}>Fotografías registradas — historial</h2>
      <p>Se conservan las fotografías de temporadas anteriores y las pruebas existentes.</p>
      {campeones.length === 0 && <p>Todavía no hay fotografías registradas.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18 }}>
        {campeones.map((c) => <div key={c.id} style={{ ...tarjeta, padding: 0, overflow: 'hidden' }}>
          {c.foto_path && <img src={urlFoto(c.foto_path)} alt={c.equipo}
            style={{ width: '100%', height: 180, objectFit: 'cover' }} />}
          <div style={{ padding: 14 }}>
            <strong>{PUESTOS.find((p) => p.codigo === c.posicion)?.titulo ||
              (c.posicion === 'tercero' ? '🥉 Tercer lugar' : '🏆 Campeón')}</strong>
            <p><strong>{c.equipo}</strong></p>
            <p>{c.division}</p>
            <p>{c.temporada}</p>
          </div>
        </div>)}
      </div>
    </main>
  )
}
