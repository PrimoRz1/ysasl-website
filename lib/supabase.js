import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

// Capture the recovery marker before Supabase consumes the URL fragment.
const parametrosAuth = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.hash.slice(1))
  : null
const llegadaRecuperacion = parametrosAuth?.get('type') === 'recovery'
const tokenConfirmacion = parametrosAuth?.get('type') === 'signup'
  ? parametrosAuth.get('access_token')
  : null

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

  if (tokenConfirmacion) {
    // Also handles valid links that Supabase sends to the site root.
    supabase.auth.getSession().then(async ({ data, error }) => {
      const sesion = data.session
      if (error || sesion?.access_token !== tokenConfirmacion ||
          !sesion.user?.email_confirmed_at) return

      const destino = new URL('/login', window.location.origin)
      destino.searchParams.set('confirmado', '1')
      const equipo = sesion.user.user_metadata?.equipo_invitacion ??
        new URLSearchParams(window.location.search).get('equipo')
      if (/^[1-9]\d*$/.test(String(equipo)) && Number.isSafeInteger(Number(equipo))) {
        destino.searchParams.set('equipo', String(equipo))
      }

      const { error: errorSalida } = await supabase.auth.signOut({ scope: 'local' })
      if (!errorSalida) window.location.replace(destino.toString())
    }).catch(() => {
      // If initialization fails, leave the regular login available.
    })
  }

  // Covers initialization that completed before the listener was registered.
  if (llegadaRecuperacion) {
    supabase.auth.getSession().then(({ data, error }) => {
      if (!error && data.session) abrirNuevaContrasena()
    }).catch(() => {
      // The login recovery form reports expired or invalid sessions.
    })
  }
}
