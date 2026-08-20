# Gaffer Upgrade — Implementation Plan

Source documents: [Upgrade Roadmap Plan.md](Upgrade%20Roadmap%20Plan.md) (product
direction) + [CLAUDE.md](CLAUDE.md) (working guidelines) + [HANDOFF.md](HANDOFF.md)
(current state, read alongside this plan — it's the log of what actually
happened once execution starts).

Executor: Claude Code, solo, no separate QA/design/backend personnel. App is
not live — no users, no downtime risk, no rollback procedure needed. Time
estimates are **agent working-time** (implementation + build/lint/verify
loop per step), not calendar time or human-team story points.

---

## 0. Ground truth: what the roadmap asks for vs. what already exists

Read against the actual code (not just the roadmap prose) before planning
steps, since several roadmap items are already fully or partly built:

| Roadmap area | Status |
|---|---|
| Coach dashboard, teams, team overview, roster, attendance, sessions↔calendar | **Done** (per [HANDOFF.md](HANDOFF.md)) |
| Drill Creator: multi-phase, drag-and-drop, cones/players/balls, annotations | **Done** |
| Drill Library, reusable coach-owned drills | **Done** |
| Drill pitch size options (full/¾/half/quarter) + portrait/landscape | **Missing** — only `11v11` / `small_sided` exist |
| Equipment: witches' hats, mannequins | **Missing** — only cones (with color variants), players, balls |
| Distinguishable ball-movement vs. player-movement arrows | **Missing, and bigger than it sounds** — there is currently **no arrow-drawing UI at all**; `PhaseArrow` data can only exist if seeded directly in the DB |
| Drill animation/playback | Explicitly "later" in the roadmap — **out of scope** |
| Tactic Creator (team-specific, roster-linked, full pitch) | **Missing entirely** — no table, no route, no component |
| Animated tactics | Explicitly "later" — **out of scope** |
| Persistent coach login (vs. magic link) | **Missing** — `Login.tsx` is magic-link-only. Note: session *persistence* across reloads already works today (supabase-js default `persistSession: true`) — what's actually missing is a password-based sign-in/sign-up UI, not the persistence mechanism itself |
| Coach ID → owns teams/players/sessions/drills | **Already the model** — `team.owner_id` = `auth.users.id`, `team_coaches` membership. No schema change needed for this part |
| Mobile-first responsive workflow (esp. post-training attendance) | **Partially done** — `AppShell` already has a mobile drawer, `PitchCanvas` is already responsive — needs an explicit audit, not a rebuild |
| Native iOS/Android app | Explicitly a later stage — **out of scope** |

**In scope for this upgrade:** persistent auth, Drill Creator pitch/equipment/arrow
expansion, new Tactic Creator (static, v1), mobile-first audit.
**Explicitly deferred:** all animation/playback work, native app packaging —
these are staged as later phases in the roadmap's own text, not blockers to
anything below.

A second, unrelated but important note: **[gaffer/CLAUDE.md](CLAUDE.md) was
overwritten on disk** partway through this session (the architecture
reference from `/init` is gone, replaced by a generic guidelines block). That
doesn't block this plan, but flagging it here since it's the kind of thing
worth resolving before a long execution run — see Phase 0.1.

---

## Phase 0 — Baseline & prerequisites

### 0.1 Confirm environment baseline
**Depends on:** nothing. **Blocks:** everything.
**Actions:**
- `npm run build && npm run lint` from `gaffer/` — confirm clean (or note the
  one known pre-existing `preserve-manual-memoization` warning per HANDOFF).
- Supabase MCP `list_tables` against project `zaougjiavbqdlgweidpc` — confirm
  the live schema matches `schema.sql` + migrations `001`–`010` (i.e. no
  drift between what's documented and what's deployed).
- Decide what to do about `gaffer/CLAUDE.md` (restore the architecture doc,
  merge with the new guidelines block, or leave as-is) — **user decision,
  not Claude Code's to make silently**, since the file changed unexpectedly.
**Risk:** schema drift between `schema.sql`/migrations and the live DB would
invalidate every later migration-numbering assumption in this plan.
**Mitigation:** if `list_tables` shows anything not accounted for in
`supabase/migrations/`, stop and reconcile before Phase 2/3 touch schema.
**Success criteria:** clean build+lint; live schema accounted for by
`001`–`010`; CLAUDE.md question answered.
**Estimate:** 15–20 min.

---

## Phase 1 — Persistent authentication (magic link → email/password)

Front-loaded because it's self-contained, unblocks the roadmap's stated
priority ("fast, reliable, practical for repeated mobile use"), and — this
matters for every later phase — **once it ships, Claude Code can create a
real test account and drive the live app end-to-end in the Browser pane**,
which resolves the standing "no agent can verify past login" limitation
noted in HANDOFF.md for every phase after this one.

### 1.1 Confirm Supabase Auth provider config
**Depends on:** 0.1.
**Actions:** via Supabase MCP or dashboard, confirm email/password sign-up is
enabled for the project (on by default, but verify), and check the "Confirm
email" requirement setting.
**Decision to make:** recommend disabling mandatory email confirmation for
this project. Rationale: it's a solo-coach app, the roadmap explicitly
complains about magic-link email friction/rate-limits, and confirmation
would just reintroduce the same "wait for an email" problem for every
sign-up. This also directly enables live agent verification in 1.6.
**Risk:** none technical — this is a product-policy call, flag it to the
user rather than assuming.
**Estimate:** 10 min.

### 1.2 Build password-based Login/Sign-up UI
**Depends on:** 1.1 decision made.
**Files:** `src/components/Login.tsx` (rewrite), no change to `App.tsx`'s
gating logic.
**Actions:**
- Replace the magic-link-only form with a single component that toggles
  between "Sign in" and "Create account" modes.
- Sign in → `supabase.auth.signInWithPassword({ email, password })`.
- Sign up → `supabase.auth.signUp({ email, password })`.
- Keep the existing error-display pattern (`status`/`error` state) — no new
  pattern needed, this file already has the shape to extend.
- Client-side validation: password min length (Supabase default is 6 —
  match it in the UI so errors aren't a surprise).
**Risk:** none structural — this is an isolated component swap.
**Success criteria:** new account creation + sign-in both work in the
Browser pane; error states (wrong password, duplicate email) display
correctly.
**Estimate:** 45–60 min.

### 1.3 Password reset flow (minimum viable)
**Depends on:** 1.2.
**Rationale:** a persistent password with zero recovery path is a real
self-inflicted lockout risk for a solo user — worth the small addition even
though the roadmap doesn't call it out explicitly.
**Actions:** "Forgot password" link → `supabase.auth.resetPasswordForEmail`;
handle the recovery redirect back into the app with a "set new password"
form using `supabase.auth.updateUser({ password })`. Reuses the existing
`emailRedirectTo: window.location.origin` pattern already in the codebase.
**Risk:** recovery-link redirect handling is the fiddliest part of Supabase
auth UIs generally. **Mitigation:** supabase-js's `detectSessionInUrl`
(already relied on by the current magic-link flow, per `useSession.ts`'s own
comment) handles this the same way for recovery links — no new redirect
mechanism needed, just a UI branch on `PASSWORD_RECOVERY` auth event.
**Success criteria:** reset email round-trips to a working new password.
**Estimate:** 30–45 min.

### 1.4 Remove magic-link code path
**Depends on:** 1.2 verified working.
**Rationale:** roadmap direction is a clean move to persistent login, not
maintaining two auth methods — matches the "no speculative flexibility"
guidance in CLAUDE.md.
**Actions:** delete `signInWithOtp` call and the "check your email" magic
link state from `Login.tsx` (already subsumed by rewrite in 1.2 — this is
really just confirming nothing else references it, e.g. grep for
`signInWithOtp`).
**Success criteria:** no remaining magic-link code path.
**Estimate:** 10 min (mostly folded into 1.2).

### 1.5 Migrate the existing coach account
**Depends on:** 1.2, 1.3 shipped.
**This step needs the user, not just Claude Code** — Supabase doesn't allow
setting a password on an existing auth.users row via SQL (passwords are
managed by GoTrue, not a plain column), and this session's Supabase MCP
tools don't expose an admin "set password" call. The only path is: the user
runs the new "forgot password" flow (1.3) once, against their existing
account email, to set an initial password.
**Risk:** if this step is skipped/forgotten, the existing coach account is
locked out of the new login once magic link is removed (1.4).
**Mitigation:** sequence 1.4 (removing magic link) *after* confirming with
the user that 1.5 is done — don't remove the old path until the new one is
confirmed reachable for the real account.
**Estimate:** 5 min of user time, not blocking Claude Code's other work.

### 1.6 Stand up a disposable test account for live verification
**Depends on:** 1.1–1.4.
**Actions:** sign up a throwaway test coach account (e.g.
`gaffer-test+<date>@<domain>`) via the Browser pane, create a minimal team/
roster so later phases have real data to render against.
**Why this matters:** this converts every subsequent phase's verification
story from "build+lint clean, unverified visually" (the standing limitation
in HANDOFF.md) to "actually logged in and screenshotted in the Browser
pane." Flag this explicitly in each later phase's success criteria.
**Estimate:** 15 min.

**Phase 1 total: ~2–2.5 hours agent time + one 5-minute user action (1.5).**

---

## Phase 2 — Drill Creator upgrade

### 2A. Pitch size & orientation

Currently `drill.pitch_format` is a Postgres enum (`'11v11' | 'small_sided'`)
driving both `pitchGeometry.ts` markings and the canvas aspect ratio. The
roadmap wants 4 sizes × 2 orientations — this needs a schema change (this
field is a real column, not the jsonb `phases` blob, so unlike most of
Phase 2/3 this one **does** need a migration).

### 2.1 Schema: replace `pitch_format` with `pitch_size` + `orientation`
**Depends on:** Phase 0.1.
**Actions (migration `011_drill_pitch_size_orientation.sql`, applied via
Supabase MCP `apply_migration` + written to `supabase/migrations/` per the
repo's established convention):**
```sql
create type pitch_size as enum ('full', 'three_quarter', 'half', 'quarter');
create type pitch_orientation as enum ('portrait', 'landscape');

alter table drill add column pitch_size pitch_size;
alter table drill add column orientation pitch_orientation not null default 'landscape';

update drill set pitch_size = case when pitch_format = '11v11' then 'full' else 'quarter' end;

alter table drill alter column pitch_size set not null;
alter table drill drop column pitch_format;
drop type pitch_format; -- unused after this (team.format, the only other user, was dropped in 008)
```
**Prerequisite:** confirm via `list_tables`/`execute_sql` that no other
column still uses the `pitch_format` type before the `drop type` line (team
already doesn't, per migration 008 — this is a re-confirmation, not new
work).
**Risk:** any existing dev drills lose their exact prior aspect ratio
(`small_sided` → `quarter` is an approximation, not a 1:1 mapping).
**Mitigation:** acceptable — this is dev/test data only (app not live), and
`schema.sql` staying un-retroactively-edited (repo convention) means this
migration is the historical record either way.
**Success criteria:** migration applies cleanly; `execute_sql` confirms
existing drill rows backfilled with non-null `pitch_size`.
**Estimate:** 20–30 min.

### 2.2 Types + labels
**Depends on:** 2.1.
**Files:** `src/store/types.ts`.
**Actions:** replace `PitchFormat` with `PitchSize`/`PitchOrientation` types
and `PITCH_SIZE_LABELS`/`PITCH_ORIENTATION_LABELS`; update `Drill` interface
fields (`pitch_size`, `orientation` replacing `pitch_format`).
**Success criteria:** `tsc -b` catches every call site that needs updating
(a good thing here — use the compiler as the todo list for 2.3–2.5).
**Estimate:** 15 min.

### 2.3 Geometry: markings + aspect ratio for 4 sizes × 2 orientations
**Depends on:** 2.2.
**Files:** `src/components/design/pitchGeometry.ts`.
**Actions:**
- Generalize `getPitchMarkings(size)` / `getPitchAspectRatio(size, orientation)`.
- Derive `three_quarter`/`half` proportionally off the existing `full`
  (105×68m) markings — e.g. half = 68×52.5m keeping one full penalty/six-yard
  box at the near end + halfway line at the far edge; three-quarter = 68×78.75m
  with the same box kept. `quarter` reuses the existing small-sided grid
  layout (already built, just renamed).
- Orientation: transpose which meters-axis maps to Stage width vs. height —
  contained entirely in `pitchGeometry.ts` + the `toPx`/`scaleX`/`scaleY`
  logic already in `PitchCanvas.tsx` (no other file needs to know about
  orientation).
**Risk:** four new marking sets is the single most "made up geometry" part
of this plan — these are explicitly *decorative*, not regulation diagrams
(matches the existing code comment's own framing), so get-it-roughly-right
is the actual bar, not exact.
**Success criteria:** all 8 combinations render a plausible, non-distorted
pitch (verify via Browser pane once 2.5's UI exists — this step alone isn't
independently visually checkable).
**Estimate:** 45–60 min.

### 2.4 Canvas + persisted-coordinate risk (inherited, not new)
**Note, not a step:** normalized 0–1 phase-element coordinates are relative
to whatever pitch is currently rendered — changing a drill's size/orientation
after elements are already placed will visually "stretch" them. This isn't
new to this upgrade (it was already true switching between the 2 existing
formats, since `pitch_format` was already editable via `DrillUpdateInput`) —
just carrying the existing design forward, not introducing a regression.

### 2.5 UI: size + orientation pickers
**Depends on:** 2.2, 2.3.
**Files:** `src/components/design/DrillPreview.tsx` (create-drill form),
`src/components/design/DrillLibrary.tsx` (card label + search).
**Actions:** replace the single `formatOptions`/`PITCH_FORMAT_LABELS`
dropdown with two selects; update the library card badge and search-matching
logic (currently matches on format label — extend to match size or
orientation label).
**Success criteria (live, via 1.6's test account):** create one drill per
size, toggle orientation, confirm each renders a distinct, correctly
proportioned pitch; existing pre-migration test drill still loads without
crashing.
**Estimate:** 30–45 min.

**2A subtotal: ~2.5–3 hours.**

### 2B. Equipment: witches' hats, mannequins

### 2.6 Decision: `kind`-tagged marker vs. new sibling arrays
**Recommendation (stated here so a future session doesn't have to
re-derive it):** add an optional `kind?: 'cone' | 'witches_hat' | 'mannequin'`
field to the existing `PhaseCone` interface (default/absent = `'cone'`),
rather than renaming the array or adding new `witchesHats`/`mannequins`
arrays. This is a jsonb field — **no migration needed**, fully backward
compatible with existing persisted drills, and matches the schema comment's
own "more equipment can be added later" framing (one extensible array beats
a new array + new store methods + new canvas-rendering block per future
equipment type).
**Depends on:** nothing (independent of 2A).

### 2.7 Types, theme, canvas, store
**Files:** `src/store/types.ts` (`kind` field), `src/components/design/pitchTheme.ts`
(add `WITCHES_HAT`/`MANNEQUIN` visual constants — recommend distinct vector
shapes via Konva `RegularPolygon`/`Rect` with distinct `sides`/fill, not
image assets, to avoid adding an asset-loading concern and to match the
existing all-vector style), `PitchCanvas.tsx` (extend the `cones.map` block
to branch shape/fill on `kind`), `src/store/slices/drillSlice.ts`
(`addElement`'s `extra` param gains `kind`, passed through unchanged
otherwise).
**Success criteria:** placing/dragging/removing a witches' hat and a
mannequin works identically to cones today, visually distinguishable from
each other and from cones.
**Estimate:** 45–60 min.

### 2.8 UI: equipment picker buttons
**Depends on:** 2.7.
**Files:** `DrillPreview.tsx` — extend `PlacementMode` union
(`'cone' | 'witches-hat' | 'mannequin' | ...`) and the toolbar buttons
alongside the existing cone/player/ball buttons; extend `handleCanvasClick`'s
branch.
**Success criteria (live):** all 3 equipment types placeable/removable in
the Browser pane against the test account's drill.
**Estimate:** 20–30 min.

**2B subtotal: ~1.5–2 hours.**

### 2C. Movement vs. passing arrows — build the drawing tool, then distinguish types

This is the corrected-scope item from the ground-truth table: arrow
*rendering* exists (`PitchCanvas.tsx` already draws `phase.arrows`), but
arrow *creation* does not — there's no placement mode for it in
`DrillPreview.tsx` today.

### 2.9 Arrow data model: add `kind`
**Files:** `src/store/types.ts` — `PhaseArrow` gains `kind?: 'ball' | 'player'`
(default/absent = `'player'`, backward compatible, no migration — same jsonb
reasoning as 2.6).
**Depends on:** nothing (independent of 2A/2B).
**Estimate:** 10 min.

### 2.10 Visual distinction
**Files:** `src/components/design/pitchTheme.ts` — two `ARROW` variants
(e.g. solid red = player movement, dashed blue = ball/pass — color + dash
pattern is sufficient for "visually distinguishable," no need for curved/
bezier arrows). `PitchCanvas.tsx` — branch the existing `Arrow` render on
`a.kind`.
**Estimate:** 20 min.

### 2.11 Arrow-drawing UI (the actual new surface area here)
**Depends on:** 2.9, and reads on the existing "stage-then-commit" pattern
`note` placement already uses (click stages a pending position, a follow-up
action commits it) — extend that pattern to two clicks instead of one:
first click stages the arrow's start point, second click commits the arrow
from start → clicked-position.
**Files:** `DrillPreview.tsx` — extend `PlacementMode` with
`'arrow-ball' | 'arrow-player'`; add `pendingArrowStart` state (mirrors
`pendingNote`); `handleCanvasClick` branches: first click in an arrow mode
sets `pendingArrowStart`, second click calls a new `addArrow` drill-slice
action with `{ from: pendingArrowStart, to: position, kind }` and clears the
pending state. `src/store/slices/drillSlice.ts` — new `addArrow`/
`removeArrow` actions, same local-mutate-then-`updateDrill` pattern every
other phases mutation already follows in this file.
**Risk:** two-click interactions are more error-prone on mobile (accidental
first click, unclear "arrow in progress" state) than the existing
single-click placements.
**Mitigation:** visually indicate the pending start point on the canvas
(small marker or the existing `annotationMode` cursor-style affordance,
extended) so it's never ambiguous the tool has a "half-drawn" arrow — the
same `annotationMode ? { cursor: 'crosshair' } : ...` styling in
`PitchCanvas.tsx` gives a ready-made hook to reuse. `removeMode` already
handles removing existing arrows the same way it removes elements today (no
new remove path needed).
**Success criteria (live):** draw one ball-arrow and one player-arrow in the
Browser pane, confirm visually distinct, confirm both persist across a
reload, confirm remove-mode deletes an arrow.
**Estimate:** 45–75 min (the largest single sub-step in Phase 2, since it's
genuinely new interaction code, not just a data/render extension).

**2C subtotal: ~1.5–2 hours.**

**Phase 2 total: ~5.5–7 hours.**

---

## Phase 3 — Tactic Creator (new feature)

**Depends on:** Phase 2C (reuses its two-click arrow-drawing pattern and
`kind`-tagged arrow rendering directly — building this before 2C would mean
building the arrow tool twice). Does **not** depend on 2A/2B — the roadmap
fixes tactics to a full pitch (no size choice) and doesn't call for
equipment (cones/mannequins), only players + arrows + annotations.

### 3.1 Schema + RLS
**Actions (migration `012_tactic_table.sql`):**
```sql
create table tactic (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references team (id) on delete cascade,
  name       text not null,
  board      jsonb not null default '{"players":[],"arrows":[],"annotations":[]}'::jsonb,
  created_at timestamptz not null default now()
);
create index on tactic (team_id);
alter table tactic enable row level security;
```
RLS policy, following `session`/`player`'s existing "always team-scoped, no
nullable-team-id case" pattern (simpler than `drill`'s policy, which has to
handle the nullable-team-id coach-owned case that doesn't apply here):
```sql
create policy "tactic_all_members" on tactic
  for all using (is_team_member(team_id))
  with check (is_team_member(team_id));
```
**Depends on:** Phase 0.1 (confirms `is_team_member` helper function still
current — it's defined once in `rls_policies.sql` and reused, no redefinition
needed).
**Success criteria:** migration + policy apply cleanly; `execute_sql` insert/
select as the test account (1.6) round-trips correctly, confirms a
*different* team's tactic is not visible.
**Estimate:** 20–30 min.

### 3.2 Types + store slice
**Files:** `src/store/types.ts` (`Tactic`, `TacticPlayer` — the latter
`extends PhasePoint` with `player_id: string` referencing the real roster
`Player.id`, not a freeform team/label like drill's `PhasePlayer`),
`src/store/slices/tacticSlice.ts` (new — mirrors `drillSlice.ts`'s
fetch/create/update + local add/remove/move actions for `players` and
`arrows`/`annotations`; no `cones`/`balls` methods needed), wire into
`src/store/useStore.ts` and `src/store/index.ts` exports.
**Success criteria:** `tsc -b` clean; slice methods unit-reasoned against
the same patterns `drillSlice.ts` already establishes (no new architecture,
just a new domain).
**Estimate:** 45–60 min.

### 3.3 Reuse `PitchCanvas` via an adapter (no canvas changes needed)
**Key design decision, stated explicitly:** rather than modifying
`PitchCanvas.tsx` to understand a second "tactic player" shape, write a
small adapter that maps `TacticPlayer[] + roster Player[] → PhasePlayer[]`
(deriving `number` from `squad_number`, `label` from position or name, and a
constant `team` value so the canvas's existing team-color-by-label logic
still applies unchanged) immediately before handing data to `PitchCanvas`.
Pass `cones: []`, `balls: []` alongside the mapped `players`/`arrows`/
`annotations` — `PitchCanvas` already renders those as empty no-ops.
**Rationale:** minimizes new canvas code (the highest-risk, most
fiddly-to-verify part of this codebase per HANDOFF's own notes on layout
bugs), reuses a component that's already handled drag/click/remove modes
correctly across three prior build phases.
**Depends on:** 3.2.
**Estimate:** 30 min.

### 3.4 Roster panel + player placement
**Files:** new `src/components/tactics/TacticBoard.tsx` (page-level
component, mirrors `DrillPreview.tsx`'s two-column layout: pitch left,
controls right).
**Design decision, stated explicitly:** use the same tap-to-select-a-mode →
tap-the-pitch-to-place pattern already established for cones/balls/players
in `DrillPreview.tsx`, rather than true HTML5 drag-and-drop from the roster
panel onto the Konva `Stage`. Rationale: cross-boundary drag-and-drop onto a
canvas element is a materially harder and more bug-prone browser-interop
problem than reusing a pattern already proven across 3 build phases; the
roadmap's actual goal ("get named players onto the pitch quickly, grouped by
position") is satisfied either way. **This is a deviation from the
roadmap's literal "drag" wording — flag it to the user if they specifically
want native drag-and-drop; true DnD-onto-canvas can be a follow-up polish
item if so.**
**Actions:**
- Roster panel lists not-yet-placed players from the team roster
  (`useStore((s) => s.players)`, already fetched elsewhere), grouped into 4
  display buckets: Goalkeepers / Defenders / Midfielders / Attackers
  (`winger` + `striker` both bucket into "Attackers" for this grouping only
  — no schema change, purely a display-side `PLAYER_POSITIONS` mapping).
- Tap a roster player → tap the pitch → `tacticSlice.addPlayer` places them
  at that position; placed players disappear from the "unplaced" panel list
  (filter by `player_id` already present in `board.players`).
- Reuse remove-mode from `PitchCanvas` to un-place a player back to the
  panel.
**Success criteria (live):** load the test team's roster, place 3+ players
from different position buckets onto the pitch, confirm they render with
correct number/label, confirm removing one returns it to the panel.
**Estimate:** 60–90 min.

### 3.5 Tactical drawing tools + save/reuse
**Depends on:** 2.11 (arrow tool), 3.4.
**Actions:** wire the same `arrow-ball`/`arrow-player`-equivalent placement
modes into `TacticBoard.tsx` (roadmap calls these "runs," "passing
patterns," "pressing movements" — all representable as the same two
arrow-`kind`s already built in 2C; no third arrow type needed for v1 static
tactics). Add a "Save tactic" create/update flow (name field + `createTactic`/
`updateTactic`, same persist-on-mutation pattern as `DrillPreview.tsx`'s
`persistPhases`).
**Success criteria (live):** build one full static tactic (e.g. "4-3-3 —
Build Up": placed players + 2+ movement/pass arrows + one annotation), save
it, reload the page, confirm it loads back identically.
**Estimate:** 45–60 min.

### 3.6 Navigation + routing
**Files:** `src/App.tsx` (new `/tactics` route), `src/layout/AppShell.tsx`
(`TEAM_SCOPED_PATHS` + `NAV_ITEMS_TEAM` gain a "Tactics" entry), new
`src/pages/TacticsPage.tsx` (thin wrapper, same shape as `DesignPage.tsx`).
**Depends on:** 3.4, 3.5 functional.
**Success criteria:** "Tactics" tab appears in both desktop top bar and
mobile drawer, routes correctly, respects `selectedTeamId` scoping like
every other team-level tab.
**Estimate:** 20 min.

**Phase 3 total: ~3.5–5 hours.**

---

## Phase 4 — Mobile-first audit & polish

**Depends on:** Phases 1–3 complete (auditing screens that are about to
change again is wasted effort) and specifically on 1.6 (a live logged-in
test account — this phase is verification-heavy and was previously
impossible to do as an agent at all).

### 4.1 Systematic mobile pass
**Actions:** `resize_window` to the `mobile` preset (375×812) in the Browser
pane, then for each screen: Login/Sign-up (new, from Phase 1), Dashboard,
Calendar, Team Overview, Roster, Sessions, **Attendance** (the roadmap's one
explicitly-named critical mobile workflow — "open app, log in, open session,
complete attendance, save, close, in as few taps as possible"), Design
(drill creator — canvas + right-panel toolbar stacking at narrow width),
Tactics (new, from Phase 3). Screenshot each, check: no horizontal page
scroll, tap targets reasonably sized, hamburger nav reachable, canvas
components stay within viewport per their existing `ResizeObserver`-based
responsiveness.
**Risk:** exactly the kind of pure-CSS-layout bug that build/lint can't
catch — HANDOFF.md's roster-column-misalignment incident is the precedent
(only ever caught via a user screenshot before). Phase 1.6 changes that:
this is now agent-catchable directly.
**Mitigation for any found issues:** fix using the repo's established
pattern — shared `grid-template-columns` constants for any header+row UI
(per HANDOFF's explicit "Watch Out For" note), not `flex`/`flex-1`.
**Success criteria:** every screen above usable at 375px width with no
horizontal scroll and no overlapping/clipped controls; Attendance flow
completable in the Browser pane in a small number of taps (record the
actual count as the artifact of this check).
**Estimate:** 60–90 min (mostly verification + targeted CSS fixes, not new
feature work).

**Phase 4 total: ~1–1.5 hours.**

---

## Phase 5 — Final verification & documentation

### 5.1 Full regression pass
**Depends on:** all prior phases.
**Actions:** `npm run build && npm run lint` clean; re-check every existing
feature (roster, sessions, attendance, calendar) still works via the test
account — confirms nothing in Phases 1–4 regressed pre-existing
functionality, not just that new features work in isolation.
**Estimate:** 20–30 min.

### 5.2 Update HANDOFF.md
**Actions:** log what shipped, what worked/didn't (per the file's existing
format), any deviations made from this plan during execution (e.g. if the
drag-and-drop-vs-tap-to-place call in 3.4 changed), and explicitly note the
new live-verification capability unlocked by Phase 1 so future sessions
don't have to rediscover it.
**Estimate:** 20 min.

### 5.3 Decide fate of the migrated `pitch_format` naming, `CLAUDE.md`
**Actions:** close out the Phase 0.1 CLAUDE.md question if still open;
confirm `Upgrade Roadmap Plan.md` items now shipped are reflected in
whatever the user wants as the next-iteration source of truth (this plan
file itself, or a fresh roadmap revision).
**Estimate:** 10 min.

**Phase 5 total: ~1 hour.**

---

## Summary

| Phase | Depends on | Estimate |
|---|---|---|
| 0. Baseline | — | 15–20 min |
| 1. Persistent auth | 0 | 2–2.5 hrs (+ 5 min user action) |
| 2A. Pitch size/orientation | 0 | 2.5–3 hrs |
| 2B. Equipment | — (parallel to 2A) | 1.5–2 hrs |
| 2C. Arrow types + drawing UI | — (parallel to 2A/2B) | 1.5–2 hrs |
| 3. Tactic Creator | 2C | 3.5–5 hrs |
| 4. Mobile audit | 1, 2, 3 | 1–1.5 hrs |
| 5. Final verification | all | ~1 hr |
| **Total** | | **~13.5–17.5 hrs agent time** |

**Execution order:** 0 → 1 → (2A, 2B, 2C in any order — independent of each
other) → 3 → 4 → 5. 2A/2B/2C can be done in a single continuous pass since
they share files (`DrillPreview.tsx`, `pitchTheme.ts`) — sequencing them
2A→2B→2C as written avoids repeatedly re-touching the same toolbar section.

**Deferred, not in this plan:** drill animation/playback, animated tactical
sequences, native iOS/Android app — all explicitly staged as later work in
the roadmap's own text.

**Open decisions flagged for the user, not assumed:**
1. Phase 0.1 — what to do about the overwritten `CLAUDE.md`.
2. Phase 1.1 — disabling mandatory email confirmation (recommended, but a
   product-policy call).
3. Phase 3.4 — tap-to-place vs. true drag-and-drop for the tactics roster
   panel (recommended: tap-to-place, for lower implementation risk).
