# design.md

The UI design system — read this before writing or changing any UI. It
covers app *chrome* (nav, cards, typography, buttons, status colors).
Canvas colors (players/cones/arrows on the pitch) are a separate, already-
tuned system — see [pitchTheme.ts](src/components/design/pitchTheme.ts)
and do not change canvas colors from here.

## The identity

Adapted from [newdesign.md](newdesign.md) (a Linear marketing-site design
analysis) onto Gaffer's actual app surfaces — this superseded an earlier
football-themed "touchline" system (amber accent, Oswald type, a chalk-line
motif). That system is gone; don't reintroduce amber, Oswald, or a
signature rule/motif as if it's still current.

The core move: a near-black canvas, a shallow surface ladder for hierarchy
instead of shadows, one restrained lavender-blue accent used sparingly
(brand mark, primary actions, focus, active nav — never as a section
background or card fill), hairline borders throughout, and a single type
family carried at different weights rather than switching fonts for
hierarchy. newsdesign.md's own components (pricing cards, testimonials,
CTA banners, top-nav with "Sign in") are marketing-site concepts with no
Gaffer equivalent — what's adapted here is the underlying discipline
(surface ladder, hairline precision, restrained accent, type scale), not
literal component copies.

## Color (`src/index.css` `@theme`)

The **one place** UI-chrome colors live. Always reach for the tokens below
— never a raw Tailwind slate/indigo class or an arbitrary hex value.

| Token | Value | Meaning |
|---|---|---|
| `--color-surface` | `#010102` | App shell / page background — near-pure black |
| `--color-panel` | `#0f1011` | Card/panel background — surface-1 |
| `--color-panel-raised` | `#141516` | Nested surface: pills, table headers, hover rows — surface-2 |
| `--color-line` / `--color-line-strong` | `#23252a` / `#34343a` | Default hairline border / stronger border, divider |
| `--color-ink` | `#f7f8f8` | Primary text |
| `--color-ink-muted` / `--color-ink-faint` | `#8a8f98` / `#62666d` | Secondary / placeholder text |
| `--color-accent` / `--color-accent-hover` | `#5e6ad2` / `#828fff` | Lavender-blue — primary actions, active nav, chips, focus. Used scarcely, never as a fill/background |
| `--color-ok` | `#27a644` | The one semantic color the reference documents — status/success |
| `--color-warn` | `#d08b3a` | Muted amber — unconfirmed / medium load. Not in the reference; extended with the same desaturated restraint to cover Gaffer's status states (availability tracking needs 3 distinct states, not 1) |
| `--color-bad` | `#e5484d` | Muted red — unavailable / heavy load / destructive |

Dark is the default (`color-scheme: dark` on `:root`, matching the values
above) and is what a fresh visitor sees with no script or stored
preference at all — but the coach can switch to light via the header
toggle (`ThemeToggleButton` in `AppShell.tsx`, backed by
[useTheme.ts](src/hooks/useTheme.ts)). Never assume dark is the only mode
when touching chrome; check both.

### Light theme

`:root[data-theme="light"]` in `index.css` re-maps every token above —
deepened accent/ok/warn/bad rather than reusing the dark-mode hex values,
since those read washed-out and fail contrast on white at UI-text sizes.

| Token | Value |
|---|---|
| `--color-surface` | `#fbfbfa` |
| `--color-panel` | `#ffffff` |
| `--color-panel-raised` | `#f4f4f5` |
| `--color-line` / `--color-line-strong` | `#e4e4e7` / `#d4d4d8` |
| `--color-ink` | `#18181b` |
| `--color-ink-muted` / `--color-ink-faint` | `#6b6b74` / `#a1a1aa` |
| `--color-accent` / `--color-accent-hover` | `#5e6ad2` / `#4750b3` (hover darkens, not lightens, on light) |
| `--color-ok` / `--color-warn` / `--color-bad` | `#15803d` / `#b45309` / `#dc2626` |

`Card`'s `panel-edge` highlight (below) also flips — see its own entry.

The toggle persists to `localStorage` (`gaffer-theme`) and is applied
before first paint by an inline script in `index.html`, so light-mode
coaches never see a flash of the dark default on load. If you add a new
color anywhere in chrome, add its light-mode value in the same place —
there's no automatic light/dark derivation.

## Typography

One family, two roles — `--font-sans` (Inter) and `--font-mono`
(JetBrains Mono), both loaded via Google Fonts `<link>` tags in
`index.html`:

- **Inter** carries everything — page titles, section headings, body copy,
  labels, buttons. Hierarchy comes from weight and size (`font-semibold
  text-2xl tracking-tight` for a page title, `font-medium text-sm` for a
  label, etc.), never from switching to a separate display face. There is
  no `--font-display` token — don't add one back.
- **JetBrains Mono** is reserved for genuinely code-like contexts. Gaffer
  doesn't currently have any (no code snippets, no IDs shown to the
  coach) — don't reach for it on stat figures, durations, or counts; those
  are plain Inter with `font-semibold`/`tracking-tight` for emphasis, same
  as everything else. An earlier pass used mono+tabular-nums on attendance
  ratios and the drill phase filmstrip to read as a "scoreboard" — that
  was specific to the football theme and has been reverted.
- Prefer `tracking-tight` on headings (Tailwind's `-0.025em`) — an
  approximation of the reference's more aggressive per-size negative
  tracking, close enough without hand-tuning `tracking-[value]` per size.

## Components (`src/components/ui/`)

- **`Card`** — `rounded-xl border border-line bg-panel p-6`, plus the
  `panel-edge` class (a 1px inset top highlight — see index.css). No
  shadow, ever — the reference explicitly resists drop shadows on dark
  surfaces; depth comes from the surface ladder + hairline border + that
  subtle top highlight instead. `panel-edge` itself is theme-aware: a
  white highlight in dark mode, a faint dark hairline in light mode (a
  white highlight has nothing to read against on a white surface) — both
  defined in index.css, nothing to do in the component.
- **`PageHeader`** — every routed page's title: `text-2xl font-semibold
  tracking-tight`, sentence case (not uppercase). No rule/motif underneath
  — separation comes from an `mb-8` gap, not a drawn line. Don't build a
  page-level `<h1>` outside this component.
- **`NumberBadge`** — a large `text-3xl font-semibold tracking-tight
  text-accent` value over a small `text-xs text-ink-muted` label. Plain
  Inter, no mono. Use for standalone counts (roster size, sessions,
  drills) — not a generic icon+number card.
- **`Badge`** (`ok`/`warn`/`bad`/`neutral` tone pills) — unchanged shape,
  colors inherit from the tokens above automatically.

## Navigation shell (`AppShell.tsx`)

- **Primary nav on `lg:`+ is an icon rail that expands in place on
  hover** — a fixed `<aside>` below the sticky top bar, resting at `w-16`
  (icon only) and growing to `w-56` (icon + label) on `:hover` or
  `:focus-within`, via a plain `transition-[width]` — no React state, no
  off-canvas transform. `<main>` carries a permanent `lg:pl-16` matching
  the *resting* width; the expanded width overlays on top of content
  rather than pushing it further, so nothing reflows when it grows.
  `NavList` is shared with the mobile drawer and always renders icon +
  label together; a `fadeLabel` prop (used only by the rail) wraps the
  label in a span that's `opacity-0` until an ancestor `.group` — the
  `<aside>` itself — is hovered/focus-within. This is necessary, not
  decorative: at the resting 64px the label text still overflows past
  the link's own box regardless of opacity (`overflow-hidden` on the
  rail clips it either way), and without also fading it, the sliver that
  falls *inside* the visible 64px shows as a stray fragment of the first
  letter instead of a clean icon-only rail.
  Below `lg` none of it renders; the hamburger drawer is the only nav.
  **On the earlier "there is no permanent sidebar" decision**: this
  version genuinely does reserve a permanent 64px of screen width, which
  the immediately-prior auto-hiding version deliberately avoided doing.
  That's a real, explicit step further than before, taken at direct
  instruction with the exact reference (a Vercel-style expand-on-hover
  rail) supplied to build from — recorded as what changed and why, same
  as every other reversal in this section, not smoothed over. The rail
  started (2026-08-22) as a persistent icon+label sidebar adapted from a
  Supabase Studio design brief, became fully auto-hiding the next day,
  then briefly gained a click-to-close handle (added and then rolled
  back the same day, before ever being pushed), before landing on this
  expand-on-hover shape. Targets stay comfortable rather than copying a
  denser reference verbatim: Gaffer is used pitch-side on a touch screen.
- **"Gaffer" is always top-left**, unchanged by route — it's the
  consistent brand anchor and doubles as the way back to the coach-level
  Dashboard from any team-scoped page (it links to `/`). Don't swap it
  for anything else on team-scoped routes; that was tried (a team-name +
  back-chevron swap) and reversed.
- **Team selector is top-left, as a breadcrumb off "Gaffer"** (desktop
  only, team-scoped routes) — `Gaffer / <team>`, `TeamSwitcher compact`
  after a plain `/` separator glyph. This is the one place a team name
  appears in the header. `compact` is a real trigger+popover (a bordered
  pill with the current team name and a `ChevronsUpDown` icon, opening a
  listbox with a checkmark on the active team and a "+ New team" link to
  `/teams`) rather than a native `<select>`, and — unlike the drawer's
  own non-compact block, which still branches on team count since a bare
  `<select>` has nothing useful to show for 0 or 1 option — it renders
  the same popover at every team count, 0 and 1 included, so a coach
  without a second team yet still gets a real, discoverable "+ New team"
  affordance instead of unclickable text or nothing at all. **This is the second reversal of the same
  decision, not the first**: it started top-left, moved to top-right (a
  `TeamSwitcher compact` next to the theme toggle) specifically because
  top-left was competing with "Gaffer" for the same "where am I" role,
  then moved back to top-left on 2026-08-23 at explicit instruction, with
  a concrete visual reference (a Vercel-style org-switcher breadcrumb) to
  build from. The competing-anchors concern that motivated the first
  move is resolved here by the `/` separator itself — visually it reads
  as *brand, then current scope*, the same breadcrumb grammar the
  reference uses, rather than two anchors both claiming the same spot.
  If this starts feeling cramped or ambiguous again, that original
  concern is why, and top-right is the fallback that's already proven
  to work.
- **Theme toggle** is always visible (mobile and desktop), sitting
  leftmost in the top-right cluster. **Sign-out** is desktop-only in that
  same cluster — mobile gets it in the drawer footer instead, since the
  collapsed bar doesn't have room for it next to the hamburger.

## Conventions

- Corner radius: `rounded-xl` (12px) for panels/cards, `rounded-md`/`rounded-lg`
  for buttons/inputs/small controls, `rounded-full` for pills/chips/avatars.
- No `shadow-sm`/drop shadows anywhere on chrome **as a surface
  treatment**. Depth comes from `border-line` against
  `bg-panel`/`bg-surface`, plus `panel-edge` on `Card` — never a shadow.
  The one carve-out is the focus ring below, which is a deliberate,
  instructed exception (2026-08-22) and doesn't license shadows on
  panels, cards or any other resting surface.
- Focus states: plain buttons/links get the lavender ring for free from
  the global `:focus-visible` rule in `index.css` — don't add per-element
  focus styling to them. That rule is a **`box-shadow` glow**
  (`0 0 0 3px` of the accent at 30%, via `color-mix`, so it tracks
  whichever theme is active) rather than the `outline` it used to be —
  changed 2026-08-22 alongside the icon rail, adapted from a Supabase
  Studio design brief at explicit instruction. Two consequences worth
  knowing: a painted ring disappears under forced-colors/High Contrast,
  so `index.css` hands an `outline` back in that mode — keep that block
  if you touch the rule; and a `box-shadow` ring can be clipped by an
  ancestor's `overflow: hidden`/`overflow-x-auto` in a way an `outline`
  never was, so check focus visibility inside scroll containers (the
  attendance table, the drill grid) when adding new focusable content
  there. Text inputs/selects/textareas use their own
  `outline-none transition-colors focus:border-accent focus:ring-2
  focus:ring-accent/30` (a border-color change plus a soft ring reads
  better on a filled field than an outset ring alone) — copy that exact
  class string on any new form field rather than inventing a new focus
  treatment.
- For header + repeated-data-row UI (tables, grids), use a shared
  `grid-template-columns` constant applied to both the header and every
  row (see `ROW_GRID` in `PlayerRoster.tsx`) rather than `flex`/`flex-1`,
  which breaks alignment silently if a row and its header don't have the
  same number of flex children.
- Accent is scarce by design — reach for it on primary actions, active
  nav/tab state, focus rings, and stat/link emphasis. Don't use it as a
  card background, section fill, or decoratively.

## Out of scope here

`pitchTheme.ts` (canvas colors: players, cones/poles, mannequins, arrows,
turf) is a separate system, tuned independently through direct visual
iteration against reference photos. Don't change it as a side effect of
chrome work, and don't pull chrome tokens onto the canvas or vice versa.
