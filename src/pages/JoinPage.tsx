import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { useSession } from '../hooks/useSession'
import { useStore } from '../store'
import { peekInvite, redeemInvite } from '../store/invites'
import type { ClubInvitePreview } from '../store'
import { Login } from '../components/Login'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// `/join/:token` — coach onboarding by invite (migration 039).
//
// Sits ABOVE the auth gate in App.tsx, alongside `/d/:token` and `/t/:token`,
// for the same reason those do: it has to render for a visitor with no
// account. Unlike those two it is not a public READ — it is the one route
// that turns a stranger into a member, so it renders the real Login and then
// redeems once a session exists.
//
// The order matters and is the whole design. Peek first (no auth needed, so a
// dead link says so before asking anyone to sign up), then authenticate, then
// redeem. Because the token carries the club binding, the identity the
// visitor authenticates with is irrelevant — a password, a personal Google
// account, or an Apple relay address all redeem this invite identically, and
// no email ever has to match what the admin typed.
export function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { session, loading: sessionLoading } = useSession()
  const fetchMemberships = useStore((s) => s.fetchMemberships)
  const selectClub = useStore((s) => s.selectClub)

  const [preview, setPreview] = useState<ClubInvitePreview | null>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // A ref rather than state: this only ever guards against redeeming twice
  // (React 18 double-invokes effects in dev, and the session/preview pair
  // settles across more than one render), and nothing renders from it — the
  // "Joining…" screen keys off `session` instead. As state it would be a
  // synchronous setState inside an effect, which is the cascading-render
  // pattern oxlint's react(set-state-in-effect) flags.
  const attempted = useRef(false)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    peekInvite(token).then((result) => {
      if (cancelled) return
      setPreview(result)
      setChecking(false)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const join = useCallback(async () => {
    if (!token) return
    const result = await redeemInvite(token)
    if ('error' in result) {
      setError(result.error)
      return
    }
    // Memberships first, then selection: `selectClub` reconciles against the
    // membership list, so selecting a club the store hasn't loaded yet would
    // be discarded. Landing on the club explicitly (rather than letting the
    // app pick) is the point — this visitor came here to reach ONE club.
    await fetchMemberships()
    selectClub(result.clubId)
    navigate('/', { replace: true })
  }, [token, fetchMemberships, selectClub, navigate])

  // Redeem as soon as there is a session, whether it already existed (a coach
  // who is signed in on another club and opens a link for a second one) or was
  // just created by the Login below. One effect covers both, so there is no
  // "you're signed in, now click join" step that a coach could stall on.
  useEffect(() => {
    if (!session || !preview || attempted.current) return
    attempted.current = true
    void join()
  }, [session, preview, join])

  if (sessionLoading || checking) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface px-4">
        <div aria-busy="true" className="w-full max-w-sm space-y-3">
          <span className="sr-only">Checking your invite…</span>
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
        </div>
      </div>
    )
  }

  // One state for unknown, expired and already-redeemed — `peek_club_invite`
  // returns nothing for all three, deliberately, so a stranger holding a dead
  // link learns nothing about which it was.
  if (!preview) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm text-center">
          <EmptyState icon={Users} message="This invite link is no longer valid." />
          <p className="mt-2 text-sm text-ink-muted">
            Ask whoever invited you for a fresh link — they expire after 14 days and each one works once.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-accent-ink underline underline-offset-2">
            Go to Gaffer
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface px-4">
        <div className="w-full max-w-sm text-center">
          <EmptyState icon={Users} message={error} />
          <button
            type="button"
            onClick={() => {
              setError(null)
              void join()
            }}
            className="mt-4 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (session) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface px-4">
        <div aria-busy="true" className="w-full max-w-sm text-center">
          <p className="text-sm text-ink-muted">Joining {preview.club_name}…</p>
        </div>
      </div>
    )
  }

  // Opens on sign-up: an invited coach almost never has an account yet, and
  // the "Already have an account? Sign in" toggle covers the ones who do.
  return (
    <Login
      heading={`Join ${preview.club_name}`}
      subheading={`You've been invited as a ${preview.role}. Create your account to join — you choose your own password.`}
      initialMode="sign-up"
    />
  )
}
