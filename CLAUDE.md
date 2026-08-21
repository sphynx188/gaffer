# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gaffer — a solo-built football/soccer coaching PWA. A coach manages multiple
teams: roster, session planning/scheduling, attendance, and a Konva-based
drill-design canvas. Single external user (the repo owner, a coach); no
public signup flow beyond Supabase auth.

Stack: React 19 + Vite + TypeScript (non-strict — see `tsconfig.app.json`,
no `strict: true`) + Zustand 5 (slices) + Supabase (Postgres/Auth/RLS) +
Tailwind v4 (CSS-first `@theme` tokens, dark-mode-only) + Konva/react-konva
+ react-router-dom v7.

Read [HANDOFF.md](HANDOFF.md) first — it's kept up to date after every work
session with what changed, what worked, what didn't, and what's pending.
Treat it as the primary source of recent-history context; this file covers
the stable architecture instead. See also
[UPGRADE_IMPLEMENTATION_PLAN.md](UPGRADE_IMPLEMENTATION_PLAN.md) for the
in-progress feature roadmap and its phase-by-phase execution plan.

**Before writing or changing any UI, read [design.md](design.md) first.**
It's the design-system reference — color/type tokens, the touchline motif
and where it does and doesn't apply, component conventions (`Card`,
`PageHeader`, `NumberBadge`), and the corner-radius/shadow rules. Skipping
it is how the pre-redesign generic-SaaS defaults (`rounded-xl` + shadow,
raw hex colors) crept back in before.

## Commands

All commands run from this directory (`/Users/max/Desktop/app/gaffer`) — the
parent `/Users/max/Desktop/app` is **not** a git repo, only this directory
is. If a fresh shell lands in the parent, `cd` back in explicitly.

```bash
npm run dev       # vite dev server
npm run build      # tsc -b && vite build — the primary correctness check
npm run lint       # oxlint
npm run preview    # preview a production build
```

There is no test suite. Verification is `npm run build` + `npm run lint` +
manual code review, plus (as of the persistent-auth work — see
UPGRADE_IMPLEMENTATION_PLAN.md Phase 1) a live logged-in Browser-pane
walkthrough via a disposable test coach account. A pre-existing
`react(preserve-manual-memoization)` oxlint warning on
`SessionPlanner.tsx`/`AttendancePage.tsx` predates any current work and is
safe to ignore.

## Architecture

### Single shared Zustand store, sliced by domain

`src/store/useStore.ts` combines one Zustand store from per-domain slices in
`src/store/slices/` (`teamSlice`, `playerSlice`, `playerNoteSlice`,
`sessionSlice`, `drillSlice`, `sessionDrillSlice`, `availabilitySlice`).
**Both** the planning side (team/player/session/attendance) and the
Design/canvas side (drills) read from this one store — a second store must
never be introduced; that split was explicitly ruled out early on.

Every slice funnels Supabase calls through `runSupabaseAction`
(`src/store/supabaseAction.ts`), the one place PostgrestError → user-facing
message translation happens. Components never call `supabase.from(...)`
directly — they call a store action.

`selectedTeamId` (`teamSlice`) is the single source of truth for "current
team" scope, persisted to `localStorage` and reconciled against the
RLS-scoped team list on every `fetchTeams`. Never derive current-team as
`teams[0]` elsewhere. Switching teams clears every other slice's
team-scoped arrays (`clearTeamScopedState` in `teamSlice.ts`) so stale data
from the previous team never flashes on screen while the new team's fetch
is in flight.

### Routing / shell

`src/App.tsx` gates everything on `useSession()` (loading → login → routed
app). Signed-in routes render inside `src/layout/AppShell.tsx`, which swaps
between two tab sets based on the active route (`TEAM_SCOPED_PATHS` in
`AppShell.tsx`):
- Coach-level (cross-team): Dashboard, Teams, Calendar
- Team-level (scoped to `selectedTeamId`): Overview, Roster, Sessions,
  Attendance, Design, Drill library

Rendered as a sticky top bar on `lg:`+ and a hamburger drawer below it —
there is no permanent sidebar.

### Data model

`src/store/types.ts` mirrors the Postgres schema and is the type source of
truth for the app. **`supabase/schema.sql` is stale** — it documents the
original fresh-install schema and is deliberately never edited after the
fact; all schema evolution since lives in numbered files under
`supabase/migrations/`. To know the real current schema, read
`schema.sql` + every migration in order, or check `src/store/types.ts`, or
just ask the Supabase MCP server (`list_tables`) — that's the actual live
source of truth if the repo's migration files and the deployed DB ever
disagree. When a column stops being used anywhere (grep first to confirm),
the pattern is: drop it via a new numbered migration and strip all UI in
the same change, rather than leaving it half-wired — see migrations
008/009/010 for precedent.

Core tables: `team` → `team_coaches` (membership/role) / `player` (with
`player_notes`) / `session` (with `availability` per player) / `drill`
(team-owned or `team_id = null` for coach-wide reusable drills) /
`session_drills` (join table ordering drills within a session). RLS is
enabled on every table; policies live in `supabase/rls_policies.sql`, built
on two `security definer` helper functions (`is_team_member`,
`is_team_owner`) — every new table's RLS should reuse those rather than
redefining membership checks inline. `drill.phases` is a jsonb array of
phase objects (players/cones/balls/arrows/annotations, each in
**normalized 0–1 pitch coordinates** so one drill renders correctly on any
pitch shape) — typed in full in `src/store/types.ts` (`DrillPhase` and
friends). Because phase content lives in jsonb, extending it (new element
`kind` fields, new optional properties) never needs a migration — only real
columns (like `drill.pitch_format`) do.

### Design canvas (Konva)

`src/components/design/` holds the drill-design canvas: `PitchCanvas.tsx`
(react-konva stage/rendering), `pitchGeometry.ts` (pitch-format-aware
coordinate math), `pitchTheme.ts` (the one place canvas colors live — mirror
of `index.css`'s UI-chrome tokens, kept deliberately separate since canvas
elements are drawn, not styled with Tailwind classes), `DrillPreview.tsx`,
`DrillLibrary.tsx`. `PitchCanvas` only ever renders positions/shapes handed
to it and reports interactions back via callbacks — it never talks to
Supabase itself; persistence is always the caller's job (see
`DrillPreview.tsx`'s `persistPhases`). This separation is why other
pitch-based features (e.g. a tactics board) can reuse `PitchCanvas` as-is by
adapting their own data into the same phase shape, rather than forking the
canvas component.

### Styling

See **[design.md](design.md)** for the full design system — color/type
tokens, the touchline motif, and component conventions. Briefly:
`src/index.css` defines the entire color system as Tailwind v4 `@theme`
CSS custom properties (`--color-surface`, `--color-panel`, `--color-ink`,
`--color-accent`, etc.) — dark-mode-only, no light theme. Always reach for
these tokens (`bg-panel`, `text-ink-muted`, `border-line`, `bg-accent`,
`text-ok`/`text-warn`/`text-bad` for status colors) instead of raw Tailwind
slate/indigo classes or arbitrary hex values.

For any header + repeated-data-row UI (tables, grids), use a shared
`grid-template-columns` constant applied to both the header and every row
(see `ROW_GRID` in `PlayerRoster.tsx`) — `flex`/`flex-1` breaks alignment
silently whenever the header and a data row don't have the same number of
flex children, which happened once already (roster columns misaligning
between header and rows because the header had 4 cells and rows had 5).

### PWA / offline

`vite-plugin-pwa` (config in `vite.config.ts`) precaches the app shell and
uses NetworkFirst caching for GET requests to the Supabase REST API only.
This is deliberately read-only: no offline write queueing/retry exists or
is planned — POST/PATCH/DELETE to Supabase simply fail offline like they
would with no service worker. `src/components/OfflineBanner.tsx` is
mounted above every top-level branch in `App.tsx` (loading/login/signed-in)
so the "you're offline" notice is never scoped to only signed-in views.

## Environment

Copy `.env.example` to `.env.local` and fill in `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` from the Supabase project dashboard. The Supabase
MCP server available in this environment is already configured against the
live project (id `zaougjiavbqdlgweidpc`, "Gaffer 2") — prefer it for
`apply_migration`/`execute_sql` when making schema changes, and always also
write the matching file under `supabase/migrations/` to keep the repo's
migration history complete.

## Housekeeping

`_to_delete/` is a pre-existing, untracked dead-code directory kept
deliberately untouched (never added to a commit, never deleted) absent
explicit user instruction otherwise — leave it as-is.

---

## Behavioral guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with
project-specific instructions (above) as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial
tasks, use judgment.

### 1. Think Before Coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If
  yes, simplify.

### 3. Surgical Changes

Touch only what you must. Clean up only your own mess.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.
- The test: every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it
work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer
rewrites due to overcomplication, and clarifying questions come before
implementation rather than after mistakes.
