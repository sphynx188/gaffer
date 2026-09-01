import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

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

  const switchMode = (next: Mode) => {
    setMode(next)
    setStatus('idle')
    setError(null)
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

        <label htmlFor="email" className="mt-6 block text-sm font-medium text-ink-muted">
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
