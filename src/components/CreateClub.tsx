import { useState, type FormEvent } from 'react'
import { useStore } from '../store'
import { Card } from './ui/Card'

// Rendered INSTEAD of the routed app the moment a signed-in user resolves
// to zero club memberships (App.tsx, mirroring how Login gates the whole
// app before a session exists) — every account needs a club before there's
// anything club-scoped to show. `create_club` (migration 028) makes the
// caller that club's admin in the same transaction, so success always
// means the routed app can render next.
export function CreateClub() {
  const createClub = useStore((s) => s.createClub)
  const membershipsError = useStore((s) => s.membershipsError)
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const ok = await createClub(name.trim())
    setSubmitting(false)
    // On success, fetchMemberships (inside createClub) resolves
    // memberships.length > 0 and App.tsx swaps this screen out —
    // nothing further to do here, same pattern as Login's sign-in.
    if (!ok) return
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight text-ink">Create your club</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Gaffer is organized around clubs now — drills and tactics live in a club's library, not on your own
          account. Name yours to get started; you'll be its admin.
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="club-name" className="mt-6 block text-sm font-medium text-ink-muted">
            Club name
          </label>
          <input
            id="club-name"
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Riverside Academy"
            className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />

          {membershipsError && <p className="mt-2 text-sm text-bad">{membershipsError}</p>}

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="mt-4 w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create club'}
          </button>
        </form>
      </Card>
    </div>
  )
}
