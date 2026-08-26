# Landing page — design spec (2026-08-26)

Approved via brainstorming session 2026-08-26. Goal: an award-calibre
marketing/home page for Gaffer, presented as a real launching product,
served by the existing app to signed-out visitors.

## Decisions (from the brainstorm Q&A)

- **Lives inside the Gaffer app** — a public route in the existing React
  app, not a separate site or deploy.
- **Real product marketing** framing, aimed at coaches. Primary CTA is an
  **early-access waitlist** (email capture into Supabase), deliberately
  chosen over linking the existing open signup. "Sign in" stays available
  in the nav for the existing account.
- **Extends the app's design system** (design.md tokens: near-black
  surface ladder, hairline borders, scarce lavender accent, Inter-only
  type, no shadows). **Dark-only**: the landing page pins dark token
  values even for a visitor whose stored theme is light.
- **Live animated demos**: the hero embeds the real engine —
  `PitchCanvas` + `frameAt` running a hand-authored demo scene — not a
  faked animation.
- **Pricing section**: planned tiers (Free / Club / Pro), framed as
  early-access pricing. Tier CTAs point at the waitlist.
- **Social proof**: placeholder testimonials (invented coach names) and a
  logo wall of **real famous club names as styled text wordmarks only** —
  explicitly NOT reproductions of their copyrighted crest artwork. All
  placeholder content is marked as such in code comments. This page is a
  private mockup; the fabricated affiliations must be replaced before any
  genuine public marketing use.

## Routing

Edit `src/App.tsx` (`AuthedApp` signed-out branch only):

- Signed out: `/` → `LandingPage`; `/login` → existing `Login`;
  any other path → `Navigate to "/"`.
- Signed in: unchanged (`/` = Dashboard). `/login` while signed in →
  `Navigate to "/"`.
- `/d/:token`, `/t/:token` share pages and the password-recovery branch:
  untouched.

## Files

New folder `src/pages/landing/`:

- `LandingPage.tsx` — composition of the sections below.
- `LandingNav.tsx` — wordmark, anchor links, Sign in, CTA; glass/blur
  treatment once scrolled.
- `Hero.tsx` — full-viewport headline + subcopy + waitlist input +
  app-window-framed live pitch demo (lazy-loaded via `React.lazy` so
  Konva doesn't block first paint).
- `demoScene.ts` — hardcoded `SceneDocument` (entities + keyframes for a
  build-up pattern, normalized 0–1 coords) authored for the hero loop.
  No Supabase involvement.
- `LogoWall.tsx` — marquee of club-name wordmarks.
- `FeatureSections.tsx` (or one file per vignette if they grow) —
  alternating scroll-revealed vignettes: Drill designer (13 drawing
  tools, 4 pitch sizes × 2 orientations); Tactics board (29 formations,
  roster-linked, timeline + phases); Session planning + attendance;
  Pitch-side PWA (offline, mobile).
- `StatsStrip.tsx` — count-up numbers, all true product facts.
- `Testimonials.tsx` — 3 placeholder quotes.
- `Pricing.tsx` — 3 planned tiers.
- `FinalCta.tsx` + `Footer.tsx`.
- Shared bits: a `useReveal` (IntersectionObserver) hook and a
  `WaitlistForm` component used by Hero and FinalCta.

Waitlist plumbing:

- `supabase/migrations/023_early_access_signup.sql` —
  `early_access_signup(id uuid pk default, email text unique not null,
  created_at timestamptz default now())`, RLS enabled, one INSERT policy
  for `anon` + `authenticated`, **no SELECT/UPDATE/DELETE policies**
  (read via dashboard/MCP only). Apply via Supabase MCP with matching
  repo file, per CLAUDE.md convention. Schema change requires explicit
  user approval at apply time.
- `src/lib/waitlist.ts` — `joinWaitlist(email)` using the existing
  `runSupabaseAction`. Deliberately NOT a store slice: the landing page
  must not mount/depend on the app store. Unique-violation maps to a
  friendly "already on the list" success state.

## Motion / interaction

- Scroll-staggered reveals (IntersectionObserver toggling CSS
  transitions), hover-lift on cards, count-up stats, marquee logo wall,
  animated radial accent glow in the hero, magnetic-ish primary button.
- Everything guarded by `prefers-reduced-motion: reduce` (reveals render
  visible, marquee/count-ups/pitch loop settle to static end states).
- Dark pinning: the landing root re-declares the dark token values on a
  local class so `data-theme="light"` visitors still get the dark page.
  Canvas colors come from `pitchTheme.ts` untouched.

## Verification

- `npm run build` + `npm run lint` clean (4 known warnings allowed).
- Live browser-pane walkthrough signed-out at desktop and 375×812:
  every section renders, no console errors on a fresh tab, no horizontal
  page scroll.
- Waitlist: submit a test email, confirm the row lands via MCP
  `execute_sql`; duplicate submit shows the friendly state.
- Signed-in regression: Dashboard still at `/`, all app routes fine.
  Share routes fine. Reduced-motion spot check.
- Known harness limits (HANDOFF.md): rAF is suspended in the pane, so
  the hero loop is verified by `frameAt` sampling + the user's own look;
  network-request inspection doesn't capture Supabase — verify writes by
  querying the table.
