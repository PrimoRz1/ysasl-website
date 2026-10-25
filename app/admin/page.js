'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

export default function AdminPage() {
  const router = useRouter()
  const [verificando, setVerificando] = useState(true)
  const [autorizado, setAutorizado] = useState(false)
  const [cerrandoSesion, setCerrandoSesion] = useState(false)
  const [errorSalida, setErrorSalida] = useState('')

  useEffect(() => {
    let activo = true

    async function verificarAcceso() {
      try {
        const {
          data: { user },
          error: errorAuth
        } = await supabase.auth.getUser()

        if (!activo) return

        if (errorAuth || !user) {
          router.replace('/login')
          return
        }

        const { data: perfil, error } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', user.id)
          .single()

        if (!activo) return

        if (error || !perfil || perfil.rol !== 'admin') {
          await supabase.auth.signOut()
          router.replace('/login')
          return
        }

        setAutorizado(true)
      } catch (err) {
        if (activo) {
          setErrorSalida('No se pudo verificar el acceso: ' + (err.message || 'Error desconocido.'))
        }
      } finally {
        if (activo) setVerificando(false)
      }
    }

    verificarAcceso()
    return () => { activo = false }
  }, [router])

  async function cerrarSesion() {
    if (cerrandoSesion) return

    setCerrandoSesion(true)
    setErrorSalida('')

    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      router.replace('/login')
      router.refresh()
    } catch (err) {
      setErrorSalida('No se pudo cerrar sesión: ' + (err.message || 'Inténtalo nuevamente.'))
      setCerrandoSesion(false)
    }
  }

  if (verificando) {
    return (
      <main style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>
        <p>Verificando acceso...</p>
      </main>
    )
  }

  if (!autorizado) {
    return errorSalida ? (
      <main style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>
        <p role="alert" style={{ color: '#b91c1c' }}>{errorSalida}</p>
        <Link href="/login">Ir a iniciar sesión</Link>
      </main>
    ) : null
  }

  return (
    <main style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>
      <h1>Panel de Administración</h1>
      <p>Yuba Sutter Adult Soccer League</p>
      <Link
  href="/mis-paneles"
  style={{
    display: 'inline-block',
    background: '#166534',
    color: 'white',
    padding: '12px 18px',
    borderRadius: '6px',
    textDecoration: 'none',
    fontWeight: 'bold',
    marginTop: '10px',
    marginRight: '12px'
  }}
>
  🔄 Mis Paneles
</Link>

      <button
        type="button"
        onClick={cerrarSesion}
        disabled={cerrandoSesion}
        style={{
          background: '#0b2948',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '12px 18px',
          cursor: cerrandoSesion ? 'wait' : 'pointer',
          fontWeight: 'bold',
          marginTop: '10px'
        }}
      >
        {cerrandoSesion ? 'Cerrando sesión...' : 'Cerrar sesión'}
      </button>

      {errorSalida && (
        <p role="alert" style={{ color: '#b91c1c' }}>{errorSalida}</p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginTop: '35px'
        }}
      >
        <AdminCard titulo="Equipos" descripcion="Administrar equipos de la liga" href="/admin/equipos" />
        <AdminCard titulo="Jugadores" descripcion="Agregar y editar jugadores" href="/admin/jugadores" />
        <AdminCard titulo="Partidos" descripcion="Programar partidos y jornadas" href="/admin/partidos" />
        <AdminCard titulo="Jornadas" descripcion="Crear jornadas manualmente y reprogramar calendarios" href="/admin/jornadas" />
        <AdminCard titulo="Resultados" descripcion="Registrar resultados" href="/admin/resultados" />
        <AdminCard titulo="Liguilla" descripcion="Ver clasificaciones y programación de liguilla" href="/admin/liguilla" />
        <AdminCard titulo="📸 Fotografías de Finalistas" descripcion="Subir fotos del campeón, subcampeón y tercer lugar" href="/admin/campeones" />
        <AdminCard titulo="Disciplina" descripcion="Tarjetas y suspensiones" href="/admin/disciplina" />
        <AdminCard titulo="Patrocinadores" descripcion="Administrar patrocinadores" href="/admin/patrocinadores" />
        <AdminCard titulo="Torneos" descripcion="Crear y administrar torneos y divisiones" href="/admin/temporadas" />
        <AdminCard
          titulo="Configurar torneo completo"
          descripcion="Crear torneos, divisiones, inscribir equipos y generar calendarios"
          href="/admin/configurar-torneo"
        />
        <AdminCard titulo="Inscripciones" descripcion="Revisar y aprobar solicitudes de equipos" href="/admin/inscripciones" />
        
<AdminCard
  titulo="👥 Administrar Usuarios"
  descripcion="Administrar usuarios, permisos generales y delegados de equipos"
  href="/admin/usuarios"
/>

      </div>
    </main>
  )
}

function AdminCard({ titulo, descripcion, href }) {
  return (
    <Link
      href={href || '#'}
      style={{
        border: '1px solid #ddd',
        borderRadius: '10px',
        padding: '24px',
        background: 'white',
        textDecoration: 'none',
        color: 'inherit',
        display: 'block'
      }}
    >
      <h2 style={{ marginTop: 0 }}>{titulo}</h2>
      <p>{descripcion}</p>
    </Link>
  )
}
