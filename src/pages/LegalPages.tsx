import { Link } from 'react-router-dom'

// /privacy and /terms (macOS plan stage 18; HANDOFF's "Open for Max" list).
//
// These exist for two concrete reasons, not for decoration:
//
// 1. Google's OAuth consent screen cannot be PUBLISHED without a privacy policy URL, and
//    until it is published every coach who signs in with Google has to be added by hand as
//    a test user. HANDOFF records this as the one thing blocking it.
// 2. The macOS app's About panel links to both.
//
// Public routes, above the auth gate in App.tsx, next to the share and join pages — a
// privacy policy behind a login is no use to the person deciding whether to sign up.
//
// ── Written from what the app actually does ─────────────────────────────────
// Every claim below is checkable against the code: no analytics package is installed (see
// package.json), the only network destination is the Supabase project, share links are
// opt-in per board and revocable, and account deletion is `delete_my_account` (migration
// 042), which keeps the boards a coach made with their club.
//
// ⚠️ CONTACT_EMAIL is the one field a human must fill before publishing the consent
// screen — it is deliberately obvious rather than a plausible-looking guess.
const CONTACT_EMAIL = 'TODO@example.com'

const UPDATED = '9 September 2026'

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[720px] px-6 py-12">
      <Link to="/" className="text-sm font-medium text-accent-ink hover:underline">
        ← Gaffer
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{title}</h1>
      <p className="mt-1 text-sm text-ink-faint">Last updated {UPDATED}</p>
      <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-muted">{children}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-semibold text-ink">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export function PrivacyPage() {
  return (
    <Page title="Privacy">
      <p>
        Gaffer is a tool for coaches to draw drills and tactics and share them inside their club.
        This page describes exactly what it stores and what it does not.
      </p>

      <Section title="What Gaffer stores">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium text-ink">Your account.</span> An email address, and either
            a password (stored hashed by our authentication provider, never in plain text) or the
            fact that you signed in with Google or Apple. Gaffer never sees your Google or Apple
            password.
          </li>
          <li>
            <span className="font-medium text-ink">Your club membership.</span> Which club you are
            in, whether you are an admin or a coach, and the display name your admin gave you.
          </li>
          <li>
            <span className="font-medium text-ink">What you make.</span> The drills, tactics and
            collections you create, and the images generated from them for thumbnails and club
            crests.
          </li>
        </ul>
      </Section>

      <Section title="What Gaffer does not do">
        <ul className="list-disc space-y-1 pl-5">
          <li>No analytics, tracking pixels, session recording or advertising of any kind.</li>
          <li>No selling or sharing of your data with anyone for marketing.</li>
          <li>No location data, no contacts, no access to files you have not chosen to open.</li>
        </ul>
      </Section>

      <Section title="Who can see your boards">
        <p>
          Boards belong to a club. Admins of your club can see everything in it; other coaches see
          what they made themselves plus any collection an admin has granted them. Nobody outside
          your club can see a board unless you deliberately turn on a share link for it — that link
          is an unguessable token, it reaches only that one board, and turning it off kills it
          immediately.
        </p>
      </Section>

      <Section title="Where it is kept">
        <p>
          Data is stored in a Supabase project (Postgres and object storage) which provides
          hosting, the database and authentication. The web app is served by Vercel. If you sign in
          with Google or Apple, that provider confirms your identity to us and nothing more.
        </p>
      </Section>

      <Section title="Deleting your account">
        <p>
          You can delete your account from Settings ▸ Account in the app. Doing so deletes your
          login and removes you from every club you are in. Drills and tactics you made stay with
          the club, because they are the club's working material and other coaches may be relying
          on them — deleting the account does not delete the club's library.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about your data, or want it removed? Email{' '}
          <a className="text-accent-ink hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </Page>
  )
}

export function TermsPage() {
  return (
    <Page title="Terms">
      <p>
        By using Gaffer you agree to what follows. It is deliberately short, because the
        arrangement is simple.
      </p>

      <Section title="The account is yours to look after">
        <p>
          Keep your sign-in details to yourself. If you are a club admin, invite links you generate
          let whoever holds them join your club — treat them like keys, and revoke any you did not
          mean to send.
        </p>
      </Section>

      <Section title="What you make is yours">
        <p>
          You keep ownership of the drills, tactics and collections you create. You grant only what
          is needed to run the service: storing your content, and showing it to the people in your
          club (and to anyone holding a share link you have deliberately turned on).
        </p>
      </Section>

      <Section title="Fair use">
        <p>
          Do not upload anything unlawful, or anything you do not have the right to upload — that
          includes photographs and crests belonging to someone else. Do not attempt to reach clubs
          or boards that are not yours.
        </p>
      </Section>

      <Section title="No warranty">
        <p>
          Gaffer is provided as it is, without warranty. It is a coaching tool, not a system of
          record: keep your own copy of anything you cannot afford to lose. The service may change
          or be unavailable at times.
        </p>
      </Section>

      <Section title="Ending it">
        <p>
          You can delete your account at any time from Settings ▸ Account. We may suspend an account
          that breaks these terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Anything unclear? Email{' '}
          <a className="text-accent-ink hover:underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </Page>
  )
}
