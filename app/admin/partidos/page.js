'use client'

import { useRouter } from 'next/navigation'

export default function AdminPartidosPage() {
  const router = useRouter()

  return (
    <main
      style={{
        maxWidth: '1100px',
        margin: '40px auto',
        padding: '0 20px'
      }}
    >
      <button
        onClick={() => router.push('/admin')}
        style={{
          marginBottom: '25px',
          padding: '10px 16px',
          cursor: 'pointer'
        }}
      >
        ← Volver al panel
      </button>

      <h1>Administrar Partidos</h1>

      <p>
        Programa y administra los partidos de Yuba Sutter Adult Soccer League.
      </p>

      <div
        style={{
          marginTop: '30px',
          padding: '24px',
          border: '1px solid #ddd',
          borderRadius: '10px',
          maxWidth: '700px'
        }}
      >
        <h2>Programar partido</h2>

        <p>
          Aquí podremos seleccionar los equipos, jornada, fecha, hora y campo.
        </p>
      </div>
    </main>
  )
}
