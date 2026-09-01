import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { clearAuthRedirectError, readAuthRedirectError } from '../lib/authRedirectError'

type Mode = 'sign-in' | 'sign-up' | 'reset-request'
type Status = 'idle' | 'submitting' | 'error' | 'check-email'

// Persistent email/password login (replaces the earlier magic-link-only
// flow — see UPGRADE_IMPLEMENTATION_PLAN.md Phase 1). Session persistence
// across reloads is handled for free by supabase-js's default
// `persistSession: true` (see lib/supabase.ts) — nothing extra needed here
// for that part.
//
// 'check-email' covers two distinct triggers (sign-up confirmation and
// password-reset requests) with one shared "we sent you a link" screen —
// `checkEmailMessage` carries the trigger-specific copy. Sign-up also
// covers the case where the Supabase project's "Confirm email" setting is
// (re-)enabled later: signUp then returns a user with no session yet
// rather than an immediate one, so this path already exists regardless of
// that project setting. Once a reset link is clicked, App.tsx intercepts
// via useSession's isPasswordRecovery — see components/ResetPassword.tsx.
// Google's own four-colour mark, inline rather than from lucide — lucide has
// no brand icons, and Google's identity guidelines for "Sign in with Google"
// require their mark in its actual colours rather than a monochrome stand-in.
// Fixed hex on purpose: a brand mark is the one thing on screen that must NOT
// follow the theme tokens, and it reads correctly on both our light and dark
// panel backgrounds.
function GoogleMark() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  )
}

// `heading`/`subheading`/`initialMode` exist for the /join/:token screen
// (migration 039), which needs the same three auth modes but has to say WHICH
// CLUB the visitor is joining rather than the app's name, and should open on
// sign-up because an invited coach almost never has an account yet. Every
// prop is optional, so the plain login route renders exactly as before.
interface LoginProps {
  heading?: string
  subheading?: string
  initialMode?: Mode
}

export function Login({ heading, subheading, initialMode }: LoginProps = {}) {
  const [mode, setMode] = useState<Mode>(initialMode ?? 'sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [checkEmailMessage, setCheckEmailMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Kept separate from `error` so each message renders beside the control it
  // is about: this one belongs under the Google button, not at the bottom of
  // a password form the visitor never touched. Seeded from the URL rather
  // than set in an effect — an OAuth failure is already known at first
  // render, so assigning it here avoids an extra render pass (and the
  // react(set-state-in-effect) warning). The reader is pure, so StrictMode's
  // double invocation is harmless.
  const [oauthError, setOauthError] = useState<string | null>(() => readAuthRedirectError())

  // Clearing MUTATES history, so unlike reading it belongs in an effect. Runs
  // once: the message is already in state, and this only stops a reload from
  // resurrecting it.
  useEffect(() => {
    clearAuthRedirectError()
  }, [])

  // Third-party sign-in. Worth having only because coach membership binds to
  // an INVITE TOKEN rather than an email (migration 039) — before that, a
  // coach arriving with a personal Google address authenticated as a brand
  // new user with no membership and got pushed into creating a stray club.
  //
  // `redirectTo` is the CURRENT page, which is the whole trick for
  // /join/:token: Google bounces the visitor back to the same invite URL,
  // supabase-js picks the session out of the URL on the way in
  // (detectSessionInUrl defaults true, see hooks/useSession), and JoinPage
  // redeems on its next render. No token stashing, nothing to survive the
  // round trip, and the plain /login case falls out of the same line.
  //
  // Note the redirect target must be allow-listed in the Supabase dashboard
  // under Authentication -> URL Configuration -> Redirect URLs, for localhost
  // and for the deployed origin, or Google returns the visitor to the site
  // root and the invite is silently not redeemed.
  const signInWithGoogle = async () => {
    setStatus('submitting')
    setOauthError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
    // On success the browser is already navigating away, so only the failure
    // path ever renders. The common one is the provider not being enabled on
    // the project yet, whose message says exactly that.
    if (error) {
      setStatus('error')
      setOauthError(error.message)
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setStatus('idle')
    setError(null)
    // `oauthError` deliberately survives a mode switch: "sign-in was
    // cancelled" is just as true on the sign-up tab, and the most likely
    // reason someone switches tabs right after a failed Google attempt is
    // that they are acting on it.
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || status === 'submitting') return
    if (mode !== 'reset-request' && !password) return

    if (mode === 'sign-up' && password !== confirmPassword) {
      setStatus('error')
      setError("Passwords don't match.")
      return
    }

    setStatus('submitting')
    setError(null)

    if (mode === 'sign-in') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setStatus('error')
        setError(error.message)
      }
      // On success, useSession's onAuthStateChange picks up the new session
      // and App.tsx swaps this screen out — nothing further to do here.
      return
    }

    if (mode === 'reset-request') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) {
        setStatus('error')
        setError(error.message)
        return
      }
      setCheckEmailMessage(
        `We sent a password reset link to ${email}. Open it on this device to choose a new password.`
      )
      setStatus('check-email')
      return
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setStatus('error')
      setError(error.message)
      return
    }
    if (!data.session) {
      setCheckEmailMessage(
        `We sent a confirmation link to ${email}. Open it on this device to finish creating your account.`
      )
      setStatus('check-email')
      return
    }
    // Confirmation disabled (current project setting) — signUp already
    // returned an active session, same as sign-in above.
  }

  if (status === 'check-email') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-ink">Check your email</h1>
          <p className="mt-2 text-sm text-ink-muted">{checkEmailMessage}</p>
          <button
            type="button"
            onClick={() => switchMode('sign-in')}
            className="mt-6 text-sm text-ink-muted underline underline-offset-2"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-ink">{heading ?? 'Gaffer'}</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {mode === 'reset-request'
            ? "Enter your email and we'll send you a reset link."
            : (subheading ??
              (mode === 'sign-in' ? 'Sign in to your coach account.' : 'Create your coach account.'))}
        </p>

        {/* Hidden on reset-request: that mode is about recovering a password,
            and offering a way to sign in without one would just be confusing
            at the moment someone is trying to fix theirs. */}
        {mode !== 'reset-request' && (
          <>
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={status === 'submitting'}
              className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-50"
            >
              <GoogleMark />
              Continue with Google
            </button>
            {oauthError && <p className="mt-2 text-sm text-bad">{oauthError}</p>}
            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-ink-faint">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        <label htmlFor="email" className={(mode === 'reset-request' ? 'mt-6 ' : '') + 'block text-sm font-medium text-ink-muted'}>
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />

        {mode !== 'reset-request' && (
          <>
            <label htmlFor="password" className="mt-4 block text-sm font-medium text-ink-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </>
        )}

        {mode === 'sign-in' && (
          <button
            type="button"
            onClick={() => switchMode('reset-request')}
            className="mt-2 text-sm text-ink-muted underline underline-offset-2"
          >
            Forgot password?
          </button>
        )}

        {mode === 'sign-up' && (
          <>
            <label htmlFor="confirm-password" className="mt-4 block text-sm font-medium text-ink-muted">
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </>
        )}

        {error && <p className="mt-2 text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {status === 'submitting'
            ? mode === 'sign-in'
              ? 'Signing in…'
              : mode === 'sign-up'
                ? 'Creating account…'
                : 'Sending…'
            : mode === 'sign-in'
              ? 'Sign in'
              : mode === 'sign-up'
                ? 'Create account'
                : 'Send reset link'}
        </button>

        {mode === 'reset-request' ? (
          <button
            type="button"
            onClick={() => switchMode('sign-in')}
            className="mt-4 w-full text-center text-sm text-ink-muted underline underline-offset-2"
          >
            Back to sign in
          </button>
        ) : (
          <button
            type="button"
            onClick={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
            className="mt-4 w-full text-center text-sm text-ink-muted underline underline-offset-2"
          >
            {mode === 'sign-in' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
          </button>
        )}
      </form>
    </div>
  )
}
