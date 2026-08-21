import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

interface ResetPasswordProps {
  onDone: () => void
}

// Rendered by App.tsx in place of the normal routed app whenever
// useSession reports isPasswordRecovery — i.e. the coach arrived via a
// password-reset email link. `supabase.auth.updateUser` applies the new
// password to the session that link already established; `onDone` clears
// the recovery flag so App.tsx proceeds into the app afterward.
export function ResetPassword({ onDone }: ResetPasswordProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!password || submitting) return
    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setSubmitting(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }
    onDone()
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-ink">Set a new password</h1>
        <p className="mt-1 text-sm text-ink-muted">Choose a new password for your account.</p>

        <label htmlFor="new-password" className="mt-6 block text-sm font-medium text-ink-muted">
          New password
        </label>
        <input
          id="new-password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />

        <label htmlFor="confirm-new-password" className="mt-4 block text-sm font-medium text-ink-muted">
          Confirm new password
        </label>
        <input
          id="confirm-new-password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
        />

        {error && <p className="mt-2 text-sm text-bad">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </div>
  )
}
