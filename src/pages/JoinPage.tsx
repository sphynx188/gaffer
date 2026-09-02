import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Loader2, Unlink } from 'lucide-react'
import { useSession } from '../hooks/useSession'
import { useStore } from '../store'
import { peekInvite, redeemInvite } from '../store/invites'
import type { ClubInvitePreview } from '../store'
import { Login } from '../components/Login'
import { AuthCrest, AuthLayout } from '../components/auth/AuthLayout'

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
//
// Every state below leads with the CLUB, not the app: its crest, its name.
// The question this screen has to answer first is "am I in the right place",
// and a visitor who has never heard of Gaffer can only answer that from their
// own club's name. "Gaffer" is in the footer, which is enough to say what
// they are signing into without taking the headline.
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
    // `?joined` is what turns the app's first render into a welcome: HomePage
    // reads it to start the walkthrough for someone who has just arrived,
    // rather than every coach who ever opens Home. Replaces history so Back
    // doesn't return to a spent invite.
    navigate('/?joined=1', { replace: true })
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

  // Checking the link. Deliberately not a skeleton of the form beneath: this
  // resolves in one round trip, and a skeleton that flashes into a completely
  // different layout (or into a dead-link message) is worse than a line of
  // text that stays put.
  if (sessionLoading || checking) {
    return (
      <AuthLayout
        title="Checking your invite"
        subtitle="One moment."
        mark={
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-panel-raised">
            <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
          </span>
        }
      >
        <span className="sr-only" aria-live="polite">
          Checking your invite link
        </span>
      </AuthLayout>
    )
  }

  // One state for unknown, expired and already-redeemed — `peek_club_invite`
  // returns nothing for all three, deliberately, so a stranger holding a dead
  // link learns nothing about which it was. The copy still has to give the
  // visitor their next move, and the only one that exists is "ask the person
  // who sent it", so it says that rather than apologising.
  if (!preview) {
    return (
      <AuthLayout
        title="This link has expired"
        subtitle="Ask whoever invited you for a new one — they can send it from the club's Coaches tab."
        mark={
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-panel-raised">
            <Unlink className="h-5 w-5 text-ink-faint" />
          </span>
        }
        wordmark={false}
        footer={
          <Link to="/" className="underline underline-offset-2 hover:text-ink">
            Go to Gaffer
          </Link>
        }
      >
        <p className="text-sm text-ink-faint">Invite links last 14 days and can only be used once.</p>
      </AuthLayout>
    )
  }

  // Redemption failed after authenticating — a revoked link, or the network.
  // The retry is the primary action because it is very often all that is
  // needed, and the visitor is already signed in at this point.
  if (error) {
    return (
      <AuthLayout
        title="Couldn't join the club"
        subtitle={error}
        mark={<AuthCrest crestUrl={preview.club_crest_url} />}
      >
        <button
          type="button"
          onClick={() => {
            setError(null)
            void join()
          }}
          className="min-h-11 w-full rounded-md bg-accent px-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Try again
        </button>
      </AuthLayout>
    )
  }

  // Signed in, redemption in flight. Keeps the club's own crest and name on
  // screen so the card does not visually swap out from under someone mid-join
  // — the previous version replaced the whole screen with one centred line of
  // grey text, which read as the app losing its place.
  if (session) {
    return (
      <AuthLayout
        title={`Joining ${preview.club_name}`}
        subtitle="Setting up your access."
        mark={<AuthCrest crestUrl={preview.club_crest_url} />}
      >
        <div className="flex items-center gap-2 text-sm text-ink-muted" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin text-ink-faint" />
          One moment
        </div>
      </AuthLayout>
    )
  }

  // Opens on sign-up: an invited coach almost never has an account yet, and
  // the "Already have an account? Sign in" toggle covers the ones who do.
  return (
    <Login
      heading={preview.club_name}
      subheading={`You've been invited to join as a ${preview.role}. Create an account to accept — you choose your own password.`}
      initialMode="sign-up"
      mark={<AuthCrest crestUrl={preview.club_crest_url} />}
    />
  )
}
