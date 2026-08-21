# design.md

The UI design system — read this before writing or changing any UI. It
covers app *chrome* (nav, cards, typography, buttons, status colors).
Canvas colors (players/cones/arrows on the pitch) are a separate, already-
tuned system — see [pitchTheme.ts](src/components/design/pitchTheme.ts)
and do not change canvas colors from here.

## The identity: "touchline"

Gaffer is a solo grassroots coach's pitch-side tool, checked one-handed
outdoors — not a SaaS product with an audience to win over. The chrome had
drifted into a generic dark-dashboard default (near-black + one blue
accent, default system sans, `rounded-xl` + soft shadow) with no
relationship to football, while the canvas already had a real identity
(turf green, hi-vis amber equipment, kit navy/red). This system pulls that
identity into the chrome instead of leaving it stranded on the canvas.

Vocabulary: touchline chalk markings, scoreboards/substitution boards,
matchday teamsheets. Not generic "sports" clichés — every choice below
should trace back to one of these three things.

## Color (`src/index.css` `@theme`)

The **one place** UI-chrome colors live. Always reach for the tokens below
— never a raw Tailwind slate/indigo class or an arbitrary hex value.

| Token | Value | Meaning |
|---|---|---|
| `--color-surface` | `#0a0d0a` | App shell / page background — near-black, faint turf-night undertone |
| `--color-panel` | `#12160f` | Card/panel background |
| `--color-panel-raised` | `#1a1f18` | Nested surface: pills, table headers, hover rows |
| `--color-line` / `--color-line-strong` | `#262b23` / `#383f34` | Default border / stronger border, divider |
| `--color-ink` | `#f3f4ef` | Primary text — warm chalk-white, not cool gray |
| `--color-ink-muted` / `--color-ink-faint` | `#979c8f` / `#5c6058` | Secondary / placeholder text |
| `--color-accent` / `--color-accent-hover` | `#f0a30a` / `#ffb52e` | Hi-vis training amber — floodlight/bib. Primary actions, active nav, chips |
| `--color-ok` | `#5fbf6b` | Grass green — available / light load |
| `--color-warn` | `#fb923c` | Referee-caution orange — unconfirmed / medium load |
| `--color-bad` | `#e5484d` | Red-card red — unavailable / heavy load / destructive |

Dark-mode-only (`color-scheme: dark` on `:root`) — this is functional (pitch-
side glare/battery), not aesthetic, and isn't up for revisiting casually.

## Typography

Three faces, each with one job — declared as `--font-sans` / `--font-display`
/ `--font-mono` in `@theme`, loaded via Google Fonts `<link>` tags in
`index.html`:

- **`font-display` (Oswald)** — condensed, stadium-signage feel. Page
  titles (`PageHeader`) and the nav wordmark only. Not for section
  subheadings inside a page — those stay plain `font-sans font-semibold`
  (see `<h2>`s in `DashboardPage.tsx`, `SessionPlanner.tsx`, etc.). Display
  face marks "you're on a new page," not every heading level.
- **`font-sans` (Inter)** — body copy, labels, buttons, everything else.
  The default; most UI text needs no explicit class.
- **`font-mono` (JetBrains Mono)**, paired with `tabular-nums` — reserved
  for figures that read like a scoreboard: `NumberBadge`'s stat values, the
  drill phase filmstrip's numbered tabs, attendance ratios (`3/5 (60%)`).
  Not for every number in the UI — a session's "60 min" or a squad number
  inline in a sentence stays plain text. Apply it where a number is *the*
  point of what's being displayed, not incidental to a sentence.

## The touchline motif

`.touchline` (`src/index.css`) is a solid double rule — a bold accent line
over a thin secondary line, evoking a pitch boundary + margin stripe. It is
the **one** recurring signature device. Two things about it are load-bearing:

1. **Where it lives**: the shell header's bottom edge (`AppShell.tsx`) and
   directly under every page title (`PageHeader.tsx`). Nowhere else.
2. **Where it deliberately does not**: `Card` does not carry it. An earlier
   pass put it on every card too and it read as wallpaper, not a signature
   — restraint is the point. Don't add `.touchline` to a new component
   without a real reason it deserves the same weight as a page title.

We also tried a dashed version of this rule first — it read as a repeating
CSS pattern rather than an intentional line. Solid reads as deliberate;
keep it solid.

## Components (`src/components/ui/`)

- **`Card`** — `rounded-lg border border-line bg-panel p-6`, no shadow,
  no touchline. The one wrapper every content block uses. If you're
  writing a new bordered panel, use `Card` — don't hand-roll
  `rounded-xl ... shadow-sm` (that was the pre-redesign default and is
  gone everywhere in the app now; don't reintroduce it).
- **`PageHeader`** — every routed page's title, always `font-display`,
  uppercase, with the touchline rule beneath. Don't build a page-level
  `<h1>` outside this component.
- **`NumberBadge`** — the scoreboard-chip stat treatment: `font-mono`
  tabular value over an uppercase `font-display` label. Use for standalone
  counts (roster size, sessions, drills) — not a generic icon+number card.
- **`Badge`** (`ok`/`warn`/`bad`/`neutral` tone pills) — unchanged shape,
  colors inherit from the tokens above automatically.

## Conventions

- Corner radius: `rounded-lg` for panels/cards, `rounded-md` for
  buttons/inputs/small controls, `rounded-full` for pills/chips. Not
  `rounded-xl` — that was the old default.
- No `shadow-sm`/drop shadows on panels. Depth comes from `border-line`
  against `bg-panel`/`bg-surface`, not shadows.
- For header + repeated-data-row UI (tables, grids), use a shared
  `grid-template-columns` constant applied to both the header and every
  row (see `ROW_GRID` in `PlayerRoster.tsx`) rather than `flex`/`flex-1`,
  which breaks alignment silently if a row and its header don't have the
  same number of flex children.

## Out of scope here

`pitchTheme.ts` (canvas colors: players, cones/poles, mannequins, arrows,
turf) is a separate system, tuned independently through direct visual
iteration against reference photos. Don't change it as a side effect of
chrome work, and don't pull chrome tokens onto the canvas or vice versa.
