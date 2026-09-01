// Reading an OAuth failure back off the URL.
//
// `signInWithOAuth` navigates the browser away, so the promise it returns
// only ever reports failures that happen BEFORE the redirect. Everything that
// goes wrong afterwards — the visitor pressing Cancel on Google's consent
// screen, a provider misconfiguration, an expired authorization code — comes
// back as query/hash params on whatever `redirectTo` pointed at, and is
// invisible to the code that started the flow.
//
// Without this, cancelling Google's consent screen returns an invited coach
// to the join page looking exactly as it did before they clicked, with no
// hint that anything happened or that they need to try again.
//
// Supabase puts these params in the QUERY STRING under the PKCE flow and in
// the HASH FRAGMENT under the implicit flow, and which one is in play depends
// on the client's `flowType` — so both are checked rather than assuming.

const FRIENDLY: Record<string, string> = {
  // What Google returns when someone presses Cancel rather than Continue.
  // Its own `error_description` for this is "The user denied your request",
  // which reads like an accusation; this is the same fact from the visitor's
  // point of view.
  access_denied: 'Sign-in was cancelled. Try again, or use your email and password below.',
  // The provider is enabled but half-configured (a client id with no secret,
  // say). A coach can do nothing about this, so it says so rather than
  // inviting them to retry something that will fail identically.
  validation_failed: 'Google sign-in is not set up correctly yet. Use your email and password below.',
  server_error: 'Google had a problem signing you in. Try again, or use your email and password below.',
}

function paramsFrom(source: string): URLSearchParams {
  return new URLSearchParams(source.startsWith('#') || source.startsWith('?') ? source.slice(1) : source)
}

// Returns a message to show, or null if this page load wasn't a failed OAuth
// return. Pure — it only reads `window.location`, so it is safe to call from
// a `useState` initializer, including under StrictMode's double invocation.
export function readAuthRedirectError(): string | null {
  if (typeof window === 'undefined') return null
  for (const source of [window.location.search, window.location.hash]) {
    if (!source) continue
    const params = paramsFrom(source)
    const code = params.get('error_code') ?? params.get('error')
    if (!code) continue
    if (FRIENDLY[code]) return FRIENDLY[code]
    // Anything unmapped: prefer the provider's own description over an
    // opaque code, since it is at least a sentence.
    const described = params.get('error_description')
    return described ? described.replace(/\+/g, ' ') : `Sign-in failed (${code}).`
  }
  return null
}

// Strips the error params so a reload doesn't resurrect a message about
// something that already happened, and so the address bar isn't left carrying
// the failure. Separate from the read above because it MUTATES history and so
// belongs in an effect, not in a render-phase initializer.
export function clearAuthRedirectError(): void {
  if (typeof window === 'undefined') return
  const { search, hash, pathname } = window.location
  const hasError = /(^|[?&#])error(_code|_description)?=/.test(search) || /(^|[?&#])error(_code|_description)?=/.test(hash)
  if (!hasError) return
  window.history.replaceState({}, '', pathname)
}
