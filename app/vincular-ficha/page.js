'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

export default function VincularFichaPage() {
  return <Suspense fallback={<p>Cargando ficha…</p>}><VincularFicha /></Suspense>
}

function VincularFicha() {
  const id = useSearchParams().get('jugador')
  const valido = /^[1-9]\d*$/.test(id || '') && Number.isSafeInteger(Number(id))
  const [ficha, setFicha] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    let activo = true
    async function cargar() {
      if (!valido) throw new Error('La ficha no está disponible.')
      const [fichaRes, authRes] = await Promise.all([
        supabase.from('jugadores').select('nombre, equipo_id, equipos(nombre)')
          .eq('id', Number(id)).eq('activo', true).maybeSingle(),
        supabase.auth.getUser()
      ])
      if (fichaRes.error || !fichaRes.data) throw new Error('La ficha no está disponible.')
      if (!activo) return
      setFicha(fichaRes.data)
      const cuenta = authRes.data?.user
      setUsuario(cuenta || null)
      if (cuenta) {
        const { data, error: consulta } = await supabase.from('solicitudes_vinculacion')
          .select('estado').eq('usuario_id', cuenta.id).eq('jugador_id', Number(id))
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (consulta) throw consulta
        if (activo) setEstado(data?.estado || '')
      }
    }
    setCargando(true)
    setError('')
    setEstado('')
    cargar().catch(err => {
      if (activo) setError(err.message)
    }).finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [id, valido])

  async function solicitar() {
    if (enviando || !valido || !usuario) return
    setEnviando(true)
    setError('')
    try {
      const { error: rechazo } = await supabase.rpc('solicitar_vinculacion', { p_jugador_id: Number(id) })
      if (rechazo) throw rechazo
      setEstado('pendiente')
    } catch (err) {
      setError(err.message || 'No se pudo enviar la solicitud.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main style={{ maxWidth: 540, margin: '48px auto', padding: '0 20px' }}>
      <h1>Vincula tu cuenta</h1>
      {cargando ? <p>Cargando ficha…</p> : ficha && (
        <>
          <p><strong>{ficha.nombre}</strong> · {ficha.equipos?.nombre || 'Equipo #' + ficha.equipo_id}</p>
          {estado === 'pendiente' ? <p role="status">Solicitud enviada. El delegado de tu equipo debe aprobarla.</p>
            : estado === 'aprobada' ? <div><p role="status">Tu cuenta está vinculada a esta ficha.</p><Link href="/jugador">Ir a Mi Panel de Jugador</Link></div>
              : usuario ? (
                <button type="button" disabled={enviando} onClick={solicitar}>
                  {enviando ? 'Enviando…' : 'Solicitar vinculación'}
                </button>
              ) : (
                <p><Link href={`/login?tipo=jugador&ficha=${id}`}>Inicia sesión</Link> con tu correo confirmado, o <Link href={`/registro?ficha=${id}`}>crea tu cuenta</Link> para solicitar la vinculación.</p>
              )}
          <p><Link href={`/equipos/${ficha.equipo_id}`}>Volver al equipo</Link></p>
        </>
      )}
      {error && <p role="alert">{error}</p>}
    </main>
  )
}
