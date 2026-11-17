'use client'

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useSuspensionesPlantilla(jugadores) {
  const [resultado, setResultado] = useState(null)

  useEffect(() => {
    if (jugadores.length === 0) return
    let vigente = true

    async function cargar() {
      try {
        const { data, error } = await supabase.rpc('listar_suspensiones_activas_plantilla', {
          p_jugador_ids: jugadores.map(jugador => jugador.id)
        })
        if (error) throw error
        if (vigente) {
          setResultado({ jugadores, ids: new Set(data.map(fila => fila.jugador_id)) })
        }
      } catch {
        if (vigente) setResultado({ jugadores, error: true })
      }
    }

    cargar()
    return () => { vigente = false }
  }, [jugadores])

  const actual = resultado?.jugadores === jugadores ? resultado : null
  return {
    ids: actual?.ids,
    error: actual?.error,
    cargando: jugadores.length > 0 && !actual
  }
}

export function EstadoConsultaSuspensiones({ resultado }) {
  if (resultado.error) {
    return <p role="alert">No se pudieron consultar las suspensiones. Recarga la página para verificar.</p>
  }
  if (resultado.cargando) {
    return <p role="status">Consultando suspensiones…</p>
  }
  return null
}

export function MarcaSuspension() {
  return (
    <div style={{ color: '#991b1b', fontWeight: 'bold', fontSize: '13px', marginTop: 4 }}>
      Suspensión activa
    </div>
  )
}
