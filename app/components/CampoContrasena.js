'use client'

import { useState } from 'react'

export default function CampoContrasena({ id, style, ...props }) {
  const [visible, setVisible] = useState(false)
  const etiqueta = visible ? 'Ocultar contraseña' : 'Mostrar contraseña'

  return (
    <div style={{ position: 'relative', marginBottom: style.marginBottom }}>
      <input
        {...props}
        id={id}
        type={visible ? 'text' : 'password'}
        style={{ ...style, marginBottom: 0, paddingRight: '52px' }}
      />
      <button
        type="button"
        aria-label={etiqueta}
        aria-controls={id}
        title={etiqueta}
        onClick={() => setVisible(actual => !actual)}
        style={{
          position: 'absolute',
          right: '4px',
          bottom: 0,
          width: '44px',
          height: '100%',
          maxHeight: '44px',
          display: 'grid',
          placeItems: 'center',
          border: 0,
          background: 'transparent',
          color: '#0b2948',
          cursor: 'pointer'
        }}
      >
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          strokeLinejoin="round">
          <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="2.5" />
          {visible && <path d="m3 3 18 18" />}
        </svg>
      </button>
    </div>
  )
}
