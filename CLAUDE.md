# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gaffer — a solo-built football/soccer coaching PWA. A coach manages multiple
teams: roster, session planning/scheduling, attendance, and a Konva-based
drill-design canvas. Single external user (the repo owner, a coach); no
public signup flow beyond Supabase auth.

Stack: React 19 + Vite + TypeScript (non-strict — see `tsconfig.app.json`,
no `strict: true`) + Zustand 5 (slices) + Supabase (Postgres/Auth/RLS) +
Tailwind v4 (CSS-first `@theme` tokens, dark by default with a light theme) + Konva/react-konva
+ react-router-dom v7.

Read [HANDOFF.md](HANDOFF.md) first — it's kept up to date after every work
session with what changed, what worked, what didn't, and what's pending.
Treat it as the primary source of recent-history context; this file covers
the stable architecture instead. See also
[UPGRADE_IMPLEMENTATION_PLAN.md](UPGRADE_IMPLEMENTATION_PLAN.md) for the
in-progress feature roadmap and its phase-by-phase execution plan.

**Before writing or changing any UI, read [design.md](design.md) first.**
It's the design-system reference — color/type tokens, component
conventions (`Card`, `PageHeader`, `NumberBadge`), and the corner-radius/
shadow rules. Skipping it is how stale defaults from an earlier version of
the system (a since-removed football-themed accent/motif, `shadow-sm` on
panels, raw hex colors) have crept back in before — the palette and
conventions have changed more than once, so don't assume you remember
what's current.

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

`src/store/sceneActions.ts` holds the scene reducers both `drillSlice` and
`tacticSlice` call — `addEntity`, `moveKeyframe`, `setPitch` and the rest, as
pure `(document, args) => document` functions over a `SceneDocument`
(`{scene, keyframes, duration_seconds, pitch}`, which `Drill` and `Tactic`
both structurally satisfy). **Nothing in that file knows about Zustand**, and
it should stay that way: the extraction deliberately stops at the reducers,
because the slices' commit/undo/autosave machinery genuinely differs (a
tactic keeps two undo stacks, a drill one). Its one hard convention is that
every reducer returns the *same object reference* when it has nothing to do —
both slices' `commit()` tests `next === current` to skip the undo push and
the write, which is what makes a press-and-release that moved nothing cost
neither an undo slot nor a Supabase call.

Both editors follow the same persistence split: uncommitted mutations
(`dragmove`) touch local state only, and one committed mutation (`dragend`)
pushes an undo snapshot and schedules a debounced (~800 ms) write, so a
continuous drag costs exactly one `PATCH`. `tacticSlice` keeps **two** undo
stacks — one for free-drawn markings, one for everything else — so clearing
drawings can never rewind the animation. They own disjoint halves of
`scene.markings`: a marking bound to a keyframe belongs to the timeline
scope (it dies with its keyframe), a free-drawn one to the drawing scope.

Every tactic action carries a `Tactic` infix (`addTacticEntity`, `undoTactic`,
`tacticSaveState`) because there is one shared store and `drillSlice` already
owns the bare names — a duplicate key would silently shadow it.

`src/components/tactics/formations.ts` holds the 29 built-in formations plus
the slot-assignment algorithm. Its coordinate convention is fixed and every
consumer depends on it: **landscape full pitch, home attacking +x, low `y` =
left touchline**, normalized 0-1. The away side mirrors `x -> 1 - x` only —
mirroring `y` too would rotate the shape rather than reflect it. `PlayerRole`
is deliberately not widened for wide midfielders or wing-backs; those slots
borrow `LW`/`RW` and `LB`/`RB` and are distinguished by their depth.

`assignToFormation` scores every (entity, slot) pair by role affinity first
and distance second, then takes the cheapest available pair repeatedly —
globally, not per entity, so the result doesn't depend on array order. **The
goalkeeper slot is reserved**: an entity with no role fits every *outfield*
slot equally, but must never outbid a known keeper for the one position that
isn't interchangeable. Without that guard an unroled outfielder standing a few
metres closer to goal takes it and the keeper ends up at right-back — which
happened, and is the specific failure Stage 3's definition of done names.

`playerSlice.players` is the SELECTED team's roster and must stay that way —
the roster, attendance and session screens all read it. When another team's
players are needed (the tactics board's away side can be bound to a team the
coach also coaches), use `fetchTeamRoster(teamId)` and read
`rostersByTeam[teamId]`; overwriting `players` to show an opponent would empty
the roster page behind the coach's back. Its errors are kept per team for the
same reason.

`selectedTeamId` (`teamSlice`) is the single source of truth for "current
team" scope, persisted to `localStorage` and reconciled against the
RLS-scoped team list on every `fetchTeams`. Never derive current-team as
`teams[0]` elsewhere. Switching teams clears every other slice's
team-scoped arrays (`clearTeamScopedState` in `teamSlice.ts`) so stale data
from the previous team never flashes on screen while the new team's fetch
is in flight.

### Routing / shell

`src/App.tsx` gates everything on `useSession()` (loading → login → routed
app) — except the two public share routes, `/d/:token` and `/t/:token`, which
sit ABOVE the gate because they have to render for a visitor with no account.
The two print-styled card routes (`drills/:id/card`, `tactics/:id/card`) are
inside the gate but outside `AppShell`: a page whose job is to become a sheet
of paper has no use for a nav rail. Signed-in routes render inside `src/layout/AppShell.tsx`, which swaps
between two tab sets based on the active route (`TEAM_SCOPED_PATHS` in
`AppShell.tsx`):
- Coach-level (cross-team): Dashboard, Teams, Calendar
- Team-level (scoped to `selectedTeamId`): Overview, Roster, Sessions,
  Attendance, Design, Drill library

Rendered on `lg:`+ as an icon rail that rests at `w-16` (icon only,
permanently reserved via `lg:pl-16` on `<main>`) and expands to `w-56`
(icon + label) on hover/focus-within, overlaying content rather than
pushing it further, and below `lg` as a hamburger drawer. Both share one
`NavList`. The rail replaced an earlier top-bar tab strip on 2026-08-22 —
see design.md's Navigation shell section for the full sequence of changes
since (auto-hiding, a since-reverted close handle, then this expand-in-place
shape) and why the current version does now permanently reserve width,
unlike the auto-hiding version in between.

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
`session_drills` (join table ordering drills within a session) / `tactic`
(always team-scoped, unlike drill — no coach-owned case) / `session_tactics`
(the tactic equivalent of `session_drills`, added by migration 020).

**`session_drills` and `session_tactics` share ONE `order_index` sequence.**
They are two tables because they reference two different documents, but the
coach sees one ordered line-up (`SessionItemsPanel`), so the indices are
contiguous ACROSS both: an attach lands at the combined length, a reorder swaps
indices between adjacent rows whatever their type, and a detach renumbers what
is left. The renumber is load-bearing, not tidiness — leave a gap and the next
attach collides with an existing index and the merge order goes ambiguous.
`duplicate_session` copies both line-ups verbatim, preserving the interleave. RLS is
enabled on every table; policies live in `supabase/rls_policies.sql`, built
on two `security definer` helper functions (`is_team_member`,
`is_team_owner`) — every new table's RLS should reuse those rather than
redefining membership checks inline.

The two anon-reachable policies, `drill_shared_read` (018) and
`tactic_shared_read` (023), are the only exceptions and share one shape:
`share_token is not null AND share_token = <the x-share-token request
header>`. **Both conjuncts matter** — on the first alone, `select * from
drill` as anon returns every shared row, so one share link would enumerate
all the others. Any future share surface must copy this shape, and must also
carry 018/023's other half: give the table's members policy `to
authenticated`, so a `for all` policy is never left pointed at `anon`.
023's header records the full set of probes used to verify it.

**Coaches join by INVITE, not by an admin creating their login** (migration
039, auth rework Phase 1). `club_invite` holds a pending seat keyed by a
128-bit token from the same `mintShareToken()` the share links use — the row
exists *before* the account does, which is the entire point: `club_member`'s
PK is `(club_id, user_id)`, so a membership previously could not exist until
the login did, which is why the old `create-coach` edge function had to mint
the account with the service-role key **and pick the coach's password**. Every
admin therefore knew every coach's password and nothing rotated.

Two security-definer RPCs serve `/join/:token` (routed above the auth gate in
`App.tsx`, beside `/d/` and `/t/`): `peek_club_invite` returns only a club
name and role so the screen can render for a visitor with no account, and
`redeem_club_invite` binds whatever identity is signed in *right now* to the
club. `club_invite` therefore needs **no anon RLS policy at all** — tighter
than the 018/023 share shape, because the client never reads the table.
Redemption is idempotent (`on conflict (club_id, user_id) do nothing` plus a
`where redeemed_at is null` update) so a double-tap or a reload mid-join
can't fail a coach out of a club they already joined.

Because the token carries the club binding, **the identity a coach arrives
with is irrelevant** — password, Google, or an Apple Hide-My-Email relay
address all redeem the same invite, and no email ever has to match. That is
what makes third-party sign-in worth adding at all; before it, an invited
coach signing in with a non-matching address became a brand-new user with
zero memberships and got pushed into creating a stray club. `CreateClub` now
offers "use your invite link" alongside creating one, for exactly that case.

A drill's content lives in
`drill.scene` (one cast of `entities` with ids stable for the whole drill,
plus `markings`) and `drill.keyframes` (each a `t` in seconds and a
`states` map of entityId → position), alongside `drill.duration_seconds`
and `drill.pitch` — all jsonb, all in **normalized 0–1 pitch coordinates**
so one drill renders correctly on any pitch shape, and all typed in full
in `src/store/types.ts` (`SceneEntity`, `Keyframe`, `Marking`,
`PitchConfig`). Because that content lives in jsonb, extending it (a new
equipment type, a new marking kind, a new optional per-entity property)
never needs a migration — only real columns (like `drill.pitch_format`) do.

**A tactic is the same model, not a parallel one** (migration 020,
TACTICS_BOARD_REWORK_PLAN.md Stage 1). `tactic.scene` / `keyframes` /
`duration_seconds` / `pitch` are the identical shapes and the identical
types, so `frameAt`, `PitchCanvas`, the timeline and the export path all
work on a tactic unchanged — verified: `getPitchMarkings` on a tactic's
pitch is byte-identical to a full-pitch drill's. `SceneEntity` was EXTENDED
rather than forked for this (`player_id`, `role`, `scale`, `markerStyle`,
`roleTag`, `highlight`, `statusRing`, `statusColor` — all optional, all
jsonb, all unset on drills). A tactic puts `'home'`/`'away'` in the same
`team` field a drill puts `'A'`/`'B'` in; there is deliberately no parallel
`side` field, because the canvas already colours by `team`. What IS
tactics-only: `sides` (two formations), `phases` (named coloured bands over
the keyframe track — organisational only, they never affect interpolation)
and `view`.

`drill.phases` and `drill.pitch_size` — the older shapes — are **gone**,
dropped by migration 014 on 2026-08-26 together with every reference in
`src/`. Why they existed and why they had to go is in
[DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md) §0: a player in
phase 1 and the "same" player in phase 2 were unrelated objects, so nothing
could ever interpolate between two phases.

**Do not re-run `013b_backfill_scene.sql`.** It derives `scene`/`keyframes`
from `phases`, and its own header still says to re-run it whenever a drill is
edited "through the current editor" — that instruction is now inverted and
destructive. The editor has written `scene`/`keyframes` directly since
rework Stage 5 and never touched `phases`, so by the time 014 landed the
phases copy was the *stale* one: a dry run showed it would have cut one drill
from 17 entities to 0, another from 5 keyframes to 1, and reverted six
drills' equipment names to their pre-migration-015 values. The script is
inert now that the column is gone; 014's header records the full diff. The
pre-drop dump of both columns for all 14 drills lives outside the repo at
`../drill_phases_pitch_size_backup_2026-08-26.json`.

`tactic.board` is gone the same way, dropped by migration 021 on 2026-08-26
once the new tactics editor had read all four tactics back with nothing moved
(TACTICS_BOARD_REWORK_PLAN.md Stages 1-7). Its pre-drop dump lives outside the
repo at `../tactic_board_backup_2026-08-26.json`, and **020b's backfill must
not be re-run** — it derives `scene` FROM `board`, so it is inert now, and it
was already pointing the stale direction before that.

Of the names those two dropped columns left behind, **`PhasePoint` is the only
survivor** — the normalized 0-1 coordinate the whole canvas is authored in
(`Marking.points`, `EntityState.path`). `PhaseArrow`, `PhaseAnnotation`,
`TacticPlayer`, `TacticBoard` and `ArrowKind` are all gone with 021. Ball-vs-
player movement is `Marking.kind` now, which is why `ArrowKind` had nothing
left to type.

### Design canvas (Konva)

`src/components/design/` holds the drill-design canvas: `PitchCanvas.tsx`
(react-konva stage/rendering), `pitchGeometry.ts` (pitch-format-aware
coordinate math), `pitchTheme.ts` (the one place canvas colors live — mirror
of `index.css`'s UI-chrome tokens, kept deliberately separate since canvas
elements are drawn, not styled with Tailwind classes), `DrillPreview.tsx`,
`DrillLibrary.tsx`. `PitchCanvas` only ever renders positions/shapes handed
to it and reports interactions back via callbacks — it never talks to
Supabase itself; persistence is always the caller's job (see
`DrillPreview.tsx`'s `persistPhases`). This separation is why the tactics
board reuses `PitchCanvas` as-is rather than forking it.

Both editors share `EditorLayout` (`design/editor/EditorShell.tsx`) — three
columns, docked timeline, mobile sheets and floating dock — plus `Sheet`,
`ExportDrawer`, `DockButton` and the top bar's small pieces. They do **not**
share a top bar, deliberately: the plan's own rule is that a shell forced over
two different toolbars is worse than two toolbars, and a drill's carries
export/3D/tour while a tactic's carries Single/Dual, orientation and Add Ball.
The tactics bar scrolls sideways rather than wrapping, because a two-row bar
breaks the fixed 260px chrome reserve the canvas sizes against.

`design/export/*` serves both too. `ExportPanel` takes an `ExportTarget`
(`{kind, name, shareToken, sharePath, cardPath, onEnable/DisableSharing}`)
rather than a `Drill`, so PNG/GIF/card/share-link is one panel, not two —
and the share half is the half where a near-duplicate would drift into a
security bug. PNG and GIF are driven from each EDITOR, not from the panel,
because the Konva stage is only reachable there. `store/shareToken.ts` holds
the one 128-bit CSPRNG token minter both slices call.

**MP4 is not built**, for drills or tactics. `recordGif.ts` records why: the
drill rework built the GIF half only, as the half that works everywhere, and
Stage 8's definition of done asks for "a still, an animation and a one-page
PDF" — which PNG/GIF/card satisfy.

`design/editor/onboarding/` is shared too. `OnboardingTour.tsx` is purely
presentational — handed one `TourStep` at a time, it knows nothing about either
editor — and `useOnboardingTour(steps, seenKey)` takes the step list and the
localStorage key, so the two editors differ only in content: `tourSteps.ts`
(drill) and `components/tactics/tacticTourSteps.ts` (tactic), with one seen-key
each so finishing one doesn't silently skip the other. A step's
`openTools`/`openProperties` name the SIDE, not the contents — left sheet and
right sheet — which is what lets both editors reuse them (drill: tool rail /
properties; tactic: squad / inspector). Any anchor must be `data-onboarding-
anchor`, and the overlay scrolls it into view before measuring, which is what
makes the tactics top bar's sideways scroll survivable on a phone.

**3D is still not built, for either editor, and that is a decision rather than
an omission** — made in the drill rework's Stage 11 and re-affirmed in
TACTICS_BOARD_REWORK_PLAN.md Stage 10.2 once Stages 0–9 shipped. It stays cheap
to defer because `scene`/`keyframes` is renderer-agnostic and both editors feed
it, so 3D is a pure addition that would serve both at once; the fields its 2D
surface would need (body shape, facing, keeper dive) are already carried on
`SceneEntity`/`EntityState`. Both top bars keep a disabled 3D button saying so.

`design/timeline/` is shared by both editors via `TimelineHost` — the document
fields the timeline reads plus its actions, pre-bound to the document, supplied
by `useDrillTimelineHost` / `useTacticTimelineHost`. **Nothing in `timeline/`
imports either domain**; keep it that way. Phases and keyframe copy/paste are
optional on the interface and tactics-only, and the timeline hides the controls
that need them rather than rendering something inert.

Seconds are the stored time unit and stay that way. `Keyframe.t` is float
seconds and is load-bearing in `interpolate.ts`, `speeds.ts` and migration 013b.
Frames (30 fps, `timeline/frames.ts`) are a DISPLAY unit that surfaces in the
Add Phase dialog and nowhere else.

**Keyframe timing is a FIXED GRID and is not editable** (2026-09-01, both
editors). Keyframe N sits at exactly N × `KEYFRAME_GAP_SECONDS` (1.5s), there
are at most `MAX_KEYFRAMES` (10), and `duration_seconds` is DERIVED from the
count — both constants and the `regrid` reducer that enforces them live in
`store/sceneActions.ts`, and every structural change (add, delete, clear,
paste, reorder) funnels through `regrid` so the times and the duration can
never disagree. A coach never sees or sets seconds: the ruler is numbered by
keyframe, the segment bars carry m/s only, and the timeline reports "n / 10
keyframes" where a Duration input used to sit. The only ordering control is
`reorderKeyframe` (move a keyframe one slot earlier/later).

This replaced four controls that could each retime a document independently —
a duration input, drag-to-retime, "Balance timing", and a Speed up/Slow down
pair that scaled every keyframe's `t`. They could and did disagree: because
`duration_seconds` was an `integer` and the scale step was ±10%, every
duration ≤ 5s was a fixed point of `Math.round`, so the duration silently
froze while the keyframes kept compressing — and enough presses collapsed two
keyframes onto the same `t`, which `addKeyframe` had always refused to allow.
Migration 037 widened the column to `numeric(4,1)` because half the grid's
spans are half-seconds (4 keyframes = 4.5s). **Speed up / Slow down still
exist but are PLAYBACK speed only** (`useTimelinePlayback.stepSpeed`); they
never touch stored data.

A tactic phase is a named, coloured band over the keyframe track and is purely
organisational — it never affects interpolation, which is why `frameAt` has
never heard of one. Not to be confused with the drill `phases[]` model
migration 014 dropped, which really was geometry.

`PitchCanvas` documents a seven-layer Konva ceiling and now uses all seven.
Player paths and ghost trails deliberately share ONE `MotionLayer`, carrying
opacity per shape rather than per layer. Anything new that needs to draw should
join an existing layer rather than add an eighth.

`Marking.kind` covers 13 drawable kinds, all storing geometry in the same
`points` array — which is what lets selection, the Konva Transformer and
deletion work on every kind without knowing which is which. Two of them,
`spotlight` and `highlight`, are emphasis rather than diagram and composite
ABOVE the entities (at the end of EntityLayer, not in a layer of their own);
`isOverlayMarking` is the one place that split is decided. Each is drawn twice
— an unlistening fill and a stroked rim carrying the handlers — so a
translucent shape can't swallow clicks on the player underneath it.

Tool shortcuts live on the tools themselves in `markingTools.tsx` and are
applied by `useMarkingKeys`, so a key and its tool can't drift apart. They
don't collide with the timeline's keys: `useTimelineKeys` returns early on
Ctrl/Cmd and `useMarkingKeys` ignores any modified press, which is what keeps
plain `C` and `V` free for Circle and Curve.

`canvas/transposeScene.ts` is shared by both editors and must stay that way.
Flipping a pitch between portrait and landscape has to move the CONTENT as
well as the markings: `getPitchMarkings` renders landscape as the portrait
authoring put through `transpose()`, so patching `pitch.orientation` alone
moves the goalmouth and penalty box while leaving every player where they
were. It is the diagonal mirror `(x,y) -> (y,x)`, never a 90° rotation, so
that it matches what `pitchGeometry` does to the markings. Entry point is
`drillSlice.setDrillPitch`, which applies it whenever orientation changes —
that is the one funnel both `PitchPanel` call sites go through, and routing
it through `commit` keeps a flip to a single undo step.

### Styling

See **[design.md](design.md)** for the full design system — color/type
tokens and component conventions. Briefly:
`src/index.css` defines the entire color system as Tailwind v4 `@theme`
CSS custom properties (`--color-surface`, `--color-panel`, `--color-ink`,
`--color-accent`, etc.). Dark is the default and the one the app is designed
against, but a LIGHT theme also ships: `:root[data-theme='light']` redefines
every token and the app shell has a working toggle. This file used to say
"dark-mode-only, no light theme", which was wrong and quietly told
contributors not to check the theme that in fact had the worst contrast in the
app (2.47:1, fixed 2026-08-30). Any token change has to clear WCAG AA in BOTH
blocks — there are three: the `@theme` default, `[data-theme='light']`, and
the `[data-theme='dark']` block that mirrors the default.

Two tokens carry contrast traps worth knowing about. `--color-ink-faint` is
the lowest-contrast text in the system and sits right at the AA line, so it is
for genuinely tertiary text only. And `--color-accent` is a BACKGROUND colour
that also has white text on it, so it cannot be lightened; accent-coloured
TEXT uses `--color-accent-ink` instead, which exists precisely because no
single value clears 4.5:1 in both roles. Always reach for
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

One storage bucket, `drill-thumbnails` (migration 017), holds BOTH drill and
tactic thumbnails at `<document id>.png` — migration 024 widened its RLS to
admit tactic ids. The name is a misnomer kept deliberately: renaming would
break every `thumbnail_url` already stored. Its policies must keep migration
019's `... in (select d.id::text from ...)` shape rather than a correlated
`exists (... where id::text = split_part(name, ...))` — both `drill` and
`tactic` have their own `name` column, which silently shadows the storage
object's `name` inside a correlated subquery. That bug has been written once
already; 019 and 024 both spell out why.

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
