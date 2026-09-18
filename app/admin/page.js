export default function AdminPage() {
  return (
    <main style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>
      <h1>Panel de Administración</h1>
      <p>Yuba Sutter Adult Soccer League</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginTop: '35px'
        }}
      >
        <AdminCard titulo="Equipos" descripcion="Administrar equipos de la liga" />
        <AdminCard titulo="Jugadores" descripcion="Agregar y editar jugadores" />
        <AdminCard titulo="Partidos" descripcion="Programar partidos y jornadas" />
        <AdminCard titulo="Resultados" descripcion="Registrar resultados" />
        <AdminCard titulo="Disciplina" descripcion="Tarjetas y suspensiones" />
        <AdminCard titulo="Patrocinadores" descripcion="Administrar patrocinadores" />
      </div>
    </main>
  )
}

function AdminCard({ titulo, descripcion }) {
  return (
    <div
      style={{
        border: '1px solid #ddd',
        borderRadius: '10px',
        padding: '24px',
        background: 'white'
      }}
    >
      <h2 style={{ marginTop: 0 }}>{titulo}</h2>
      <p>{descripcion}</p>
    </div>
  )
}
