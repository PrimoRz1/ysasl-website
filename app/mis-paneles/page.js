'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function MisPanelesPage() {
  const router = useRouter()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [esAdmin, setEsAdmin] = useState(false)
  const [equipos, setEquipos] = useState([])

  useEffect(() => {
    let activo = true
    async function verificarAccesos() {
      try {
        const { data: auth, error: errorAuth } = await supabase.auth.getUser()
        if (!activo) return
        if (errorAuth) throw errorAuth
        if (!auth.user) {
          router.replace('/login')
          return
        }

        const [resPerfil, resEquipos] = await Promise.all([
          supabase.from('perfiles')
            .select('rol')
            .eq('id', auth.user.id)
            .maybeSingle(),
          supabase.from('delegados_equipo')
            .select('equipo_id, equipos(nombre)')
            .eq('usuario_id', auth.user.id)
            .eq('activo', true)
        ])
        if (!activo) return
        if (resPerfil.error) throw resPerfil.error
        if (resEquipos.error) throw resEquipos.error
        setEsAdmin(resPerfil.data?.rol === 'admin')
        setEquipos(resEquipos.data || [])
      } catch (err) {
        if (activo) setError('No se pudieron verificar tus permisos: ' + (err.message || 'Error desconocido.'))
      } finally {
        if (activo) setCargando(false)
      }
    }
    verificarAccesos()
    return () => { activo = false }
  }, [router])

  const boton = {
    width: '100%', padding: '16px', textAlign: 'left',
    borderRadius: '10px', border: '1px solid #cbd5e1',
    background: 'white', cursor: 'pointer', marginBottom: '12px',
    fontSize: '16px', color: '#0b2948', fontWeight: 'bold'
  }

  if (cargando) return <main style={{ padding: 30 }}>Verificando tus accesos...</main>

  return (
    <main style={{ maxWidth: '600px', margin: '55px auto', padding: '24px' }}>
      <h1>Seleccionar mi panel</h1>
      <p>Yuba Sutter Adult Soccer League</p>
      <p>Utiliza una sola cuenta para acceder a los paneles que tienes autorizados.</p>
      {error ? (
        <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>
      ) : (
        <>
          {esAdmin && (
            <button type="button" style={boton} onClick={() => router.push('/admin')}>
              🛡️ Administración General
            </button>
          )}
          {equipos.length > 0 && (
            <button type="button" style={boton} onClick={() => router.push('/delegado')}>
              👥 Administrador de Equipo
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'normal', marginTop: '5px' }}>
                {equipos.map(e => e.equipos?.nombre || `Equipo #${e.equipo_id}`).join(', ')}
              </span>
            </button>
          )}
          <button type="button" style={boton} onClick={() => router.push('/jugador')}>
            ⚽ Mi Panel de Jugador
          </button>
          <p style={{ fontSize: '13px', color: '#475569' }}>
            El panel de jugador no te incorpora automáticamente a una plantilla.
            Los permisos de administrador y las asignaciones de equipo se gestionan por separado.
          </p>
        </>
      )}
    </main>
  )
}
