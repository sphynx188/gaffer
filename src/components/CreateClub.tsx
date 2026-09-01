import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { Card } from './ui/Card'

// Rendered INSTEAD of the routed app the moment a signed-in user resolves
// to zero club memberships (App.tsx, mirroring how Login gates the whole
// app before a session exists) — every account needs a club before there's
// anything club-scoped to show. `create_club` (migration 028) makes the
// caller that club's admin in the same transaction, so success always
// means the routed app can render next.
//
// "Zero memberships" is NOT only "a founder who hasn't made their club yet",
// and treating it as such was a real trap once invites existed (migration
// 039): a coach who was invited as sam@club.com but signed in with a personal
// Google account — or with Apple's Hide My Email relay, which can never match
// anything an admin typed — lands here as a brand-new user and, with no other
// option on screen, creates a stray club instead of reaching their team. So
// this screen offers both doors, and the invite one is a real escape hatch,
// not a hint.
export function CreateClub() {
  const createClub = useStore((s) => s.createClub)
  const membershipsError = useStore((s) => s.membershipsError)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [showInvite, setShowInvite] = useState(false)

  // Accepts a whole pasted link or a bare token — a coach forwarding "their
  // link" pastes whatever their admin sent, and the difference between the
  // two is not something they should have to notice.
  const openInvite = (e: FormEvent) => {
    e.preventDefault()
    const raw = inviteLink.trim()
    if (!raw) return
    const token = raw.split('/join/').pop()?.split(/[?#]/)[0]?.trim()
    if (token) navigate(`/join/${token}`)
  }

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

        <div className="mt-6 border-t border-line pt-4">
          {showInvite ? (
            <form onSubmit={openInvite}>
              <label htmlFor="invite-link" className="block text-sm font-medium text-ink-muted">
                Paste your invite link
              </label>
              <input
                id="invite-link"
                type="text"
                autoFocus
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
                placeholder="https://…/join/…"
                className="mt-1 w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="submit"
                disabled={!inviteLink.trim()}
                className="mt-3 w-full rounded-md border border-line px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
              >
                Join the club
              </button>
            </form>
          ) : (
            <p className="text-sm text-ink-muted">
              Been invited to a club?{' '}
              <button
                type="button"
                onClick={() => setShowInvite(true)}
                className="text-accent-ink underline underline-offset-2"
              >
                Use your invite link
              </button>
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
