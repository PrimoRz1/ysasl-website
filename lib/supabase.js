import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

// Capture the recovery marker before Supabase consumes the URL fragment.
const llegadaRecuperacion = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery'

export const supabase = createClient(supabaseUrl, supabaseKey)

if (typeof window !== 'undefined') {
  let redireccionPendiente = false

  function abrirNuevaContrasena() {
    if (window.location.pathname === '/login' || redireccionPendiente) return
    redireccionPendiente = true

    // Leave the auth callback before navigating. Supabase has persisted the
    // recovery session, so credentials do not need to be copied into another URL.
    window.setTimeout(() => {
      window.location.replace('/login?restablecer=1')
    }, 0)
  }

  supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'PASSWORD_RECOVERY') abrirNuevaContrasena()
  })

  // Covers initialization that completed before the listener was registered.
  if (llegadaRecuperacion) {
    supabase.auth.getSession().then(({ data, error }) => {
      if (!error && data.session) abrirNuevaContrasena()
    }).catch(() => {
      // The login recovery form reports expired or invalid sessions.
    })
  }
}
