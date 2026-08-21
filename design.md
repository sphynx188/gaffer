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

Dark-mode-only (`color-scheme: dark` on `:root`) — functional (pitch-side
glare/battery), not aesthetic, and isn't up for revisiting casually. This
call is independent of the palette above and survived the swap from the
touchline system unchanged.

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
  `panel-edge` class (a 1px inset white highlight on the top edge — see
  index.css). No shadow, ever — the reference explicitly resists drop
  shadows on dark surfaces; depth comes from the surface ladder + hairline
  border + that subtle top highlight instead.
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

## Conventions

- Corner radius: `rounded-xl` (12px) for panels/cards, `rounded-md`/`rounded-lg`
  for buttons/inputs/small controls, `rounded-full` for pills/chips/avatars.
- No `shadow-sm`/drop shadows anywhere on chrome. Depth comes from
  `border-line` against `bg-panel`/`bg-surface`, plus `panel-edge` on
  `Card` — never a shadow.
- Focus states: plain buttons/links get the lavender ring for free from
  the global `:focus-visible` rule in `index.css` — don't add per-element
  focus styling to them. Text inputs/selects/textareas use their own
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
