# Gaffer Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dark, award-calibre marketing landing page served at `/` to signed-out visitors of the Gaffer app, with a live animated pitch demo, early-access waitlist capture, and micro-animated feature showcase.

**Architecture:** New `src/pages/landing/` folder of section components composed by `LandingPage.tsx`, mounted by a small routing change in `App.tsx`'s signed-out branch. The hero reuses the real engine (`PitchCanvas` + `frameAt` + `useTimelinePlayback`) on a hardcoded demo scene. Waitlist emails go to a new RLS-locked Supabase table via a small non-store helper.

**Tech Stack:** Existing stack only — React 19, Vite, Tailwind v4 tokens, react-konva (already bundled), Supabase. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-26-landing-page-design.md`

## Global Constraints

- **No test suite exists in this repo.** The verify cycle per task is: `npm run build` (must pass, run from `/Users/max/Desktop/app/gaffer`), `npm run lint` (0 errors; the 4 known warnings in `SessionPlanner.tsx`, `AttendancePage.tsx`, and 2 in tactic files are allowed), plus a live check in the Browser pane dev server. Never use Bash to run the dev server — use the preview tools.
- **Design tokens only** (design.md): `bg-surface`, `bg-panel`, `bg-panel-raised`, `border-line`/`border-line-strong`, `text-ink`/`text-ink-muted`/`text-ink-faint`, `bg-accent`/`hover:bg-accent-hover`, `text-ok`/`text-warn`/`text-bad`. Never raw slate/indigo classes or hex values in chrome. No drop shadows on surfaces (`panel-edge` + hairline borders give depth). `rounded-xl` panels, `rounded-md`/`rounded-lg` controls, `rounded-full` pills. Inter only — hierarchy via weight/size/`tracking-tight`, never a second font.
- **Accent is scarce**: primary buttons, focus, small highlights. Never a section background or card fill.
- **The landing page is dark-only** — pinned via a `.landing-dark` scope (Task 3) so `data-theme="light"` visitors still see dark.
- **All motion respects `prefers-reduced-motion: reduce`**: reveals render visible, marquee/count-ups stop, hero pitch shows a static frame.
- **Placeholder content rule**: every invented testimonial and every real-club name carries a `// PLACEHOLDER — private mockup, replace before real marketing use` comment. Real club names appear as styled TEXT only — never recreate crest artwork.
- Components never call `supabase.from()` — except the one documented deviation in Task 2 (`joinWaitlist` helper, which needs the PostgrestError `code` that `runSupabaseAction` deliberately erases; it is not a store action and the landing page must not mount the store).
- Signed-in app behaviour, `/d/:token`, `/t/:token`, and password recovery must be byte-for-byte unaffected.
- Browser-pane quirks (HANDOFF.md): rAF is suspended (`document.hidden` is true) so animation loops can't be watched — verify via `frameAt` sampling in `javascript_tool`; `computer` clicks that trigger transitions/writes may time out after succeeding — verify state via `read_page`/JS, not the click result; console errors in long-lived tabs are often stale HMR residue — always re-check in a fresh tab.
- Commit after every task (repo is `/Users/max/Desktop/app/gaffer`; the parent dir is not a git repo).

---

### Task 1: Public routing — landing skeleton at `/`, login at `/login`

**Files:**
- Create: `src/pages/landing/LandingPage.tsx` (skeleton; real sections come in Tasks 3–7)
- Modify: `src/App.tsx` (signed-out branch of `AuthedApp` only)

**Interfaces:**
- Produces: `LandingPage` (default-less named export, no props). Route contract: signed-out `/` → landing, `/login` → `Login`, `*` → `/`; signed-in `/login` → `/`.
- Consumes: existing `Login` component (renders with no props).

- [ ] **Step 1: Create the skeleton page**

```tsx
// src/pages/landing/LandingPage.tsx
// The public marketing page (landing-page spec, 2026-08-26). Sections land
// in later tasks; this skeleton exists so routing can ship first.
export function LandingPage() {
  return (
    <div className="min-h-svh bg-surface text-ink">
      <main className="mx-auto flex min-h-svh max-w-5xl flex-col items-center justify-center px-6">
        <h1 className="text-4xl font-semibold tracking-tight">Gaffer</h1>
        <p className="mt-2 text-ink-muted">Landing page under construction.</p>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Rewire the signed-out branch in `App.tsx`**

Replace the current `if (!session) return <Login />` in `AuthedApp` with a routed marketing branch, and give signed-in users a `/login` escape hatch. The final `AuthedApp` shape:

```tsx
import { LandingPage } from './pages/landing/LandingPage'
// ...existing imports unchanged

function AuthedApp() {
  const { session, loading, isPasswordRecovery, clearPasswordRecovery } = useSession()

  if (loading) { /* unchanged */ }
  if (isPasswordRecovery) { /* unchanged */ }

  if (!session) {
    // Signed-out visitors get the marketing site: landing at `/`, the real
    // sign-in/sign-up screen at `/login`, everything else back to `/`.
    // Share pages never reach here — they're routed above the gate in App().
    return (
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      {/* signed-in: a stray /login (bookmark, back button) goes home */}
      <Route path="login" element={<Navigate to="/" replace />} />
      {/* everything below unchanged from today */}
      ...
    </Routes>
  )
}
```

Keep every existing signed-in route exactly as-is; the only signed-in addition is the `login` redirect.

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint` — expect clean (4 known warnings allowed).

- [ ] **Step 4: Verify live, signed out AND signed in**

Start the dev server via `preview_start` (launch.json entry `gaffer` if present, else create one for `npm run dev`, port 5173). In a fresh tab:
1. Signed out: `/` shows the skeleton; `/login` shows the sign-in card; `/roster` redirects to `/`. No console errors.
2. Sign in with the test account (`gaffertest2026v2@gmail.com` / `TestPass123!`): `/` is the Dashboard as before; visiting `/login` redirects to `/`. Sign back out (the landing should reappear at `/`).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/landing/LandingPage.tsx
git commit -m "feat: public landing route at / for signed-out visitors, login moves to /login"
```

---

### Task 2: Waitlist backend + `WaitlistForm`

**Files:**
- Create: `supabase/migrations/023_early_access_signup.sql`
- Create: `src/lib/waitlist.ts`
- Create: `src/pages/landing/WaitlistForm.tsx`

**Interfaces:**
- Produces: `joinWaitlist(email: string): Promise<'ok' | 'duplicate' | 'error'>`; `WaitlistForm({ id?: string })` — a self-contained email input + submit button + inline status, used by Hero (Task 4) and FinalCta (Task 7).
- Consumes: `supabase` client from `src/lib/supabase.ts`.

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/023_early_access_signup.sql
--
-- Early-access waitlist for the public landing page (landing-page spec,
-- 2026-08-26). Write-only from the app: anon visitors may INSERT their
-- email and nothing else — no select/update/delete policies exist, so the
-- list is readable only via the dashboard / MCP. The coach's own signed-in
-- role gets no read policy either, deliberately: nothing in the app reads
-- this table.

create table public.early_access_signup (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  constraint early_access_signup_email_format
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

alter table public.early_access_signup enable row level security;

create policy early_access_signup_insert_anyone
  on public.early_access_signup
  for insert
  to anon, authenticated
  with check (true);
```

- [ ] **Step 2: Apply via Supabase MCP (`apply_migration`, name `023_early_access_signup`)**

This is a schema change — the permission prompt to the user at this point IS the expected approval flow. After applying, confirm with `list_tables` that the table exists with RLS enabled.

- [ ] **Step 3: Write the helper**

```ts
// src/lib/waitlist.ts
import { supabase } from './supabase'

// Landing-page waitlist insert. Deliberately NOT a store action and NOT
// routed through runSupabaseAction: the landing page must not mount the app
// store, and this needs the PostgrestError *code* (23505 = duplicate email,
// a success case here) which runSupabaseAction deliberately flattens into a
// user-facing message. This is the one sanctioned direct supabase call
// outside the store (landing-page spec, 2026-08-26).
export type WaitlistResult = 'ok' | 'duplicate' | 'error'

export async function joinWaitlist(email: string): Promise<WaitlistResult> {
  try {
    const { error } = await supabase
      .from('early_access_signup')
      .insert({ email: email.trim().toLowerCase() })
    if (!error) return 'ok'
    if (error.code === '23505') return 'duplicate'
    console.error('[waitlist]', error.message)
    return 'error'
  } catch (err) {
    console.error('[waitlist] unexpected', err)
    return 'error'
  }
}
```

- [ ] **Step 4: Write `WaitlistForm`**

```tsx
// src/pages/landing/WaitlistForm.tsx
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
```

Mount it temporarily in the Task 1 skeleton (`<WaitlistForm />` under the placeholder heading) so it's verifiable now.

- [ ] **Step 5: Build + lint, then verify the writes live**

`npm run build && npm run lint`. In the Browser pane, signed out: submit `landing-test@example.com` → success line appears. Submit it again → "already on the list". Confirm via MCP `execute_sql`: `select email from early_access_signup;` returns exactly one row for that address. Bad string (`notanemail`) is blocked by the browser's native email validation.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/023_early_access_signup.sql src/lib/waitlist.ts src/pages/landing/WaitlistForm.tsx src/pages/landing/LandingPage.tsx
git commit -m "feat: early-access waitlist (migration 023, joinWaitlist, WaitlistForm)"
```

---

### Task 3: Landing shell — dark pinning, reveal machinery, nav, footer

**Files:**
- Modify: `src/index.css` (append a `.landing-dark` block)
- Create: `src/pages/landing/useReveal.ts`
- Create: `src/pages/landing/Reveal.tsx`
- Create: `src/pages/landing/LandingNav.tsx`
- Create: `src/pages/landing/Footer.tsx`
- Modify: `src/pages/landing/LandingPage.tsx` (compose shell; section placeholders)

**Interfaces:**
- Produces: `useReveal<T>(): { ref, shown }`; `Reveal({ children, delay?, className? })` — scroll-reveal wrapper all later sections use; `LandingNav` (no props); `Footer` (no props). Section anchor ids fixed here and used by nav links: `#product`, `#features`, `#pricing`, `#cta`.
- Consumes: `WaitlistForm` (Task 2).

- [ ] **Step 1: Pin dark tokens in `index.css`**

Append after the existing theme blocks (copy the dark values that already sit on `:root` — do NOT invent new colors; if the root defaults ever change, this block is the marketing snapshot of them):

```css
/* Landing page (landing-page spec 2026-08-26): the marketing surface is
   dark-only. Scoping the dark values under .landing-dark beats toggling
   data-theme, which would flash the coach's stored light preference on
   sign-in. Values mirror the :root dark defaults above. */
.landing-dark {
  --color-surface: #010102;
  --color-panel: #0f1011;
  --color-panel-raised: #141516;
  --color-line: #23252a;
  --color-line-strong: #34343a;
  --color-ink: #f7f8f8;
  --color-ink-muted: #8a8f98;
  --color-ink-faint: #62666d;
  --color-accent: #5e6ad2;
  --color-accent-hover: #828fff;
  --color-ok: #27a644;
  --color-warn: #d08b3a;
  --color-bad: #e5484d;
  color-scheme: dark;
}
```

Also add (same block region) the two keyframe animations later tasks use:

```css
@keyframes landing-marquee {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
@keyframes landing-glow {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -30%) scale(1); }
  50% { opacity: 0.8; transform: translate(-50%, -30%) scale(1.15); }
}
@media (prefers-reduced-motion: reduce) {
  .landing-dark * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
}
```

- [ ] **Step 2: Reveal machinery**

```ts
// src/pages/landing/useReveal.ts
import { useEffect, useRef, useState } from 'react'

// One IntersectionObserver per revealed element: flips `shown` once when the
// element first enters the viewport, then disconnects. Reduced-motion users
// (and SSR-less first paint above the fold) get `shown` immediately.
export function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  return { ref, shown }
}
```

```tsx
// src/pages/landing/Reveal.tsx
import { useReveal } from './useReveal'

// Scroll-reveal wrapper: fades + rises 16px on first viewport entry.
// `delay` staggers siblings (ms). Pure CSS transition — no animation lib.
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const { ref, shown } = useReveal<HTMLDivElement>()
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-[opacity,transform] duration-700 ease-out ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      } ${className}`}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Nav and footer**

```tsx
// src/pages/landing/LandingNav.tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
]

// Fixed marketing nav. Transparent over the hero; once scrolled it gains a
// hairline border + translucent blur so content sliding beneath reads as
// depth without a shadow (design.md: no shadows).
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrolled ? 'border-b border-line bg-surface/80 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="text-base font-semibold tracking-tight text-ink">
          Gaffer
        </a>
        <div className="hidden items-center gap-6 sm:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Sign in
          </Link>
          <a
            href="#cta"
            className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Get early access
          </a>
        </div>
      </nav>
    </header>
  )
}
```

```tsx
// src/pages/landing/Footer.tsx
import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <div>
          <p className="text-sm font-semibold tracking-tight text-ink">Gaffer</p>
          <p className="mt-1 text-xs text-ink-faint">The coaching workspace for football.</p>
        </div>
        <div className="flex items-center gap-6 text-xs text-ink-muted">
          <a href="#features" className="transition-colors hover:text-ink">Features</a>
          <a href="#pricing" className="transition-colors hover:text-ink">Pricing</a>
          <Link to="/login" className="transition-colors hover:text-ink">Sign in</Link>
        </div>
        <p className="text-xs text-ink-faint">© 2026 Gaffer. Built for coaches.</p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Compose the shell in `LandingPage.tsx`**

```tsx
import { LandingNav } from './LandingNav'
import { Footer } from './Footer'
import { WaitlistForm } from './WaitlistForm'

// Section components replace these stubs in Tasks 4–7, in this order.
export function LandingPage() {
  return (
    <div id="top" className="landing-dark min-h-svh scroll-smooth bg-surface text-ink">
      <LandingNav />
      <main>
        {/* Task 4: <Hero /> */}
        {/* Task 5: <LogoWall /> <StatsStrip /> */}
        {/* Task 6: <FeatureSections /> */}
        {/* Task 7: <Testimonials /> <Pricing /> <FinalCta /> */}
        <section className="flex min-h-svh flex-col items-center justify-center gap-6 px-6">
          <h1 className="text-4xl font-semibold tracking-tight">Gaffer</h1>
          <WaitlistForm />
        </section>
      </main>
      <Footer />
    </div>
  )
}
```

- [ ] **Step 5: Build + lint + live check**

`npm run build && npm run lint`. In the pane: nav fixed on top and gains its border after scrolling; "Sign in" routes to `/login`; set `localStorage['gaffer-theme']='light'` then reload `/` — landing stays dark (then clear it).

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/pages/landing/
git commit -m "feat: landing shell — dark pinning, reveal machinery, nav, footer"
```

---

### Task 4: Hero with live animated pitch

**Files:**
- Create: `src/pages/landing/demoScene.ts`
- Create: `src/pages/landing/HeroPitch.tsx`
- Create: `src/pages/landing/Hero.tsx`
- Modify: `src/pages/landing/LandingPage.tsx` (mount `<Hero />`, drop the stub section; `HeroPitch` loads via `React.lazy` + `Suspense`)

**Interfaces:**
- Consumes: `PitchCanvas({ pitch, frame, maxWidth })`, `frameAt(scene, keyframes, t)`, `useTimelinePlayback(duration)` (`.play()`, `.toggleLoop()`, `.currentTime`), `WaitlistForm`, `Reveal`.
- Produces: `DEMO_SCENE: { scene: DrillScene; keyframes: Keyframe[]; duration: number; pitch: PitchConfig }`; `HeroPitch` (default export for `React.lazy`, no props); `Hero` (no props).

- [ ] **Step 1: Author the demo scene**

A landscape full-pitch build-up: back line circulates, the ball is worked from GK to right winger to a runner arriving in the box, ~8 players + 4 passive opponents + ball, 5 keyframes over 10s. Exact starting code (coordinates are normalized 0–1, landscape, home attacking +x; tune positions visually in Step 4 — the STRUCTURE below is the contract):

```ts
// src/pages/landing/demoScene.ts
import type { DrillScene, Keyframe, PitchConfig, SceneEntity } from '../../store'

// The hero's looping build-up pattern. Hand-authored, never persisted —
// the landing page must not touch Supabase for its demo. Same shapes the
// real editors store, which is the point: the hero runs the actual engine.

const player = (id: string, team: 'A' | 'B', number: number, goalkeeper = false): SceneEntity => ({
  id, kind: 'player', team, number, goalkeeper,
})

const entities: SceneEntity[] = [
  player('gk', 'A', 1, true),
  player('rb', 'A', 2), player('rcb', 'A', 4), player('lcb', 'A', 5), player('lb', 'A', 3),
  player('cm', 'A', 8), player('rw', 'A', 7), player('st', 'A', 9),
  player('o1', 'B', 9), player('o2', 'B', 10), player('o3', 'B', 8), player('o4', 'B', 6),
  { id: 'ball', kind: 'ball' },
]

const kf = (id: string, t: number, states: Keyframe['states']): Keyframe => ({ id, t, states })

// y: 0 = left touchline (nearest viewer bottom in landscape render), x: 0 = own goal.
const keyframes: Keyframe[] = [
  kf('k1', 0, {
    gk: { x: 0.06, y: 0.5 }, rb: { x: 0.22, y: 0.82 }, rcb: { x: 0.18, y: 0.62 },
    lcb: { x: 0.18, y: 0.38 }, lb: { x: 0.22, y: 0.18 }, cm: { x: 0.34, y: 0.5 },
    rw: { x: 0.52, y: 0.88 }, st: { x: 0.55, y: 0.45 },
    o1: { x: 0.3, y: 0.5 }, o2: { x: 0.42, y: 0.66 }, o3: { x: 0.42, y: 0.34 }, o4: { x: 0.56, y: 0.5 },
    ball: { x: 0.08, y: 0.5 },
  }),
  kf('k2', 2.5, {
    gk: { x: 0.06, y: 0.5 }, rcb: { x: 0.2, y: 0.64 }, ball: { x: 0.2, y: 0.63 },
    rb: { x: 0.3, y: 0.85 }, cm: { x: 0.38, y: 0.52 }, o1: { x: 0.26, y: 0.55 },
  }),
  kf('k3', 5, {
    rb: { x: 0.42, y: 0.88 }, ball: { x: 0.41, y: 0.86 }, rcb: { x: 0.24, y: 0.62 },
    rw: { x: 0.62, y: 0.8 }, st: { x: 0.6, y: 0.5 }, o2: { x: 0.5, y: 0.72 }, o4: { x: 0.6, y: 0.55 },
  }),
  kf('k4', 7.5, {
    rw: { x: 0.78, y: 0.78 }, ball: { x: 0.77, y: 0.76 }, rb: { x: 0.5, y: 0.86 },
    st: { x: 0.78, y: 0.48 }, cm: { x: 0.55, y: 0.55 }, o3: { x: 0.62, y: 0.4 }, o4: { x: 0.72, y: 0.52 },
  }),
  kf('k5', 10, {
    ball: { x: 0.9, y: 0.5 }, st: { x: 0.88, y: 0.47 }, rw: { x: 0.82, y: 0.72 },
    cm: { x: 0.66, y: 0.5 }, o4: { x: 0.8, y: 0.5 },
  }),
]

export const DEMO_SCENE: {
  scene: DrillScene
  keyframes: Keyframe[]
  duration: number
  pitch: PitchConfig
} = {
  scene: { entities, markings: [] },
  keyframes,
  duration: 10,
  pitch: {
    preset: 'full',
    lengthMeters: 105,
    widthMeters: 68,
    orientation: 'landscape',
    markings: 'full',
    overlays: [],
    units: 'm',
  },
}
```

Note: `frameAt` carries unspecified entities forward from the previous keyframe, so later keyframes only list movers — verify this matches `interpolate.ts` behaviour when implementing; if it does not, repeat all states per keyframe.

- [ ] **Step 2: `HeroPitch` — the live canvas (lazy-loaded)**

```tsx
// src/pages/landing/HeroPitch.tsx
import { useEffect, useMemo } from 'react'
import { PitchCanvas } from '../../components/design/PitchCanvas'
import { frameAt } from '../../components/design/canvas/interpolate'
import { useTimelinePlayback } from '../../components/design/timeline/useTimelinePlayback'
import { DEMO_SCENE } from './demoScene'

// The hero's proof: the real PitchCanvas running the real interpolator on a
// looping build-up. Default export so LandingPage can React.lazy() it —
// react-konva stays out of the landing page's first paint.
export default function HeroPitch() {
  const playback = useTimelinePlayback(DEMO_SCENE.duration)
  const frame = useMemo(
    () => frameAt(DEMO_SCENE.scene, DEMO_SCENE.keyframes, playback.currentTime),
    [playback.currentTime]
  )

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    playback.toggleLoop()
    playback.play()
    // Once per mount: the hero autoplays for its whole life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <PitchCanvas pitch={DEMO_SCENE.pitch} frame={frame} maxWidth={720} />
}
```

- [ ] **Step 3: `Hero` — copy, waitlist, framed demo**

Layout: centered column; eyebrow pill → H1 → subcopy → `WaitlistForm` → app-window frame containing the lazy `HeroPitch`, with the animated accent glow behind it. Exact copy (final — do not improvise new claims):

```tsx
// src/pages/landing/Hero.tsx
import { Suspense, lazy } from 'react'
import { Reveal } from './Reveal'
import { WaitlistForm } from './WaitlistForm'

const HeroPitch = lazy(() => import('./HeroPitch'))

export function Hero() {
  return (
    <section id="product" className="relative overflow-hidden px-6 pb-24 pt-36">
      {/* ambient accent glow — decorative only */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[900px] rounded-full opacity-60 blur-3xl"
        style={{
          transform: 'translate(-50%, -30%)',
          background: 'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 22%, transparent), transparent)',
          animation: 'landing-glow 9s ease-in-out infinite',
        }}
      />
      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <Reveal>
          <p className="rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium text-ink-muted">
            Early access — now open for founding clubs
          </p>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            Coach like a gaffer.
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-5 max-w-xl text-base text-ink-muted sm:text-lg">
            Session planning, drill design and animated tactics in one fast,
            pitch-side workspace. Built by a coach, for coaches.
          </p>
        </Reveal>
        <Reveal delay={240} className="mt-8 flex w-full justify-center">
          <WaitlistForm id="hero-waitlist" />
        </Reveal>
      </div>

      <Reveal delay={320} className="relative mx-auto mt-16 max-w-4xl">
        <div className="panel-edge overflow-hidden rounded-xl border border-line bg-panel p-2 sm:p-3">
          {/* app-window chrome strip */}
          <div className="mb-2 flex items-center gap-1.5 px-2 pt-1">
            <span className="h-2.5 w-2.5 rounded-full bg-panel-raised" />
            <span className="h-2.5 w-2.5 rounded-full bg-panel-raised" />
            <span className="h-2.5 w-2.5 rounded-full bg-panel-raised" />
            <span className="ml-3 text-xs text-ink-faint">Tactics — 4-3-3 build-up</span>
          </div>
          <Suspense fallback={<div className="aspect-[105/68] w-full rounded-lg bg-panel-raised" />}>
            <HeroPitch />
          </Suspense>
        </div>
      </Reveal>
    </section>
  )
}
```

- [ ] **Step 4: Build + lint + live verify, then tune the choreography**

`npm run build && npm run lint`. In the pane (fresh tab, signed out): hero renders, canvas shows the pitch with players. rAF is suspended in the pane, so verify motion via `javascript_tool`: sample the interpolation (`import('/src/pages/landing/demoScene.ts')` through the dev-server module graph, run `frameAt` at t=0/2.5/5/7.5/10 via `import('/src/components/design/canvas/interpolate.ts')`) — all entities finite, ball travels GK→RCB→RB→RW→box. Screenshot the static render; positions that look wrong get their coordinates tuned here (keyframe STRUCTURE stays as authored).

- [ ] **Step 5: Commit**

```bash
git add src/pages/landing/
git commit -m "feat: landing hero with live animated pitch demo"
```

---

### Task 5: Logo wall + stats strip

**Files:**
- Create: `src/pages/landing/LogoWall.tsx`
- Create: `src/pages/landing/StatsStrip.tsx`
- Modify: `src/pages/landing/LandingPage.tsx` (mount both after `<Hero />`)

**Interfaces:**
- Consumes: `Reveal`, `useReveal`, the `landing-marquee` keyframes from Task 3.
- Produces: nothing later tasks import.

- [ ] **Step 1: `LogoWall` — marquee of club wordmarks**

```tsx
// src/pages/landing/LogoWall.tsx
// PLACEHOLDER — private mockup only. Real club names as styled TEXT
// wordmarks (no crest artwork — never reproduce club crests). Replace with
// real customers before any genuine marketing use.
const CLUBS = [
  'Arsenal', 'FC Barcelona', 'Manchester City', 'Borussia Dortmund',
  'Ajax', 'Inter', 'Olympique Lyonnais', 'Celtic',
]

export function LogoWall() {
  const row = [...CLUBS, ...CLUBS] // doubled for a seamless -50% loop
  return (
    <section aria-label="Clubs using Gaffer" className="border-y border-line py-10">
      <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-ink-faint">
        Trusted on touchlines everywhere
      </p>
      <div
        className="overflow-hidden"
        style={{ maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}
      >
        <div
          className="flex w-max items-center gap-14 pr-14"
          style={{ animation: 'landing-marquee 36s linear infinite' }}
        >
          {row.map((club, i) => (
            <span
              key={`${club}-${i}`}
              aria-hidden={i >= CLUBS.length}
              className="whitespace-nowrap text-lg font-semibold tracking-tight text-ink-faint transition-colors hover:text-ink-muted"
            >
              {club}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: `StatsStrip` — count-up product facts (all true)**

```tsx
// src/pages/landing/StatsStrip.tsx
import { useEffect, useState } from 'react'
import { useReveal } from './useReveal'

const STATS: { value: number; suffix: string; label: string }[] = [
  { value: 29, suffix: '', label: 'built-in formations' },
  { value: 13, suffix: '', label: 'drawing tools' },
  { value: 30, suffix: ' fps', label: 'animation timeline' },
  { value: 100, suffix: '%', label: 'works offline' },
]

function CountUp({ to, suffix, run }: { to: number; suffix: string; run: boolean }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!run) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(to)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 1200)
      setN(Math.round(to * (1 - Math.pow(1 - p, 3)))) // ease-out cubic
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, to])
  return (
    <span className="text-4xl font-semibold tracking-tight text-ink">
      {n}
      {suffix}
    </span>
  )
}

export function StatsStrip() {
  const { ref, shown } = useReveal<HTMLDivElement>(0.4)
  return (
    <section ref={ref} className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-16 sm:grid-cols-4">
      {STATS.map((s) => (
        <div key={s.label} className="flex flex-col items-center gap-1 text-center">
          <CountUp to={s.value} suffix={s.suffix} run={shown} />
          <span className="text-sm text-ink-muted">{s.label}</span>
        </div>
      ))}
    </section>
  )
}
```

- [ ] **Step 3: Mount, build + lint, live verify**

Mount both in `LandingPage` between Hero and the features stub. `npm run build && npm run lint`. Pane check: marquee scrolls (if rAF suspension also halts CSS animations in the pane, verify the animation property via `getComputedStyle` instead), edges fade via the mask, stats count up when scrolled into view. Note for verification honesty: CSS animations may genuinely not be observable in the pane — computed-style checks + a screenshot of the resting state are the acceptance evidence, plus the user's own look later.

- [ ] **Step 4: Commit**

```bash
git add src/pages/landing/
git commit -m "feat: landing logo wall and stats strip"
```

---

### Task 6: Feature vignettes

**Files:**
- Create: `src/pages/landing/FeatureSections.tsx`
- Modify: `src/pages/landing/LandingPage.tsx` (mount after `StatsStrip`)

**Interfaces:**
- Consumes: `Reveal`.
- Produces: nothing later tasks import. Section carries `id="features"`.

- [ ] **Step 1: Build the four vignettes**

One file, one internal `Vignette` layout component, four data-driven instances, alternating text/visual sides on `lg:`. Exact copy (final):

1. **Eyebrow** "Drill designer" — **H** "Draw drills players actually understand." — **Body** "Thirteen drawing tools, eight equipment types and four pitch formats. Sketch the movement, set the keyframes, and share a living drill card with one link — no more whiteboard photos in the group chat." — bullets: "Animated keyframe timeline", "Witches' hats to mannequins — real training kit", "Share read-only drill cards with any coach".
2. **Eyebrow** "Tactics board" — **H** "Your game model, animated." — **Body** "Twenty-nine built-in formations that know a right-back from a wing-back. Bind markers to your real roster, animate phases of play, and present it like you mean it." — bullets: "Roster-linked player markers", "Home and away boards, single or dual view", "Phases, spotlights and highlights for the team talk".
3. **Eyebrow** "Sessions & attendance" — **H** "Matchday-ready in minutes, not evenings." — **Body** "Plan sessions from your drill library, track who's coming, and take attendance in two taps from the touchline. The admin disappears; the coaching stays." — bullets: "Session planner built on your own drills", "Availability at a glance", "Two-tap attendance, pitch-side".
4. **Eyebrow** "Pitch-side PWA" — **H** "Works where wifi doesn't." — **Body** "Gaffer installs to your phone and keeps your plans readable with zero bars — dark interface, floodlight-friendly, built for the touchline rather than the office." — bullets: "Installs like a native app", "Session plans readable offline", "Fast on a three-year-old phone".

Visual side per vignette: a `panel-edge rounded-xl border border-line bg-panel` card containing a stylised, hand-built CSS/SVG vignette (NOT screenshots): (1) a mini pitch SVG with a dashed run-arrow and three player dots; (2) a 4-3-3 dot grid morphing on hover (`transition-transform` on each dot, `group-hover` offsets); (3) a mini attendance row list with `text-ok`/`text-warn`/`text-bad` status dots; (4) a phone outline with a mini pitch inside and an "Offline" `Badge`-style pill. Each visual uses only tokens; hover lifts the card `-translate-y-1` with a border brighten to `border-line-strong` (`transition` 300ms). Structure:

```tsx
// src/pages/landing/FeatureSections.tsx
import { Reveal } from './Reveal'

interface VignetteSpec {
  eyebrow: string
  heading: string
  body: string
  bullets: string[]
  visual: React.ReactNode
}

function Vignette({ spec, flip }: { spec: VignetteSpec; flip: boolean }) {
  return (
    <Reveal>
      <div className={`grid items-center gap-10 lg:grid-cols-2 ${flip ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div>
          <p className="text-sm font-semibold text-accent">{spec.eyebrow}</p>
          <h3 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{spec.heading}</h3>
          <p className="mt-4 text-base text-ink-muted">{spec.body}</p>
          <ul className="mt-6 space-y-2">
            {spec.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-ink">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="group panel-edge rounded-xl border border-line bg-panel p-6 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong">
          {spec.visual}
        </div>
      </div>
    </Reveal>
  )
}

export function FeatureSections() {
  return (
    <section id="features" className="mx-auto max-w-6xl space-y-28 px-6 py-24">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-semibold tracking-tight">Everything between whistle and whiteboard</h2>
          <p className="mt-3 text-ink-muted">One workspace for the whole coaching week.</p>
        </div>
      </Reveal>
      {/* four <Vignette spec={...} flip={i % 2 === 1} /> instances with the copy above */}
    </section>
  )
}
```

The four `visual` nodes are built inline in this file as small components (`DrillVisual`, `FormationVisual`, `AttendanceVisual`, `PwaVisual`) — each ≤40 lines of JSX/SVG using tokens via `currentColor`/CSS vars (e.g. `stroke="var(--color-line-strong)"`, dots `fill="var(--color-accent)"`).

- [ ] **Step 2: Build + lint + live verify**

`npm run build && npm run lint`. Pane: four vignettes alternate sides on desktop, stack on mobile (375px — no horizontal page scroll: check `document.body.scrollWidth === 375`), reveals fire on scroll, hover lifts cards.

- [ ] **Step 3: Commit**

```bash
git add src/pages/landing/
git commit -m "feat: landing feature vignettes"
```

---

### Task 7: Testimonials, pricing, final CTA

**Files:**
- Create: `src/pages/landing/Testimonials.tsx`
- Create: `src/pages/landing/Pricing.tsx`
- Create: `src/pages/landing/FinalCta.tsx`
- Modify: `src/pages/landing/LandingPage.tsx` (mount all three after `FeatureSections`, before `Footer`)

**Interfaces:**
- Consumes: `Reveal`, `WaitlistForm`.
- Produces: `Pricing` section id `pricing`; `FinalCta` section id `cta` (nav/footer anchors from Task 3 point here).

- [ ] **Step 1: `Testimonials` — three quote cards**

```tsx
// src/pages/landing/Testimonials.tsx
import { Reveal } from './Reveal'

// PLACEHOLDER — private mockup only. Invented people; real club names used
// as placeholder affiliations at the owner's request. Replace all three
// before any genuine marketing use.
const QUOTES = [
  {
    quote: 'We sketch a press trigger at half-time and the players watch it move. That change alone is worth it.',
    name: 'Marco Reinholt',
    role: 'Academy Coach, Borussia Dortmund',
  },
  {
    quote: 'Session planning used to eat my Sunday nights. Now it is twenty minutes on the sofa, drills and all.',
    name: 'Sofía Álvarez',
    role: 'U15 Head Coach, FC Barcelona',
  },
  {
    quote: 'The first coaching tool my volunteer coaches did not need a training evening for.',
    name: 'Danny Whitlow',
    role: 'Foundation Phase Lead, Arsenal',
  },
]

export function Testimonials() {
  return (
    <section className="border-t border-line px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <h2 className="text-center text-4xl font-semibold tracking-tight">Coaches talk</h2>
        </Reveal>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {QUOTES.map((q, i) => (
            <Reveal key={q.name} delay={i * 100}>
              <figure className="panel-edge flex h-full flex-col justify-between rounded-xl border border-line bg-panel p-6 transition-all duration-300 hover:-translate-y-1 hover:border-line-strong">
                <blockquote className="text-base leading-relaxed text-ink">“{q.quote}”</blockquote>
                <figcaption className="mt-6">
                  <p className="text-sm font-semibold text-ink">{q.name}</p>
                  <p className="text-xs text-ink-muted">{q.role}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: `Pricing` — three planned tiers**

Copy (final; all CTAs anchor to `#cta` — the waitlist is the only signup path):

- **Starter** — Free. "For the coach with one squad and a plan." — 1 team · Full drill designer · Session planning & attendance · 5 active share links. Button: "Join the waitlist" (outline style: `border border-line hover:border-line-strong text-ink`).
- **Club** — £9/mo per coach, badge "Most popular", accent border. "For coaches who live in pre-season all year." — Unlimited teams · Animated tactics board · 29 formations + custom formations · Unlimited share links · Priority support. Button: "Join the waitlist" (solid accent).
- **Organisation** — "Let's talk". "For academies and multi-team clubs." — Everything in Club · Multi-coach teams · Roster import · Onboarding for your staff. Button: "Join the waitlist" (outline).

Header: H2 "Early-access pricing" + line "Planned launch pricing — waitlist members lock in these rates. Free during early access." Cards: `panel-edge rounded-xl border bg-panel p-8`; the Club card uses `border-accent` (the sanctioned scarce-accent highlight) and a small `text-accent` "Most popular" label — accent never fills a card background. Price line: `text-4xl font-semibold tracking-tight` + `text-sm text-ink-muted` period. Feature list mirrors the bullet pattern from Task 6 (small accent dot + `text-sm`). Section: `id="pricing"`, `mx-auto max-w-6xl px-6 py-24`, `grid gap-6 lg:grid-cols-3`, each card in a staggered `Reveal`.

- [ ] **Step 3: `FinalCta`**

```tsx
// src/pages/landing/FinalCta.tsx
import { Reveal } from './Reveal'
import { WaitlistForm } from './WaitlistForm'

export function FinalCta() {
  return (
    <section id="cta" className="relative overflow-hidden border-t border-line px-6 py-28">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-full h-[500px] w-[800px] rounded-full blur-3xl"
        style={{
          transform: 'translate(-50%, -40%)',
          background: 'radial-gradient(closest-side, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent)',
        }}
      />
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <Reveal>
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Be first on the team sheet.</h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="mt-4 text-ink-muted">
            Early access is rolling out club by club. Free while it does.
          </p>
        </Reveal>
        <Reveal delay={200} className="mt-8 flex w-full justify-center">
          <WaitlistForm id="cta-waitlist" />
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Build + lint + live verify**

`npm run build && npm run lint`. Pane: nav "Pricing" anchor lands on the pricing grid; every tier button scrolls to `#cta`; second waitlist form works independently of the hero's (submit another test address, confirm the row via `execute_sql`); Club card reads highlighted but not accent-filled.

- [ ] **Step 5: Commit**

```bash
git add src/pages/landing/
git commit -m "feat: landing testimonials, pricing, final CTA"
```

---

### Task 8: Polish + full verification sweep + docs

**Files:**
- Modify: any `src/pages/landing/*` file the sweep flags (visual tuning only)
- Modify: `HANDOFF.md` (new session-log entry at top)

**Interfaces:** none new.

- [ ] **Step 1: Desktop sweep (fresh tab, signed out, default pane size)**

Full-page scroll of `/`: every section present in order (Nav / Hero / LogoWall / StatsStrip / Features / Testimonials / Pricing / FinalCta / Footer), zero console errors, all three nav anchors land correctly, hero demo canvas rendered, `Sign in` → `/login` → back button returns to `/`.

- [ ] **Step 2: Mobile sweep (`resize_window` preset mobile, reload)**

375×812: no horizontal page scroll (`document.body.scrollWidth === 375`), hero H1 wraps without overflow, nav collapses gracefully (center links hidden below `sm:` — the two right-side buttons remain), waitlist pill doesn't overflow, vignettes stack, pricing stacks. Then `resize_window` preset desktop.

- [ ] **Step 3: Reduced-motion + theme pinning checks**

Via `javascript_tool`/emulation where possible (or code-review-verify the guards if the pane can't emulate `prefers-reduced-motion`): `Reveal` renders visible, `CountUp` jumps to final values, `HeroPitch` stays on frame 0, marquee/glow effectively static. Set `localStorage['gaffer-theme']='light'`, reload `/` → still dark; sign in → app honours light; clear the key.

- [ ] **Step 4: Signed-in + share-page regression**

Signed in: `/`, `/roster`, `/design`, `/tactics`, `/calendar` all unchanged, no console errors. Any existing `/d/:token` share link still renders (grab a token via `execute_sql` `select share_token from drill where share_token is not null limit 1;` — if none exists, confirm the route still renders its empty state).

- [ ] **Step 5: Final build + lint, clean up test rows**

`npm run build && npm run lint` clean. Delete the waitlist test rows via `execute_sql` (`delete from early_access_signup where email like '%@example.com';`) — leave any real address the user added.

- [ ] **Step 6: Update HANDOFF.md**

New session-log entry at the top following the existing format: what shipped (public landing at `/`, login at `/login`, migration 023, the landing component inventory), what's placeholder (testimonials, club names, pricing numbers — marked in code), known limits (pane can't show rAF/CSS animation — user should eyeball the live motion), and that `_scratch`/test data conventions were respected.

- [ ] **Step 7: Commit**

```bash
git add -A src/pages/landing HANDOFF.md
git commit -m "feat: landing page polish pass + verification sweep + handoff notes"
```
