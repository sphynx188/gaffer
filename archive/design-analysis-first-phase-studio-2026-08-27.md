# Design Analysis: First Phase Studio (https://app.firstphasestudio.com/)

Analyzed 2026-08-27. Viewport(s) checked: 375px (mobile), 768px (tablet), 1200/1280/1488/1568/1800/1920px (desktop, several window widths while exploring the editor). Signed in as a real coach account ("Jordan Taylor / Personal Studio") to reach the actual product — the marketing/login shell (`auth.css`) is a separate, much smaller stylesheet from the app itself.

Overall character: a **dark, dense, heavy-weight "pro tool" aesthetic** — near-black backgrounds, one strong blue brand color, very bold uppercase type (font-weight 800–950 throughout, even on section labels), and a genuinely deep 3-pane workspace (page list / canvas / inspector) built on Konva, the same canvas library Gaffer uses. It reads as assertive and dense rather than restrained — closer to a broadcast-graphics tool than an editorial/SaaS-minimal product. This is a **vanilla JS, no-framework, multi-file app** (not React/Vue), talking to Supabase directly from the browser — the same backend Gaffer uses, which makes several of its patterns unusually easy to compare apples-to-apples.

## 1. Color System

Colors are defined as CSS custom properties on `:root`/`body`, but the codebase does **not** consistently reach for them — the token extraction found 480+ distinct raw `rgb()`/`rgba()` values hardcoded directly in rules alongside the ~30 real tokens, meaning large parts of the UI were styled by picking a new close-enough gray rather than reusing an existing one. This is the single biggest structural difference from Gaffer's `index.css`, which deliberately keeps *one* place for every UI color.

The real token set (from `getComputedStyle` on `:root`):

| Value | Role (inferred) | CSS custom property |
|---|---|---|
| `#0B0D10` | App background | `--bg` |
| `#15181D` | Card/panel surface | `--panel` |
| `#20252B` | Raised/nested surface | `--panel2` |
| `#30363D` | Hairline border | `--line` |
| `#F2F2F2` | Primary text | `--text` |
| `#A7AFB8` | Secondary/muted text | `--muted` |
| `#F5F7FA` | "Active"/selected-state color (near-white, NOT the brand blue) | `--accent`, `--uiAccent`, `--ui-active` |
| `#0060A8` | **Brand blue** — primary actions, focus, glows | `--blue`, `--brand-blue`, `--geoColor`, `--home-hover-accent` |
| `#0A6FB8` | A second, slightly lighter blue used for some borders/CTAs | `--brandBlue` |
| `#ef4444` | Destructive/error | `--red` |
| `#22c55e` | Success/status | `--status-colour` |
| `rgba(245,247,250,.13)` | Soft accent fill (rings, subtle highlight bg) | `--accentSoft` |
| `rgba(0,96,168,.12–.62)` | Blue at various alphas — glows, borders, hover rings | `--home-hover-ring`, `--home-hover-soft`, `--controlBorder` |

Worth calling out explicitly: **`--accent` is off-white (#F5F7FA), not the brand blue.** The actual blue brand color lives in a *different* set of variables (`--blue`/`--brand-blue`/`--geoColor`). This is a naming trap the codebase clearly fell into (two "accent" concepts, inconsistently named) — a real thing to avoid copying if porting the *token naming*, even though the two-color system itself (a neutral "this is selected" white plus a distinct brand-blue "this is the primary action / this is your club's color") is a legitimate and useful idea (see below).

**Per-organisation dynamic theming** is the most interesting color-system finding. `--organisation-accent`, `--organisation-accent-glow`, `--organisation-accent-soft`, and `--geoColor` are all runtime-set custom properties (confirmed via the `personal_branding` Supabase table fetched on load), and most of the box-shadow/border rules reference them through `color-mix()`, e.g.:
```css
box-shadow: 0 0 0 2px var(--accent), 0 18px 52px rgba(0,0,0,.36);
box-shadow: 0 0 24px color-mix(in srgb, var(--geoColor) 55%, transparent);
border-color: color-mix(in srgb, var(--organisation-accent) 55%, var(--line));
```
That means a club/organisation can set **one brand color** and the whole app's glows, borders and hover rings recolor themselves through that single CSS variable — no per-component color logic. Gaffer currently has one fixed lavender accent for every coach; this pattern is directly and cheaply portable if Gaffer ever wants "make it feel like *your* club's colors" as a feature.

No light/dark mode toggle exists — the app is dark-only, same as Gaffer's own stance (though Gaffer additionally ships a full light theme, which this app does not attempt).

Contrast: body text `#F2F2F2` on `#0B0D10`/`#15181D` computes to roughly 17:1 and 15:1 — comfortably AA/AAA. Muted text `#A7AFB8` on `#15181D` is ~7.8:1, also fine. No contrast problems found in the sampled pairs.

Gradients: the dashboard hero (`.homeHeader`) sits on a radial/conic-looking dark blue glow rather than a flat panel — this is actually a `background-image` gradient using the brand blue at low opacity fading to the panel color, not a solid fill; it's what gives the landing dashboard its "glowing command-center" feel rather than being a plain card.

## 2. Typography

One family for everything, same as Gaffer: **`Inter, Arial, sans-serif`** (no other family found anywhere in the sampled elements or stylesheet). Crucially, **there is no `@font-face` rule at all** (`fontFaces: []` in the extraction) and no font-service request in the network log (no Google Fonts, no `fonts.gstatic.com`). Inter is referenced by name only, with `Arial, sans-serif` as the fallback — meaning on a machine without Inter actually installed as a system font, this app silently renders in Arial. Gaffer, by contrast, explicitly self-serves/links Inter via a Google Fonts `<link>` in `index.html`, so it always renders in the intended face. This is a real, verifiable gap in First Phase Studio's asset pipeline, not a stylistic choice — worth noting as a "don't copy this part" rather than a technique.

No modular type scale — font-sizes are mostly **fluid/`clamp()`-based** rather than a fixed step scale:
```css
font-size: clamp(14px, 1.35vw, 20px);
font-size: clamp(18px, 2.1vw, 28px);
font-size: clamp(32px, 4vw, 58px);
font-size: clamp(48px, 7vw, 86px);
```
This is a genuinely different and portable technique from Gaffer's fixed Tailwind `text-*` classes: instead of swapping sizes at breakpoints, the type itself scales continuously with viewport width between a floor and a ceiling. It's most visible on the hero wordmark and page/section titles; body copy and small UI chrome use fixed px sizes (10–16px) rather than `clamp()`.

Font-weight is used unusually heavily as the primary hierarchy signal — sampled weights in real use were **600, 650, 700, 750, 800, 850, 900, 950**, essentially never anything below 600. Concretely:

| Size | Weight | Line-height | Letter-spacing | Used for |
|---|---|---|---|---|
| 68px | 950 | 61.2px (0.9 ratio, tighter than the box) | `-2.72px` (~‑4%) | Hero wordmark "FIRST PHASE STUDIO", uppercase |
| 16px | 800 | normal | normal | Workflow card titles ("SESSION", "TACTICAL"...) |
| 12–13px | 700 | 12–13px (1:1, unitless-equivalent) | `1.8–1.92px` (~15–16% of font size) | Section eyebrow labels ("MY PROJECTS", "PAGES"), all uppercase |
| 14px | 900 | 15.4px | 0–0.49px | Primary/secondary editor top-bar buttons ("Present", "Panel") |
| 11px | 800 | normal | normal | Small chip buttons ("View All", "Undo") |
| 10px | 850 | 11px | normal | Account-menu trigger text |
| 11px | 400 | normal | normal | Text input contents (the one place weight drops to normal) |

The combination of **very bold weight + very tight letter-spacing on large uppercase display type**, and **very bold weight + very open letter-spacing on small uppercase labels**, is the clearest, most distinctive and most portable typographic technique here — it reads as confident/assertive in a way that's arguably a better fit for a sports-coaching tool's brand voice than Gaffer's current deliberately restrained Inter-at-normal-weights system. This is the single strongest "worth stealing" typography finding.

Line-heights elsewhere are a mix of unitless ratios (`1`, `1.2`, `1.5`) and fixed px, with no obvious single convention — less disciplined than it looks at first glance.

## 3. Spacing & Layout System

No visible base unit — the spacing values collected (137+ distinct padding/gap strings) are heavily bespoke per component (`13px 14px`, `18px 22px 14px`, `24px 42px minmax(96px, 1fr) 66px auto auto`, etc.) rather than drawn from a 4px/8px scale. This is a real contrast with Gaffer, whose Tailwind-driven spacing is disciplined by construction. Not something to copy — flag it as evidence the codebase grew organically rather than off a spacing token system.

Breakpoints are **exclusively desktop-first (`max-width`)**, ranging from 560px up to 1380px, plus two `max-height` queries (760px/820px, for short laptop screens — a nice, easy-to-forget detail: constraining vertical space, not just horizontal) and a `print` stylesheet. There is no `min-width` query anywhere, confirming the whole app is authored desktop-down rather than mobile-up (Tailwind, which Gaffer uses, defaults to mobile-first `min-width`).

Grid patterns are dominated by **fixed-sidebar-plus-fluid-content** shapes, consistent with a 3-pane editor:
- `220px minmax(680px, 1fr) 360px` — left page rail + canvas + right inspector, all three panes at once
- `64px repeat(7, minmax(145px, 1fr))` / `72px repeat(7, minmax(0px, 1fr))` — a 7-column weekly/timeline grid (a session-planning or calendar view)
- `1.4fr 1fr repeat(8, minmax(54px, 0.75fr))` — a wide data table with many narrow trailing columns

z-index usage is sprawling: 60+ distinct values in active use, up to `2147483647` (the max 32-bit int, used at least once as a "always on top no matter what" escape hatch) and several suspiciously specific values (`16000`, `16001`, `16002` — almost certainly three stacked dialogs/toasts numbered by hand rather than drawn from a scale). This is the opposite of Gaffer's presumably small, deliberate z-index set — worth flagging as an anti-pattern, not a technique.

## 4. Component Inventory

### Buttons

Multiple visually distinct button "families" coexist without a single shared base class — this is a workflow-card button, a top-bar action, a small utility chip, and a form-panel primary action, and each has its own bespoke recipe:

- **Workflow card** (`.workflowCard`) — the dashboard's 4 big entry-point tiles. `background: rgb(23,27,33)`, `border: 1px solid rgb(48,54,61)`, `border-radius: 24px`, `padding: 22px`, text `font-weight: 800`. See Motion section for the real hover diff.
- **Pill nav button** (`.homeAction`, e.g. "Home") — fully rounded (`border-radius: 999px`), transparent background, `border: 1px solid rgba(255,255,255,.09)`, layered `box-shadow` (`inset 0 1px 0 rgba(255,255,255,.05), 0 8px 18px rgba(0,0,0,.2)`) giving a subtle glassy top-highlight-plus-drop-shadow look, `color: rgb(170,179,192)`.
- **Secondary editor action** (`.workspaceAction.panelAction`, e.g. "Panel") — `background: rgb(21,26,32)`, `border-radius: 14px`, no border, `font-weight: 900`.
- **Primary CTA** (`.primary.presentAction`, "Present") — this is the interesting one: it is **not a filled/solid button**. `background: transparent`, `border: 1px solid rgba(10,111,184,.82)` (brand blue as a semi-transparent OUTLINE, not a fill), plus `box-shadow: 0 12px 28px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.07)` for lift + top-highlight, `border-radius: 18px`, `font-weight: 900`, `letter-spacing: 0.49px`. Gaffer's primary buttons are solid `bg-accent` fills; this "glowing outline, not a fill" primary-button style is a genuinely different visual language worth considering as an alternative primary-action treatment, especially for a dark UI where a solid saturated fill can feel heavy.
- **Small utility chip** (`.addPageBtn`, `.canvasUndoAction`, "View All"/"Clear"/"Undo") — compact, `border-radius: 8–10px`, `padding: 6–9px`, `font-size: 11px`, `font-weight: 800`. These lean on the SAME brand-blue-tinted border (`border: 1px solid rgba(0,96,168,.55)`) even for a plain utility action like "Undo" — a small consistency device that ties every actionable control back to the one brand color even when it isn't the primary action.
- **Delete/destructive** (inspector panel "Delete") — solid dark-red fill, white text, otherwise same radius/padding family as its siblings.

No disabled-state styling was observed in this pass (nothing disabled was on screen to sample).

### Cards

- **Hero header card** (`.homeHeader`) — `border-radius: 28px`, `border: 1px solid rgb(48,54,61)`, `padding: 38px`, heavy ambient shadow `0 30px 100px rgba(0,0,0,.42)`, sits over a radial blue glow background-image. This is the single largest-radius, heaviest-shadow surface in the app — reserved for exactly one "hero" moment.
- **Workflow card** — see Buttons above (it's a `<button>`, not a div — semantically a button styled as a card).
- **Page-list item** (left rail, once a page exists) — a thumbnail swatch (a literal small color/rendered preview of the page) + title + type + object count, with inline reorder (↑/↓)/Copy/Delete controls always visible underneath rather than behind a hover-reveal or a separate menu. This thumbnail-plus-metadata-plus-inline-actions pattern is denser and more immediately useful than Gaffer's current `/design` picker list (plain text name + pitch label + keyframe count, no thumbnail, no inline actions) — a concrete, low-risk UI upgrade Gaffer's drill/tactic pickers could borrow.

### Navigation

Top bar: logo mark (a JPEG, see Asset Pipeline) + wordmark + tagline on the left, a context-sensitive segmented control in the center (`Home` on the dashboard; `Tools`/`Timeline` once inside a page's editor), and a cluster of actions on the right (`Panel`, `Present`, `Project ▾`, a `Saved`/autosave-status pill). The center segmented control literally swaps its own contents based on what you're doing — it's the SAME visual slot doing "top-level navigation" on the dashboard and "mode switch" inside the editor, which keeps total chrome height constant across very different screens. Gaffer's own top bar is per-editor-specific by design (documented as a deliberate choice in Gaffer's CLAUDE.md — "a shell forced over two different toolbars is worse than two toolbars"); First Phase Studio takes the opposite bet and it also works, at the cost of a slightly harder-to-explain control (the same button says different things depending on where you are).

Left rail: "Pages" list — always visible once you're in the editor, persistent width, not collapsible (no icon-only mode, no hover-expand).

Inside the "Tools" mode, a second-level horizontal tab bar (`Players / Formation / Field / Equipment / Drawing`) opens a dropdown-style panel below itself when a tab is active, rather than a persistent side panel. This is text-label-based (no icons) — more self-explanatory at first glance than an icon rail, less compact, no visible keyboard shortcuts.

### Forms

Text inputs: `background: rgb(9,12,16)` (darker than the surrounding panel — inputs recede rather than pop), `border: 1px solid rgb(48,54,61)`, `border-radius: 11px`, `padding: 13px 14px`, `font-size: 11px` (small relative to its own padding — the input "box" reads larger than the text inside it). No visible custom focus-ring style was found on inputs specifically (not tested inside this pass beyond the button/card focus check below).

Dropdowns/selects (`Labels: None ▾`, `Size: Medium ▾`) are custom-styled with a chevron icon, dark fill matching the panel, and rounded corners matching the input radius — consistent with the rest of the form chrome, similar in spirit to Gaffer's own custom `Dropdown` component replacing native `<select>`.

The "insert N players" flow (Colour swatch → Quantity number field → Labels dropdown → Size dropdown → one full-width "Insert Players" primary button) is a **batch-configure-then-insert** pattern: you set up the parameters once, then N players appear on the pitch in a small stack, which you then drag into position by hand. This is meaningfully different from Gaffer's one-at-a-time "arm a tool, tap the pitch to place" flow, and does not auto-arrange (in this test, 5 inserted players clustered in one corner rather than spreading out) — Gaffer's own click-to-place is more precise and immediate; this app's bulk-insert is faster when you want a full XI on the pitch (the Formation tool actually does the equivalent job better — see below).

### Formation Picker

Selecting `Team colour` → `Labels: Positions` → `Direction: Attack right` → one of five formation buttons (`4-3-3`, `4-2-3-1`, `4-4-2`, `3-4-3`, `3-5-2`) instantly places a full labelled XI (including a visually distinct **yellow-filled goalkeeper**, every outfielder red) at sensible starting positions. Only 5 built-in formations — Gaffer's own `formations.ts` already documents 29 built-in formations plus a scoring/slot-assignment algorithm that specifically guards the goalkeeper slot from being stolen by an unroled outfielder. **Gaffer's formation system is already more capable than this app's** in every dimension except one: the distinct goalkeeper fill color at a glance is a nice, cheap, purely-visual affordance worth checking whether Gaffer's own tactics canvas already does (a colored ring/fill specifically for the keeper role, independent of team-A/team-B color, so the keeper is identifiable even in a single-color kit).

### Timeline / "Frames"

This is the most structurally significant comparison to Gaffer's own architecture. Before you can animate anything, the app makes you explicitly choose between two named modes on a splash screen:
- **"Progressions — Static practice stages and variations"**
- **"Animation — Movement and timed sequences"**

Choosing "Animation" replaces the whole Tools/category toolbar with a compact playback bar (`‹ Timeline`, `Delete` (frame), `Speed: 1× ▾`, `Stop`, `Play`, `Update Frame`) and a horizontal **filmstrip of frame cards** (`Frame 1`, `+` to add another), each frame apparently a full snapshot rather than a point on a continuous time axis — there is no visible seconds-based ruler, no draggable-to-retime marker, just an ordered sequence of discrete frames you flip between and an "Update Frame" button to re-capture the current board state into whichever frame is selected.

This is functionally the **exact model Gaffer's own `DRILL_CREATOR_REWORK_PLAN.md` §0 documents deliberately abandoning**: "a player in phase 1 and the same player in phase 2 were unrelated objects, so nothing could ever interpolate between two phases." First Phase Studio still ships that discrete-stages model (its "Progressions" mode is even more explicitly the old phase model by name), with "Animation" as a second, separate mode layered on top rather than the same underlying document. **This is not a pattern to adopt** — it's worth documenting precisely because it validates, by direct comparison, that Gaffer's unification of phases into one continuous seconds-based `Keyframe.t` timeline was the right call and is a genuine capability advantage: Gaffer can smoothly interpolate any two positions on one timeline; this app cannot interpolate between "progression" stages at all, and its "Animation" frames appear to be a second, parallel, more limited system rather than the same document doing double duty.

### Presentation Mode

Clicking "Present" swaps to a **stripped, full-bleed view** of the current page: no top bar, no side rail, just the page title and the board, with a **floating bottom toolbar** (`Pointer / Draw / Line / Highlight / Notes / Clear`) that fades in on hover. This is a distinct, dedicated "show this to the room" mode, separate from both editing and static export — closer to a whiteboard/presenter mode than to a PNG/PDF export. **Gaffer has no equivalent** (its own "print card" route is explicitly a static, print-styled page with no interactivity, and PNG/GIF export is a file you download, not a live surface). A lightweight live-annotate-while-presenting mode (even just Pointer + Draw + Clear) is a genuinely new capability worth considering for Gaffer's tactics board specifically, given coaches already use it pitch-side on a shared screen.

## 5. Motion & Animation

Real, verified interaction diff (SNAPSHOT → hover → DIFF) on `.workflowCard`:
```
transition: 0.18s (shorthand — applies to all animatable properties, timing-function: ease)
border-color:  #30363D → #0060A8
box-shadow:    none    → 0 20px 55px rgba(0,0,0,.34), 0 0 0 1px rgba(0,96,168,.22)
transform:     none    → translateY(-4px)   (matrix(1,0,0,1,0,-4))
```
That's a complete, portable "hover-lift" card recipe: a 4px upward translate, a blue-tinted border-color swap, and a soft ambient shadow plus a 1px colored ring, all in 180ms with a plain `ease` curve (not a custom cubic-bezier — no evidence of a deliberately hand-tuned easing curve anywhere in the sampled transitions; every one found uses plain `ease` at 0.12–0.25s).

Other transition combinations found in the stylesheet (none individually spectacular, but useful as a reference set):
```css
border-color 0.12s, box-shadow 0.12s, background 0.12s
border-color 0.14s, box-shadow 0.14s, transform 0.14s
border-color 0.16s, background 0.16s, color 0.16s, box-shadow 0.16s, transform 0.16s   /* the top-bar buttons */
outline-color 0.14s, box-shadow 0.14s, background-color 0.14s
opacity 0.25s, transform 0.25s
transform 0.22s, opacity 0.18s, visibility linear   /* a fade+scale dialog enter, guessed from the shape */
```

Only one `@keyframes` block exists in the whole stylesheet:
```css
@keyframes claude-pulse {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
```
(applied to what is almost certainly a "saving…"/status indicator dot — the name is a strong signal this specific rule was authored by an AI coding assistant rather than hand-written, which is a small but real data point about how this codebase was built, not a design technique to reuse.)

**`prefers-reduced-motion` is not handled anywhere** — confirmed by re-querying the live stylesheet for the media condition after the initial (likely stray) detection; no such rule exists in `styles.css` or `auth.css`. Every transition/animation in the app will play at full strength regardless of the visitor's OS-level motion-reduction setting. This is a real, plainly-statable accessibility gap, not a stylistic choice.

No scroll-driven effects were found — the dashboard is short enough not to need any, and the editor doesn't scroll the page (it scrolls internal panels). No detected animation library (no GSAP/Framer/AOS/Lottie globals or `data-*` fingerprints) — all motion is plain CSS transitions plus one keyframe animation, hand-rolled.

## 6. Interaction Patterns (UX)

- **Navigation**: no sticky/hide-on-scroll behavior needed (dashboard is short); the editor's top bar is fixed for the whole session.
- **Loading/feedback**: an inline `Saved` text pill in the top-right of the editor bar, colored green, present at all times — a persistent, always-visible autosave-status indicator rather than a toast that appears and disappears. Gaffer's own drill/tactic editors do something similar (a save-state indicator in the top bar per `saveState` in `drillSlice`) — this confirms that pattern is a sound, comparable choice, not something to change.
- **Empty states**: "No recent projects yet. Choose a workflow above to start." — a friendly, instructional dashed-border empty-state box, sentence case, present under both "My Projects" and "My Templates". Tone is plain and direct rather than cutesy.
- **Confirmation/destructive actions**: the inspector panel's "Delete" button for a placed player is a single click with no confirmation step observed in this pass — worth being cautious porting that specific pattern, since Gaffer's own conventions (see the recent roster/drill/tactic delete work) deliberately require a confirm step for anything destructive.
- **Microcopy tone**: terse, sentence-case, instructional ("Double-click the player number to edit it directly.", "No saved templates yet", "Choose a workflow above to start.") — direct and utilitarian, consistent with the bold/assertive visual voice.

## 7. Responsive Behavior

**The dashboard (marketing-style home screen) is genuinely responsive and reflows cleanly:**
- 1488px: 4-across workflow-card grid, hero on one line.
- 768px: workflow cards collapse to a 2×2 grid, hero wordmark wraps to two lines, everything else stacks in the same order.
- 375px: hero wordmark wraps to three lines and the circular "FP" logo mark relocates below the text block (it no longer fits beside it); the workflow-card grid **stays 2-across** even at phone width rather than collapsing to a single column, which keeps cards fairly narrow (~160px) but still comfortably tappable.

**The editor (canvas/Pages/Tools UI) does NOT adapt to narrow viewports at all.** At 375px width: the wordmark wraps to three lines and pushes the right-hand action cluster (`Present`/`Project`/`Saved`) off the visible viewport edge entirely (clipped, not reflowed), the left "Pages" rail keeps its full fixed desktop width and eats almost the entire screen, and the canvas itself is squeezed into a sliver a few dozen pixels wide — effectively unusable at phone width. This is a clear, concrete finding: **the product is desktop-only in the parts that matter most (the actual tactical/session editor)**, despite the dashboard shell being responsive. Gaffer's own docs explicitly note it's "used pitch-side on a touch screen" and its editor shell (mobile sheets, floating dock, hamburger nav) was built with that constraint in mind — this is a place where Gaffer's existing approach is already ahead, not something to copy.

Touch target sizing on the responsive dashboard is comfortable — workflow cards and buttons all measured well above 44px in the tap dimension at every width checked.

## 8. Accessibility

- **Heading outline**: technically deep (`h1`→`h2`→`h3` observed) but the SPA renders **every screen's headings into the DOM simultaneously** regardless of which panel is actually visible (confirmed: `headingOutline` returned entries for "Club Settings", "Join Organisation", "Studio Branding", "Send a Copy" and others while only the dashboard was on-screen). A screen-reader user tabbing or using heading-navigation would encounter a heading outline describing the *entire app*, not the current view, unless every one of those hidden panels is also correctly marked `aria-hidden`/`inert` when inactive — worth verifying directly if this pattern is ever considered, since getting it wrong here is a real accessibility trap for exactly the kind of always-mounted-panels architecture both this app and Gaffer's own tab-based UI sometimes use.
- **Landmarks**: reasonable variety in use — `header`, `nav`, `main`, `footer`, `aside`, `dialog`, `tablist`, `menu`, `alert`, `presentation`, `group` all appear. Multiple `dialog` roles coexist at once (again, the always-mounted-panel pattern) and multiple `header` roles appear (once for the true page header, again for at least one nested toolbar) — a minor landmark-hygiene issue (more than one `header` at the page level is technically valid HTML5 but can read confusingly to assistive tech that treats `header` as a landmark).
- **Images**: 6 total images on the loaded views, 1 without an `alt` attribute — a small, concrete, real gap.
- **Skip link**: none found (`a[href="#main"]` or similar). Not present.
- **Focus-visible**: tabbed through the dashboard and captured the real focus state on a workflow card. The result is a genuine, clearly visible ring — but it turns out to be almost entirely the **browser's own default focus outline** (`outline: rgb(0,95,204) auto 1px`, the UA default blue "auto" outline), which happens to sit on top of the SAME border-color/box-shadow/lift treatment the element already gets on `:hover` (since `:focus` triggers the same underlying state as `:hover` here). In other words: **there is no custom `:focus-visible` style** — it looks acceptable purely because the default outline layers over an already-styled hover-adjacent state, not because anyone designed a focus ring. This is worth being honest about rather than praising it as "good custom focus design" — it's good by accident. Gaffer, for contrast, has an explicit, deliberate global `:focus-visible` rule (a `box-shadow` glow via `color-mix`) plus a documented `forced-colors` fallback — a more robust, intentional approach than what was found here.
- **`prefers-reduced-motion`**: not respected anywhere (see Motion section).
- **Contrast**: no problems found in the pairs sampled (see Color System).

## 9. CSS Architecture & Conventions

Naming is a **flat, semantic BEM-ish/utility-mixed convention with no strict methodology** — class names like `.workflowCard`, `.homeAction`, `.canvasUndoAction`, `.workspaceAction.panelAction`, `.addPageBtn`, `.accountTrigger` read as camelCase, component-scoped, hand-named classes (one class per concept, sometimes two classes combined for a variant, e.g. `.primary.presentAction`) — not BEM's `block__element--modifier`, not Tailwind's atomic utilities, not a CSS-Modules hash, not a recognizable component-library prefix (no `Mui-`, `ant-`, `chakra-`, etc.). This reads as a genuinely hand-built, in-house component system with no external UI library underneath it (confirmed by the script list — no React, no component framework, just plain DOM manipulation across many purpose-named `*Engine.js`/`*Repository.js` files).

CSS custom-property naming has **no consistent taxonomy** — compare `--bg` (short, ad-hoc) against `--home-hover-accent`/`--home-hover-ring`/`--home-hover-soft` (a clear three-part component-state-variant pattern) against `--organisation-accent`/`--organisation-accent-glow`/`--organisation-accent-soft` (the same three-part pattern, different owner) against `--brandBlue` vs `--brand-blue` (the SAME color, defined twice, under two different casing conventions — a real duplicate-token bug, not a stylistic choice). This is useful evidence that whoever built this used variables as they went rather than starting from a token sheet — Gaffer's own `index.css` `@theme` block, by contrast, is a clean, single, deliberately-maintained set with a documented meaning for every token.

One single stylesheet (`styles.css`, 4303 rules) plus a much smaller `auth.css` (45 rules, for the logged-out login/signup screen only) — same-origin, not CORS-blocked, which is why the extraction got full, real data rather than having to fall back to `sampledElements` only.

## 10. JS Framework & Rendering

**No frontend framework** — confirmed absence of React/Vue/Next/Nuxt globals and DOM fingerprints. The app is built as a set of ~25 plain `<script>`-tag JS files loaded in a specific dependency order, named by responsibility:
```
studioConfig.js, ownershipService.js, organisationRepository.js, personalBrandingRepository.js,
memberRepository.js, invitationRepository.js, shareRepository.js, mediaRepository.js, repository.js,
state.js, rcEngine.js, homeEngine.js, annotationEngine.js, selectionController.js, canvasEngine.js,
inspectorEngine.js, sessionEngine.js, pageEngine.js, animationEngine.js, presentationEngine.js,
app.js, authEngine.js, organisationUI.js, clubSetup.js, foundationTest.js, onboardingEngine.js
```
This is a classic "repository + engine" hand-rolled architecture: `*Repository.js` files talk to Supabase, `*Engine.js` files own one area of UI behavior (canvas, selection, inspector, animation, presentation), `state.js` is presumably a shared store, `app.js` wires it together. It's directly comparable in *intent* to Gaffer's own Zustand-slices-by-domain architecture, just without a framework or a reactive state library underneath it — every DOM update is presumably done by hand rather than via a virtual-DOM diff or React re-render.

Rendering strategy: plain client-side rendering, no SSR/SSG signal (the HTML shell is minimal; content is built by the scripts after load).

Libraries in use: **`@supabase/supabase-js@2`** (same backend Gaffer uses) and **`konva@9`** (the same canvas library Gaffer's `PitchCanvas.tsx` is built on — meaning every canvas-level technique observed here, like the goalkeeper-color highlight or the batch-insert-then-drag flow, is implementable in Gaffer with the same underlying primitives, no new dependency required), both loaded from `cdn.jsdelivr.net` rather than self-hosted/bundled. Also **`html2canvas@1.4.1`**, almost certainly powering a "download as image" export feature analogous to Gaffer's own PNG export.

## 11. Asset Pipeline

- **Logo**: a single `assets/first-phase-logo.jpeg` — a JPEG for a logo mark is a real inefficiency (no alpha transparency, so the app compensates by always placing it inside a solid black circle rather than letting it sit directly on any background; an SVG or PNG would render cleanly on any surface color, including the dynamic per-organisation brand color described in Color System). Flag as "don't copy" rather than a technique.
- **Fonts**: no `@font-face`, no font-service request — see Typography. Inter is referenced by name only and silently falls back to Arial if not present on the visiting machine's system.
- **Icons**: no icon font or SVG sprite sheet detected in this pass; the chevron/plus/etc. glyphs sampled appeared to be plain text characters (`+`, `‹`, `▾`) rather than SVG icons in several places (e.g. the `.addPageBtn`'s `+` is literally the text glyph "+" at `font-size: 24px`, not an icon). This is a simpler, more brittle approach than Gaffer's `lucide-react` SVG icons (a text-glyph "+" can't be recolored/sized independently of font-rendering quirks the way an SVG path can) — not a technique worth adopting.
- **CDN usage**: Supabase JS, Konva, and html2canvas are all pulled from `cdn.jsdelivr.net` at request time rather than bundled/self-hosted — meaning this app's first load depends on jsDelivr's availability. Gaffer bundles its dependencies via Vite instead, which is more robust (no third-party CDN as a runtime dependency) and is the better pattern of the two.
- No `manifest.json`/PWA signal was found — this is a plain web app, not an installable PWA, unlike Gaffer (which has `vite-plugin-pwa`).

## 12. Local Codebase (Gaffer) — Porting Considerations

Gaffer's actual setup, read directly from the repo for this section:
- **Styling**: Tailwind v4, CSS-first `@theme` tokens in `src/index.css`, one clean `--color-*`/`--font-*` token block with a `:root[data-theme='light']` override block for light mode. No component library beyond Gaffer's own `src/components/ui/` (`Card`, `PageHeader`, `NumberBadge`, `Badge`, `Dropdown`).
- **Canvas**: `react-konva` (Konva under React) — the exact same underlying library First Phase Studio uses directly, so canvas-level recipes below translate with no new dependency.
- **Conventions** (from `design.md`): `rounded-xl` (12px) for panels, `rounded-md`/`rounded-lg` for buttons/inputs, `rounded-full` for pills; **no drop shadows anywhere on chrome as a surface treatment** (the one carve-out being the focus ring); a single restrained lavender accent (`#5e6ad2`) used scarcely, never as a fill.

Given that last point, First Phase Studio's shadow-and-glow-heavy aesthetic (dozens of distinct multi-layer `box-shadow` values, several exceeding `0 30px 100px`) is **directly at odds with an explicit, already-documented Gaffer decision** ("No shadow-sm/drop shadows anywhere on chrome... depth comes from border-line against bg-panel/bg-surface"). The porting guide below therefore does NOT recommend adopting First Phase Studio's shadow system wholesale — it recommends the specific techniques that don't require reversing that decision (the hover-lift transform, the per-organisation color-mix theming, the bold-weight typographic voice, the page-thumbnail list pattern), and calls out the shadow-heavy elevation system explicitly under "What NOT to copy."

## 13. Porting Guide — Implementing This Design Elsewhere

### Design tokens

Nothing here needs new tokens — Gaffer's existing `index.css` `@theme` block already covers the same roles (surface/panel/line/ink/accent/ok/warn/bad). The one genuinely new *capability* worth adding, if the per-organisation theming idea (see Color System) is adopted, is a single additional override token:

```css
/* src/index.css — additive, alongside the existing @theme block */
:root {
  /* Falls back to the existing accent when a team hasn't set a custom color */
  --color-team-accent: var(--color-accent);
}

/* Wherever a team/club color is loaded (e.g. into teamSlice), set it inline: */
/* document.documentElement.style.setProperty('--color-team-accent', team.brand_color) */
```
Then any canvas/tactics-board chrome that wants to react to a team's own color reaches for `var(--color-team-accent)` via `color-mix()` exactly the way First Phase Studio's `--geoColor`/`--organisation-accent` do — e.g. a tactics-board card border:
```css
border-color: color-mix(in srgb, var(--color-team-accent) 55%, var(--color-line));
```
This is additive and optional — nothing breaks for a team with no custom color, since it falls back to Gaffer's existing accent.

### Typography setup

No change to font loading (Gaffer already self-hosts-via-Google-Fonts-link correctly, which is already better than the source site's un-served `font-family: Inter` reference). The portable idea is the **weight-and-tracking recipe for a bold display moment**, as a one-off utility rather than a global change (Gaffer's `design.md` is explicit that hierarchy comes from weight/size on ONE family, which this matches — it's a specific combination, not a new family):

```css
/* A "hero wordmark" treatment — use sparingly, e.g. a landing-page brand mark */
.display-heavy {
  font-weight: 900; /* Tailwind: font-black, if available in the loaded Inter weights */
  letter-spacing: -0.04em; /* tighter than Gaffer's usual tracking-tight (-0.025em) */
  text-transform: uppercase;
  line-height: 0.9;
}

/* The small-uppercase-eyebrow-label counterpart — bold AND wide, not just wide */
.eyebrow-heavy {
  font-weight: 700;
  font-size: 0.75rem; /* 12px */
  letter-spacing: 0.12em; /* ~1.9px at 12px — matches the measured 1.92px */
  text-transform: uppercase;
}
```

### Component recipes

**1. Hover-lift card** (the verified `.workflowCard` diff) — a drop-in replacement recipe for any Gaffer card that should feel clickable, adapted to Gaffer's own no-drop-shadow-as-surface-treatment rule by keeping the shadow subtle and blue-tinted rather than the source's heavy black ambient shadow:
```css
.hover-lift-card {
  border: 1px solid var(--color-line);
  border-radius: 0.75rem; /* rounded-xl, per design.md */
  background: var(--color-panel);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.hover-lift-card:hover {
  border-color: var(--color-accent);
  transform: translateY(-4px);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent) 22%, transparent);
  /* deliberately omits the source's heavy `0 20px 55px rgba(0,0,0,.34)` ambient
     shadow — Gaffer's own rule is no shadow-as-surface-treatment; the border-color
     + ring + lift alone reproduces the "this responded to me" feeling without it */
}
```

**2. Outline-glow primary button** (an alternative to a solid `bg-accent` fill, for a dark UI where a fully-saturated fill can feel heavy):
```jsx
// As a Button variant, e.g. <Button variant="glow">Present</Button>
```
```css
.btn-glow {
  background: transparent;
  border: 1px solid color-mix(in srgb, var(--color-accent) 82%, transparent);
  border-radius: 0.75rem; /* rounded-lg-ish, per design.md's button radius */
  box-shadow: 0 8px 20px rgba(0,0,0,.2), inset 0 1px 0 rgba(255,255,255,.06);
  color: var(--color-ink);
  font-weight: 700;
  transition: border-color 0.16s, box-shadow 0.16s, background 0.16s, transform 0.16s;
}
.btn-glow:hover {
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
}
```

**3. Page-list item with thumbnail + inline actions** (the single most concretely useful, low-risk borrow — applies directly to Gaffer's `/design` and `/tactics` picker lists):
```jsx
<li className="flex items-center gap-3 rounded-lg border border-line p-2 hover:bg-panel-raised">
  <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-panel-raised">
    {/* drill.thumbnail_url — Gaffer already generates and stores this; the
        /design picker just doesn't render it today, unlike /drills which does */}
    <img src={drill.thumbnail_url} className="h-full w-full object-cover" />
  </div>
  <div className="min-w-0 flex-1">
    <p className="truncate text-sm font-medium text-ink">{drill.name}</p>
    <p className="truncate text-xs text-ink-muted">{pitchLabel(drill)} · {drill.keyframes.length} keyframes</p>
  </div>
  <div className="flex shrink-0 gap-1">
    {/* reorder / duplicate / delete — Gaffer already has duplicateDrill and
        (as of this session) deleteDrill; this just surfaces them inline
        instead of requiring a click-through to the editor first */}
  </div>
</li>
```

### Motion recipes

The only `@keyframes` block found is a trivial opacity pulse, fully portable as-is if a "saving…" pulse indicator is ever wanted:
```css
@keyframes pulse-dot {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}
```
The hover-lift transition timing (`0.18s ease` on `border-color, box-shadow, transform`) is captured in the Component Recipes section above — no separate library is needed to reproduce anything found in this analysis; every effect observed was plain CSS transitions, achievable with zero new dependencies.

### What NOT to copy directly

- **The shadow-heavy elevation system.** Dozens of large, dark, multi-layer `box-shadow` values (`0 30px 100px rgba(0,0,0,.42)` and heavier) are the source site's primary depth cue. This directly contradicts Gaffer's own explicit, already-documented rule against shadows-as-surface-treatment. Take the *specific* hover-lift recipe above (which already omits the heavy shadow) rather than the general elevation philosophy.
- **The discrete-frames "Progressions" timeline model.** This is architecturally the phase-based model Gaffer deliberately tore out; Gaffer's continuous seconds-based keyframe timeline is strictly more capable (real interpolation between any two states) and should not be walked back toward frame-snapshots.
- **Un-served `font-family: Inter` with no `@font-face`.** Always self-serve or link the font; don't reference a name and hope it's installed.
- **A JPEG logo mark.** Use SVG or a transparent PNG so it can sit on any background, especially if per-organisation brand theming is ever adopted.
- **Loading core dependencies (Konva, Supabase client) from a public CDN at runtime** rather than bundling them — Gaffer's Vite bundle is already the more robust choice here; don't regress toward a CDN `<script>` tag approach.
- **The `--accent` / `--brandBlue` naming collision** (two different "this is the accent" concepts under overlapping names, plus the same color defined twice under different casing). If porting the per-organisation theming idea, name the new token unambiguously (`--color-team-accent`, as proposed above) rather than reusing or shadowing Gaffer's existing `--color-accent`.
- **No-confirmation delete on a placed player.** Gaffer's own recent convention (confirm-before-delete on teams/players/drills/tactics) is the safer pattern; don't relax that for canvas-entity deletion just because this source app does.
- **The always-mounted-hidden-panels DOM pattern**, at least not without deliberately verifying every hidden panel is `aria-hidden`/`inert` — the heading-outline pollution and duplicate `dialog`/`header` landmarks observed here are a plausible direct consequence of that architecture and are worth avoiding by construction rather than discovering after the fact.

## Screenshots Captured

1. Login/auth screen at 375×800 — `auth.css`-styled, separate from the main app shell.
2. Dashboard at ~1488×812 (desktop) — hero header, 4 workflow cards, My Projects/My Templates panels.
3. Dashboard, tab-focus state at ~1488×812 — visible focus ring on the "Match" workflow card (2nd tab stop).
4. Editor shell, empty state (no page yet) at ~1488×812 — Pages rail + empty canvas.
5. Page-template picker dropdown (Tactical / Board-Media / Frameworks groups) at ~1488×812.
6. Empty tactical board (full pitch, Konva-rendered) at ~1488×812.
7. Tools bar expanded (Players/Formation/Field/Equipment/Drawing tabs) at ~1488×812.
8. "Players" tool panel open (Colour/Quantity/Labels/Size/Insert Players) at ~1488×812.
9. 5 players inserted (clustered top-left) + right inspector panel opened, clipped at 1488px width.
10. Same state at 1800×900 — full, unclipped inspector panel (Number/Colour/Text/Opacity/Bring to Front/Send to Back/Duplicate/Delete).
11. "Formation" tool panel open (Team Colour/Labels/Direction/5 formation presets) at 1568×659.
12. 4-3-3 formation applied — full labelled XI with a distinct yellow goalkeeper — at 1568×659.
13. "Drawing" tool panel open (Zone/Circle-Ellipse/Arrow/Solid-Dotted-Dashed Line/Curved Arrow/Zig-Zag) at 1568×659.
14. "Choose Timeline Mode" splash (Progressions vs Animation) at 1568×659.
15. Animation/frame-filmstrip mode (Timeline back-button, Delete, Speed, Stop, Play, Update Frame, Frame 1 + "+") at 1568×659.
16. Presentation ("Present") mode — chrome-free board view with a bottom hover toolbar (Pointer/Draw/Line/Highlight/Notes/Clear) at 1568×659.
17. Dashboard at 768×900 (tablet) — 2×2 workflow-card grid, hero wraps to two lines.
18. Dashboard at 375×900 (mobile) — hero wraps to three lines, logo relocates below text, cards stay 2-across.
19. Editor shell at 375×900 (mobile) — does not reflow; wordmark wraps to 3 lines, right-side actions clipped off-viewport, canvas squeezed to a sliver.

## Raw Extraction Data

The full token-extraction JSON (colors, cssCustomProperties, borderRadii, boxShadows, transitions, fontSizes/Weights, gridTemplateColumns, mediaQueries, zIndexes, stylesheetsSeen, scriptSrcs, accessibility block) was captured via two `extract-tokens.js`-derived calls during this session (one broad pass, one focused `sampledElements` pass limited to visible, deduplicated elements to stay under output size limits). Every specific value quoted above (hex codes, px/rem numbers, `cubic-bezier`/`ease` curves, class names, CSS variable names) was read directly from that data or from a live SNAPSHOT/DIFF interaction-state capture, not estimated — this document is the complete synthesis of that raw data rather than a subset of it.
