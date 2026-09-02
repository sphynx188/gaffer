# Gaffer — automated test report

**Date:** 2026-08-30
**Branch/commit:** `main` @ `3a07553`
**Method:** Playwright (Chromium headless) driving the live dev server at
`localhost:5173`, signed in as the demo club admin
(`barca.admin@gafferdemo.app`, FC Barcelona (demo)). Accessibility audited
with axe-core 4.10.2 against WCAG 2.0 A + AA. Data claims verified directly
against the live Supabase project (`zaougjiavbqdlgweidpc`).

Scripts live in the job scratch dir (`.../tmp/gt/`) and are disposable — they
are not committed.

---

## Summary

47 checks across routing, both editors, the library, share pages, mobile
layout, accessibility and performance. **The app is in good shape:** no
console errors, no page errors and no failed network requests on any route
tested, and every feature built in the recent editor work behaves as
intended.

Seven issues found. Two are worth fixing soon; the rest are polish.

| # | Severity | Issue | Area | Status |
|---|----------|-------|------|--------|
| 1 | **High** | `/design` creates a throwaway drill row on every visit | Data | **Fixed** |
| 2 | **High** | No keyboard undo/redo (Cmd+Z / Ctrl+Z do nothing) | Editors | **Fixed** |
| 3 | Medium | Library grid cards: 3 axe violations × 17 nodes | A11y | **Fixed** |
| 4 | Medium | Colour contrast below AA (worse in light mode) | A11y | **Fixed** |
| 5 | Low | Unknown URLs silently redirect to `/`, no 404 | Routing | **Fixed** |
| 6 | Low | `CLAUDE.md` says "dark-mode-only" but light mode ships | Docs | **Fixed** |
| 7 | Low | Single 1.1 MB JS chunk, no code splitting | Perf | **Fixed** |

All seven were fixed on 2026-08-30 — see **Resolutions** below for what each
change was and how it was verified. The findings are kept as written so the
reasoning behind each fix stays readable.

---

## 1. `/design` creates a throwaway drill on every visit — **High**

Visiting `/design` auto-creates a drill and redirects to it. That is the
intended flow (it replaced the old create form), but **nothing cleans up when
the coach doesn't use it**. Every stray visit — a mistyped URL, a back-button
bounce, a nav misclick — leaves a permanent row in the library.

**Evidence.** During the route crawl a single `/design` visit created
`faeb84ee-0f21-4a8e-a28f-7e9503e419a0`. Querying the live table:

```sql
select name, count(*), count(*) filter (
  where jsonb_array_length(coalesce(scene->'entities','[]'::jsonb)) = 0
) as empty_scene
from drill group by name order by count(*) desc;
```

| name | count | empty scene |
|---|---|---|
| New drill | **27** | **16** |
| (every other drill) | 1 each | — |

All 27 date from 2026-08-29 onward — i.e. since the auto-create change. 16 of
them have never had a single entity placed. The library's own count has drifted
to 25 visible rows, most of it noise.

**Why it matters.** The library is the coach's main surface; it is filling with
identically-named empty drills that must be deleted by hand, one at a time.

**Suggested fixes** (any one closes it):
- Create the row lazily — on the first actual edit rather than on navigation.
  `DesignPage.tsx` would route to a draft editor and only call `createDrill`
  when the first entity/marking lands.
- Or delete on unmount when the drill is still untouched (empty scene, name
  unchanged, no thumbnail).
- Or hide untouched `New drill` rows from the library and sweep them on a timer.

Worth a one-off cleanup of the existing 16 empties either way.

---

## 2. No keyboard undo/redo — **High**

`Cmd+Z` and `Ctrl+Z` do nothing in either editor. The toolbar buttons work
correctly; only the keyboard path is missing.

**Evidence.** Placed a player, then:

| action | markers before → after | result |
|---|---|---|
| Undo **button** | 4 → 2 | works |
| Redo **button** | 2 → 4 | works |
| `Meta+z` | 4 → 4 | **no-op** |
| `Control+z` | 4 → 4 | **no-op** |

Confirmed in source — there is no `keydown` handler bound to `z` anywhere in
`src/`. `useMarkingKeys` and `useTimelineKeys` both deliberately *ignore*
modified presses (so `C`/`V` stay free for Circle and Curve), and nothing else
picks undo up.

**Why it matters.** Cmd+Z is reflex in any canvas tool. A coach who drags a
player by accident will reach for it before they look for a button, and the
silent no-op reads as "the app lost my edit".

**Suggested fix.** Add a shortcut alongside the existing key hooks, guarded so
it doesn't fire while typing in an input:

```ts
// Cmd/Ctrl+Z → undo, Cmd/Ctrl+Shift+Z (and Ctrl+Y) → redo
if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { … }
```

Note `useTimelineKeys` currently returns early on Ctrl/Cmd — that guard is what
keeps this free, so the new handler should live beside it rather than inside it.
In the tactics editor, undo is scoped (`'timeline'` vs `'drawing'`), so the
shortcut needs to pick one — `'timeline'` matches the top bar button.

---

## 3. Library grid cards — 3 accessibility violations — **Medium**

axe reports three issues on `/library/drills`, each on **17 nodes** (one per
card). All three come from the same element, so one fix clears ~51 violations.

| id | impact | what |
|---|---|---|
| `aria-allowed-attr` | **critical** | `aria-selected` on `role="button"` — not a supported attribute for that role |
| `nested-interactive` | serious | interactive controls nested inside the `role="button"` card |
| `aria-toggle-field-name` | serious | `<span role="checkbox">` with no accessible name |

Offending shape:

```html
<div role="button" tabindex="0" aria-selected="false" class="group relative flex …">
  <span role="checkbox" aria-checked="false" class="flex h-4 w-4 …"></span>
  …
</div>
```

**Suggested fix.** In the library card component:
- Swap `aria-selected` for `aria-pressed` (valid on `button`), or give the card
  `role="option"` inside a `role="listbox"` if selection is the real semantic.
- Give the checkbox an accessible name — `aria-label={`Select ${item.name}`}`.
- Resolve the nesting: a card that is itself a button must not contain other
  buttons. Common fix is to make the card a plain container with a stretched
  link/button for the primary action, leaving the checkbox and row menu as
  siblings rather than descendants.

---

## 4. Colour contrast below WCAG AA — **Medium**

Two tokens fail 4.5:1 for body text, in both themes. Light mode is materially
worse.

**Dark (default):**

| text | fg | bg | ratio | needs |
|---|---|---|---|---|
| "Collections", "17 items", "Saved" | `#62666d` (`--color-ink-faint`) | `#010102` | **3.61:1** | 4.5:1 |
| sharing help text | `#62666d` | `#0f1011` | **3.30:1** | 4.5:1 |
| active keyframe "01 Keyframe" | `#5e6ad2` (`--color-accent`) | `#1b1d2e` (accent/15) | **3.54:1** | 4.5:1 |
| active tool "Select" | `#5e6ad2` | `#0f1011` | **4.05:1** | 4.5:1 |

**Light:**

| text | fg | bg | ratio |
|---|---|---|---|
| "Collections", "17 items" | `#a1a1aa` (`--color-ink-faint`) | `#fbfbfa` | **2.47:1** |
| active nav "Drills" | `#5e6ad2` | `#e3e5f4` | **3.75:1** |

**Suggested fix.** Two token changes cover nearly all of it, in `src/index.css`:
- Darken/lighten `--color-ink-faint`. Dark theme needs roughly `#7d828a` to
  clear 4.5:1 on `#010102`; light theme needs about `#6b6b73` on `#fbfbfa`.
- The `bg-accent/15 text-accent` "active chip" pattern is the other repeat
  offender (nav tabs, active keyframe, active tool). Either deepen the tint or
  use a stronger foreground than raw `--color-accent` when it sits on its own
  15% wash.

Both are design-system decisions rather than mechanical fixes, so worth a look
against `design.md` before changing.

---

## 5. Unknown URLs silently redirect to `/` — **Low**

`/nonexistent-route-xyz` and `/admin/coaches` (not a real route — settings live
at `/settings/*`) both land on the club home with no explanation. A coach
following a stale bookmark or an old link just ends up somewhere else with no
indication anything was wrong.

The *in-app* not-found handling is good by contrast — opening a drill from
another club correctly shows **"That drill isn't in your library."** with a
"Back to drills" action. A catch-all route with the same treatment would match.

---

## 6. `CLAUDE.md` says dark-mode-only, but light mode ships — **Low**

`gaffer/CLAUDE.md` (Styling) states the colour system is *"dark-mode-only, no
light theme"*. In fact `src/index.css` defines a full light palette
(lines 66–74), the root carries `data-theme="light"`, and the app shell has a
working **"Switch to light mode"** button.

This matters beyond tidiness: the instructions tell future contributors not to
worry about a theme that exists and currently has the **worst contrast in the
app** (2.47:1). Either document light mode as supported and hold it to the same
bar, or remove the toggle.

---

## 7. Single 1.1 MB JS chunk — **Low**

Production build emits one bundle:

```
dist/assets/index-Ct789etU.js   1,128 kB │ gzip: 318 kB
dist/assets/index-DEjMgRAg.css     50 kB │ gzip:  10 kB
```

Vite already warns about this. Konva, Supabase and the whole app ship together,
so the login screen downloads the entire canvas engine before it can render.

Not urgent — dev-server FCP measured **112–116 ms** and the app feels fast — but
the obvious win is a dynamic `import()` around the Konva-dependent editor
routes, which are the only places `PitchCanvas` mounts. That would keep Konva
out of the login, home, library and settings paths.

---

## What passed

Recorded so regressions are visible next time.

**Routing & health** — all 10 routes tested load with **zero** console errors,
page errors and 4xx/5xx responses: `/`, `/library/drills`, `/library/tactics`,
`/create`, `/settings`, `/design`, `/tactics/new`, plus unknown-route and
cross-club cases. Load 174–703 ms.

**Drill editor** — Konva stage mounts; Player tool places a marker; Equipment,
Markings, Grid & guides and Pitch panels all open and dismiss on Escape; Add
keyframe works; selecting a player opens the properties panel with Display and
Number; undo/redo buttons correct. No console errors throughout.

**Tactics editor** (this session's rebuild) — labelled tool row present
(Select / Markings / Ball / Formation / Home team / Pitch); Keyframes +
playback + Onion skin / Player paths / Ghost trails in the right panel; no
docked bottom timeline; Portrait/Landscape and both panel-toggle buttons gone;
**board fills 100 % of its column** (1044 / 1044 px); formation picker shows
11v11 / 9v9 / 7v7 tabs; 11v11 sections into BACK THREE / BACK FOUR / BACK FIVE;
offered set correctly trimmed — 9 common 11v11 **plus the tactic's own
`3-1-4-2`** (confirming the "keep the current shape listed" rule), 9v9 → 3-2-3,
3-3-2, 2-3-3; 7v7 → 2-3-1, 3-2-1, 2-2-2.

**Library** — 25 rows render; search filters and shows *"Nothing here matches
that search."*; clearing restores; Drills ↔ Tactics tabs switch correctly.

**Share pages (anonymous)** — an invalid token shows *"This link isn't active.
Ask the coach who sent it for a new one."* and, importantly, **leaks no app
shell** — no nav, no Library, no Settings. No page errors.

**Onboarding tour** — auto-opens once, dismisses cleanly, writes its seen key,
and does not reappear after reload.

**Mobile (390 × 844)** — **no horizontal overflow** on library, drill editor or
tactics editor; canvas fits the viewport (358 px wide); hamburger nav present.

**Performance** — FCP 112–116 ms, DOMContentLoaded ~95 ms on the dev server.

---

## Notes / caveats

- Testing ran against the **live Supabase project**, as the demo club admin.
  It created one drill (`faeb84ee-…`, via the `/design` route crawl) and left a
  few players and a keyframe on it — that row is itself an instance of issue 1.
  Nothing was deleted.
- Two initially-red checks were **test-harness faults, not app bugs**, and are
  recorded as passes above: a row selector assuming `<tbody><tr>` when the
  library uses cards, and an empty-state assertion that missed the correct
  "Nothing here matches that search." copy.
- Contrast, bundle size and the perf numbers come from the dev server; a
  production build behind compression will differ on transfer size but not on
  contrast or chunking.


---

# Resolutions — 2026-08-30

Every fix was verified by re-running the same check that found it.

### 1. Orphan drills → create on first edit

`/design` no longer inserts. `drillSlice.startDrillDraft` builds the drill in
local state with a client-generated uuid, so the editor, the URL and undo all
work on it unchanged; `runFlush` turns the first commit into an INSERT carrying
that id. A visit that goes nowhere writes nothing.

Two things this ran into, both worth keeping in mind:

- The draft insert must send the **whole row**, not the autosave snapshot — a
  snapshot is only `scene`/`keyframes`/`duration_seconds`/`pitch`, so inserting
  it alone omitted `club_id` and `name` (both NOT NULL) and the row was
  silently rejected. The first attempt lost the edit entirely.
- Discarding an untouched draft on the editor's unmount **does not work under
  StrictMode**: the mount → cleanup → mount cycle deleted the draft between the
  two mounts and the editor rendered "That drill isn't in your library."
  Drafts are instead filtered out of the library list and evaporate on reload,
  which needs no lifecycle guesswork.

*Verified:* visiting `/design` and leaving writes no row (confirmed absent from
the table by id); visiting, placing one player and reloading gives a row with
`entities = 1` and a `club_id`.

### 2. Keyboard undo/redo

New `useUndoKeys` hook, used by both editors. Cmd/Ctrl+Z undoes,
Cmd/Ctrl+Shift+Z and Ctrl+Y redo. It is a separate hook because
`useMarkingKeys` and `useTimelineKeys` both deliberately ignore modified
presses — that guard is what leaves the combination free. Tactics binds the
`'timeline'` scope, matching its top-bar button, so a bare Cmd+Z can never
rewind free-drawn markings the coach didn't mean to touch.

*Verified:* drill 6→4 on Cmd+Z, 4→6 on Cmd+Shift+Z, 6→4 on Ctrl+Z; tactics
3→2 and 2→3. Typing in the drill-name field and pressing Cmd+Z leaves the
canvas untouched, so the browser's own undo still belongs to the input.

### 3. Library card accessibility

`Checkbox` is now a real `<input type="checkbox">` inside a `<label>`, visually
hidden behind the drawn box, with the span marked `aria-hidden`. The row and
tile stopped being `role="button"` (they contain other controls, which is what
`nested-interactive` was reporting) and dropped the `aria-selected` that role
never supported — selection is conveyed by the checkbox's own state.

*Verified:* **zero** WCAG 2 A/AA violations in both grid and list view, down
from 3 violations across 51 nodes. Selection still works by click, the name
flips between "Select …" and "Deselect …", and the box is keyboard focusable.

### 4. Colour contrast

- `--color-ink-faint` lifted in both themes: `#62666d → #7d828a` (dark),
  `#a1a1aa → #6b6b73` (light).
- New `--color-accent-ink` (`#9aa3ee` dark / `#4c56b0` light) for accent
  **text**, because `--color-accent` is also a background with white on it:
  white-on-accent needs a dark value and accent-as-text needs a light one, and
  no single value clears 4.5:1 for both. 53 `text-accent` usages were moved
  across; the 6 `text-accent-hover` were left alone.
- Light-theme `--color-ok` darkened to `#0f6b30` (was 4.09:1 on its own wash).
- Two hardcoded `text-slate-400` in `PitchCanvas` replaced with `text-ink-faint`
  — a violation of the design-system rule as well as the contrast one.

*Verified:* zero contrast violations across library, drill editor, tactics
editor and settings, in **both** themes.

### 5. 404 page

`<Route path="*">` renders a `NotFoundPage` instead of `<Navigate to="/">`, so
a stale bookmark keeps its URL and says what happened.

*Verified:* `/nonexistent-route-xyz` now stays at that URL and renders the page
rather than silently landing on the club home.

### 6. Documentation

`CLAUDE.md` corrected: the light theme is documented as shipping, with a note
that token changes must clear AA in all three blocks, and that
`--color-accent` cannot be lightened because `--color-accent-ink` exists for
the text role.

### 7. Bundle splitting

The ten Konva-mounting screens are `lazy()` chunks behind a `Suspense`
boundary. **Entry bundle 1,128 KB → 611 KB (−46 %)**; Konva now sits in its own
306 KB chunk that login, home, library and settings never download.

*Verified:* all 10 routes still load with zero console, page and HTTP errors.

---

## Data cleanup

13 empty `New drill` rows deleted, under a deliberately conservative filter —
zero entities, zero markings, no thumbnail, not shared — and only after
confirming none was attached to a session or a collection.

**Two empty rows were left**, both in *My Club*: they are empty but carry an
auto-captured thumbnail, so they fell outside the safe filter. They can be
deleted from the Library, or on request.

## Test artifacts left behind

Testing ran against the live demo club and left a few drills in *FC Barcelona
(demo)* with a stray player or keyframe on them (two named `New drill`). They
have real content so the cleanup filter correctly did not touch them; say the
word and they can go.
