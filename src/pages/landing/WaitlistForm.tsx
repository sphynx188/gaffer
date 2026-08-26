import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { joinWaitlist } from '../../lib/waitlist'

// Shared by the hero and the final CTA. Inline pill form: input + accent
// button; swaps to a confirmation line on success. Duplicate email is a
// success ("already on the list") — a waitlist never benefits from telling
// someone no.
export function WaitlistForm({ id }: { id?: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'duplicate' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || state === 'busy') return
    setState('busy')
    setState(await joinWaitlist(email))
  }

  if (state === 'ok' || state === 'duplicate') {
    return (
      <p className="flex min-h-12 items-center gap-2 text-sm font-medium text-ok">
        <Check className="h-4 w-4" aria-hidden />
        {state === 'ok' ? "You're on the list — see you pre-season." : "You're already on the list."}
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md">
      <div className="flex items-center gap-2 rounded-full border border-line bg-panel p-1.5 pl-4 transition-colors focus-within:border-accent">
        <input
          id={id}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="coach@yourclub.com"
          aria-label="Email address"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={state === 'busy'}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {state === 'busy' ? 'Joining…' : 'Get early access'}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {state === 'error' && <p className="mt-2 text-xs text-bad">Something went wrong — try again.</p>}
    </form>
  )
}
