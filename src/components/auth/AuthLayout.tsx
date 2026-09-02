import type { ReactNode } from 'react'
import { Shield } from 'lucide-react'

// The shell every pre-app screen sits in: sign in, join a club, create a club
// (2026-09-01). Before this they were one journey rendered three different
// ways — Login was a bare <form> straight on `bg-surface` with no container,
// CreateClub used a Card, and JoinPage's failure state used EmptyState, whose
// dashed border reads as "this list is empty" rather than "this link is
// dead". Someone invited to a club could pass through all three in a minute
// and see the app change shape under them each time.
//
// Deliberately NOT a new visual world. design.md records that a signature
// motif (the old chalk-line/amber system) was removed on purpose and warns
// against reintroducing one, so this reaches for nothing decorative: the
// surface ladder, hairline borders and the existing type scale do the work,
// exactly as they do inside the app.
//
// There is no kicker/eyebrow slot, and the app name is not one. On /join the
// CLUB is the headline — that is the fact the visitor needs to confirm they
// are in the right place — and "Gaffer" sits in the footer instead, where it
// still answers "what am I signing into" without stealing the h1 or stacking
// a label above it.

interface AuthLayoutProps {
  title: string
  subtitle?: ReactNode
  // A crest, a status glyph — whatever identifies what this screen is about.
  // Rendered at the same 'crest or Shield fallback' shape as the club
  // switcher in AppShell, one size up, so a coach who has seen the app
  // recognises it and one who hasn't still gets a mark rather than a gap.
  mark?: ReactNode
  children: ReactNode
  // Below the card, outside its border — reads as "or do this other thing"
  // rather than as part of the form.
  footer?: ReactNode
  // The quiet app anchor under everything. On by default, because most of
  // these screens headline something that is NOT the app (a club, an error)
  // and a visitor still needs to know what they are signing into. Turned OFF
  // on the two screens that already say "Gaffer" above it — the plain login,
  // whose h1 IS the app name, and the dead-link screen, whose footer link
  // already reads "Go to Gaffer". Two Gaffers stacked is not an anchor, it is
  // a stutter.
  wordmark?: boolean
}

// Matches AppShell's ClubCrestIcon (crest if there is one, a bare Shield
// otherwise so there is never an empty gap), one size up because here it is
// the screen's subject rather than a switcher's adornment.
export function AuthCrest({ crestUrl }: { crestUrl: string | null }) {
  return (
    <span className="mb-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-line bg-panel-raised">
      {crestUrl ? (
        <img src={crestUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <Shield className="h-5 w-5 text-ink-faint" />
      )}
    </span>
  )
}

export function AuthLayout({ title, subtitle, mark, children, footer, wordmark = true }: AuthLayoutProps) {
  return (
    // `min-h-svh` rather than `min-h-screen`: on mobile Safari the latter is
    // the viewport WITHOUT the address bar, so a centred card sits visibly
    // low and can push its own submit button under the chrome.
    <div className="flex min-h-svh flex-col items-center justify-center bg-surface px-4 py-10">
      <main className="w-full max-w-sm">
        <div className="rounded-xl border border-line bg-panel p-6 panel-edge">
          {mark}
          {/* text-balance stops a long club name breaking after one word —
              "Riverside Academy Football Club" is long enough to matter. */}
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <div className="mt-1.5 text-sm text-ink-muted">{subtitle}</div>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-ink-muted">{footer}</div>}
        {wordmark && <p className="mt-8 text-center text-xs text-ink-faint">Gaffer</p>}
      </main>
    </div>
  )
}
