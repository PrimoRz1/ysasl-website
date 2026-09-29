'use client'

export default function TemporadasPage() {
  return (
    <main style={{ maxWidth: '1000px', margin: '40px auto', padding: '20px' }}>
      <h1>Administrar Torneos</h1>

      <p>
        Desde aquí podrás crear y administrar los torneos de YSASL.
      </p>

      <button
        style={{
          padding: '12px 20px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer'
        }}
      >
        + Crear nuevo torneo
      </button>
    </main>
  )
}
