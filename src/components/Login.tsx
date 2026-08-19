import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type LoginStatus = 'idle' | 'sending' | 'sent' | 'error'

// Minimal magic-link login — build guide 0.5. No password/reset flow at all,
// on purpose: email in, "check your email" state, redirect handling is
// handled for free by supabase-js's detectSessionInUrl (see useSession.ts).
export function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<LoginStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || status === 'sending') return

    setStatus('sending')
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      setStatus('error')
      setError(error.message)
      return
    }

    setStatus('sent')
  }

  if (status === 'sent') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-xl font-semibold text-ink">Check your email</h1>
          <p className="mt-2 text-sm text-ink-muted">
            We sent a sign-in link to <span className="font-medium text-ink">{email}</span>.
            Open it on this device to finish signing in.
          </p>
          <button
            type="button"
            onClick={() => setStatus('idle')}
            className="mt-6 text-sm text-ink-muted underline underline-offset-2"
          >
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-ink">Gaffer</h1>
        <p className="mt-1 text-sm text-ink-muted">Sign in with a magic link — no password needed.</p>

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
          className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none focus:border-accent"
        />

        {error && <p className="mt-2 text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {status === 'sending' ? 'Sending…' : 'Send magic link'}
        </button>
      </form>
    </div>
  )
}
