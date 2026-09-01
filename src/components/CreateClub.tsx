import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { AuthLayout } from './auth/AuthLayout'

const FIELD =
  'w-full rounded-md border border-line bg-panel px-3 py-2 text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30'

// Rendered INSTEAD of the routed app the moment a signed-in user resolves to
// zero club memberships (App.tsx, mirroring how Login gates the whole app
// before a session exists). `create_club` (migration 028) makes the caller
// that club's admin in the same transaction, so success always means the
// routed app can render next.
//
// "Zero memberships" is NOT only "a founder who hasn't made their club yet",
// and treating it as such was a real trap once invites existed (migration
// 039): a coach who was invited as sam@club.com but signed in with a personal
// Google account — or with Apple's Hide My Email relay, which can never match
// anything an admin typed — lands here as a brand-new user and, with no other
// option on screen, creates a stray club instead of reaching their team. So
// this screen offers both doors, and the invite one is a real escape hatch,
// not a hint.
//
// The copy used to open "Gaffer is organized around clubs now — drills and
// tactics live in a club's library, not on your own account", which reads as
// a migration note to an existing user. Everyone who sees this screen is new.
export function CreateClub() {
  const createClub = useStore((s) => s.createClub)
  const membershipsError = useStore((s) => s.membershipsError)
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [showInvite, setShowInvite] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim() || submitting) return
    setSubmitting(true)
    const ok = await createClub(name.trim())
    setSubmitting(false)
    // On success, fetchMemberships (inside createClub) resolves
    // memberships.length > 0 and App.tsx swaps this screen out — nothing
    // further to do here, same pattern as Login's sign-in.
    if (!ok) return
  }

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

  if (showInvite) {
    return (
      <AuthLayout
        title="Open your invite"
        subtitle="Paste the link your club sent you."
        footer={
          <button
            type="button"
            onClick={() => setShowInvite(false)}
            className="underline underline-offset-2 hover:text-ink"
          >
            Back
          </button>
        }
      >
        <form onSubmit={openInvite}>
          <label htmlFor="invite-link" className="block text-sm font-medium text-ink-muted">
            Invite link
          </label>
          <input
            id="invite-link"
            type="text"
            autoFocus
            value={inviteLink}
            onChange={(e) => setInviteLink(e.target.value)}
            placeholder="https://…/join/…"
            className={`mt-1 ${FIELD}`}
          />
          <button
            type="submit"
            disabled={!inviteLink.trim()}
            className="mt-4 min-h-11 w-full rounded-md bg-accent px-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            Continue
          </button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your club"
      // States the actual payoff rather than describing the data model. A
      // club is what drills and tactics belong to, and the reason they
      // survive a coach leaving — which is the product's whole premise.
      subtitle="Your drills and tactics live in the club's library, so they stay with the club as coaches come and go."
      footer={
        <>
          Been invited to a club?{' '}
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="text-accent-ink underline underline-offset-2"
          >
            Use your invite link
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        <label htmlFor="club-name" className="block text-sm font-medium text-ink-muted">
          Club name
        </label>
        <input
          id="club-name"
          type="text"
          required
          autoFocus
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Riverside Academy"
          className={`mt-1 ${FIELD}`}
        />
        <p className="mt-1.5 text-xs text-ink-faint">You'll be its admin. You can rename it later.</p>

        {membershipsError && <p className="mt-2 text-sm text-bad">{membershipsError}</p>}

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="mt-4 min-h-11 w-full rounded-md bg-accent px-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? 'Creating…' : 'Create club'}
        </button>
      </form>
    </AuthLayout>
  )
}
