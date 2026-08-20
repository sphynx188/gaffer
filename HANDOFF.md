# Handoff — Gaffer

Solo-built football/soccer coaching PWA. React 19 + Vite + TypeScript (non-strict)
+ Zustand 5 (slices) + Supabase (Postgres/Auth/RLS) + Tailwind v4 (`@theme`
CSS-first tokens, dark-mode-only) + Konva/react-konva + react-router-dom v7.
Repo root: `/Users/max/Desktop/app/gaffer`. Supabase project id: `zaougjiavbqdlgweidpc`
(name "Gaffer 2", region ap-northeast-1) — reachable via the Supabase MCP server
already configured in this environment.

---

## ⏳ UPGRADE IN PROGRESS — read this section first

Executing [UPGRADE_IMPLEMENTATION_PLAN.md](UPGRADE_IMPLEMENTATION_PLAN.md)
(source: [Upgrade Roadmap Plan.md](Upgrade%20Roadmap%20Plan.md)), across
however many sessions it takes. **UPGRADE_IMPLEMENTATION_PLAN.md is the
source of truth for what needs to be built; this section is the source of
truth for what has actually happened.** On resuming: read the plan, read
this section, run `git log --oneline -10` and `git status` in `gaffer/`,
diff against what's below, and continue from the first incomplete step —
don't redo completed work. A phase is only "done" once its plan success
criteria were actually verified, not just implemented.

Test account for live Browser-pane verification (works because Phase 1
shipped password auth + disabled email confirmation on the Supabase
project): `gaffertest2026v2@gmail.com` / `TestPass123!` — one team ("Test
U12 Reds"), 3 roster players (GK #1, DEF #4, ST #9).

### Done

- **Phase 0 (baseline)** — build/lint clean; live schema confirmed to match
  migrations 001–010; `CLAUDE.md` merge decision made (see below).
- **Phase 1 (persistent auth)** — magic link fully removed. New:
  `src/components/Login.tsx` (rewritten — sign-in/sign-up/reset-request
  modes), `src/components/ResetPassword.tsx` (new — handles the
  `PASSWORD_RECOVERY` auth event), `src/hooks/useSession.ts` (+
  `isPasswordRecovery`/`clearPasswordRecovery`), `src/App.tsx` (routes to
  `ResetPassword` when recovery is active). Project's "Confirm email" was
  disabled by the user in the Supabase dashboard (I can't reach that
  setting via any available tool — dashboard/Management-API only) so
  sign-up returns an active session immediately.
  **Verified live**: sign-up → active session; sign-out → sign-in works;
  wrong-password and duplicate-email errors display correctly; session
  survives a hard reload; reset-request submits without error.
  **Not verified live** (honest gap, not a blocker): clicking the actual
  password-reset email link → `ResetPassword` completion screen — I don't
  control the test inbox, so this is code-review-verified only. Worth a
  real click-through from the user at some point; low urgency, isolated
  and simple code.
- **Phase 2A (drill pitch size/orientation)** — migration
  `supabase/migrations/011_drill_pitch_size_orientation.sql` applied
  (`drill.pitch_format` enum → `pitch_size` + `orientation` columns; 0 rows
  existed at migration time, so the backfill was a formality). Updated:
  `src/store/types.ts`, `src/store/index.ts`, `src/store/slices/drillSlice.ts`,
  `src/components/design/pitchGeometry.ts` (4 sizes authored canonically,
  landscape derived by mechanical transpose — not 8 hand-authored sets),
  `src/components/design/PitchCanvas.tsx`, `src/components/design/DrillPreview.tsx`
  (two-select create form), `src/components/design/DrillLibrary.tsx`,
  `src/components/SessionDrillsPanel.tsx`, `src/components/TeamManagement.tsx`
  (stale comment fix).
  **Verified live**: created one drill per size (full/¾/half/quarter) plus
  a landscape variant of full — all 5 render correctly proportioned with
  correct markings; Drill Library search/labels show the new
  `"<size> · <orientation>"` format; build/lint clean; no console errors on
  a fresh tab. The 3 untested landscape combos (¾, half, quarter) share the
  same verified transpose code path as full-landscape, not separate logic.
- **Phase 2B (equipment: witches' hats, mannequins)** — no migration (jsonb
  field, backward compatible: `PhaseCone.kind?: EquipmentKind` absent means
  'cone'). Updated: `src/store/types.ts` (+`EquipmentKind`), `src/store/index.ts`,
  `src/components/design/pitchTheme.ts` (+`WITCHES_HAT`/`MANNEQUIN` visual
  constants), `src/components/design/PitchCanvas.tsx` (branches the
  `cones.map` render on `kind` — witches' hat = larger triangle + white
  stripe, mannequin = body+head silhouette, both grouped so drag/click
  wiring stays shared with the plain-cone case), `src/store/slices/drillSlice.ts`
  (`addElement`'s `extra` gains `kind`), `src/components/design/DrillPreview.tsx`
  (new toolbar buttons + `PlacementMode`/`handleCanvasClick` branches). Note:
  "witches' hat" is the AU/NZ term for a tall training cone (vs. a flat
  marker/disc) — not a Halloween reference.
  **Verified live**: placed a witches' hat and a mannequin on the "Full
  Portrait Test" drill — both render as distinct shapes, both persisted
  across a hard reload, remove-mode successfully deleted the mannequin
  leaving the witches' hat untouched, no console errors, build/lint clean.
- **Phase 2C (arrow types + arrow-drawing UI)** — the bigger of the two
  Phase 2 unknowns confirmed: there really was no arrow-drawing UI before
  this (only pre-seeded/DB-written arrows rendered). No migration
  (`PhaseArrow.kind?: ArrowKind`, jsonb, backward compatible — absent means
  'player', so every pre-existing arrow renders unchanged). Note: found
  (and left alone, per "don't touch unrelated dead code") a pre-existing
  unused `PhaseArrow.style?: string` field — never read/written anywhere,
  predates this work.
  Updated: `src/store/types.ts` (+`ArrowKind`), `src/store/index.ts`,
  `src/components/design/pitchTheme.ts` (`ARROW` restructured into
  `.player`/`.ball` variants — solid red / dashed blue), `src/components/design/PitchCanvas.tsx`
  (arrow render branches on `kind`; arrows now `listening={removeMode}`
  with a wider `hitStrokeWidth` so a thin line is actually clickable to
  remove — previously always `listening={false}`; new `pendingArrowStart`
  prop renders a dashed staging marker so a half-drawn arrow is never
  invisible), `src/store/slices/drillSlice.ts` (new `addArrow`/`removeArrow`
  actions, same local-mutate-then-one-write pattern as everything else
  here), `src/components/design/DrillPreview.tsx` (new `arrow-ball`/
  `arrow-player` placement modes — the one *two-click* mode among all the
  single-click ones: first canvas click stages `pendingArrowStart`, second
  commits via `addArrow`; toggling to a different tool mid-gesture discards
  the pending start rather than leaving it to be consumed later).
  **Bonus fix, found while touching this code**: `PitchCanvas`'s
  below-canvas hint text was hardcoded to "Tap the pitch to place a note"
  and rendered for *every* placement mode, not just `note` — a pre-existing
  bug from Phase 2 (build guide era), not something this session
  introduced, but directly in the code being extended here so fixed now.
  Replaced with a caller-supplied `hintText` prop; `DrillPreview.tsx`
  computes the right copy per mode.
  **Verified live**: drew one player-arrow (solid red) and one ball-arrow
  (dashed blue) on the "Full Portrait Test" drill, confirmed visually
  distinct, confirmed both persisted across a hard reload, confirmed
  remove-mode deleted the player-arrow leaving the ball-arrow untouched,
  confirmed the corrected hint text ("Tap the pitch to place it") shows for
  a non-note mode. Build/lint clean; zero console errors on a fresh tab
  (a set of `hintText is not defined` errors appeared mid-session in an
  old, long-since-superseded tab from live-editing while it stayed open —
  same stale-HMR-churn pattern as Phase 2A's transient errors, confirmed
  false-positive via a fresh tab).

- **Phase 3 (Tactic Creator, new feature)** — the largest single chunk of
  the plan, done in full. Migration `supabase/migrations/012_tactic_table.sql`:
  new `tactic` table (`team_id` **not null** — unlike `drill`, no
  coach-owned/unscoped case), RLS policy in the migration itself (not
  appended to `rls_policies.sql` — that file is the historical Phase 0.3
  record, same as `schema.sql`; policy changes since then all live in
  numbered migrations, e.g. `005`/`006`).
  New: `src/store/slices/tacticSlice.ts` (mirrors `drillSlice.ts`'s
  fetch/create/update + local-mutate-then-one-write pattern; no
  multi-phase concept — v1 tactics are a single static board), wired into
  `useStore.ts`; `teamSlice.ts`'s `clearTeamScopedState` now also clears
  `tactics` on team switch (tactics are always team-scoped like
  sessions/drills). `src/components/tactics/TacticBoard.tsx` (new,
  largest new file) + `src/pages/TacticsPage.tsx`, routed at `/tactics`,
  nav entry added to `AppShell.tsx`'s `TEAM_SCOPED_PATHS`/`NAV_ITEMS_TEAM`.
  Key design points carried over from the plan, both taken as written (not
  re-litigated):
  - **Adapter, not a PitchCanvas rewrite** — `TacticBoard` maps
    `TacticPlayer[] + roster Player[] → PhasePlayer[]` inline before
    handing data to the unmodified `PitchCanvas` (empty `cones`/`balls`
    arrays alongside). Zero changes to `PitchCanvas` itself were needed for
    this.
  - **Tap-to-place roster panel, not drag-and-drop** — tapping a roster
    button stages `pendingPlacePlayerId`, tapping the pitch commits via
    `addTacticPlayer` (reuses the same `annotationMode`/`onCanvasClick`
    plumbing every other placement mode already uses). Roster grouped into
    4 display buckets (Goalkeepers/Defenders/Midfielders/Attackers,
    winger+striker both bucket into Attackers) — display-only, no schema
    change. **If the user wants true drag-and-drop instead, that's a
    follow-up, not a bug** — this was an explicit, flagged plan decision.
  - Arrows reuse Phase 2C's exact two-click pattern (`addTacticArrow`/
    `removeTacticArrow`, same `pendingArrowStart` staging).
  **Verified live** (test account, "4-3-3 - Build Up" tactic on Test U12
  Reds): created a tactic; placed all 3 roster players (GK/DEF/ST, correct
  bucket grouping, correct number/name via the adapter, correctly
  disappear from the "unplaced" list); drew one player-arrow and one
  ball-arrow, visually distinct; **all of the above survived a hard
  reload**; removed one arrow and one placed player (returned to the
  roster panel) — both removals also confirmed to survive a reload.
  Build/lint clean; zero console errors on a fresh tab.
  **Tooling note for future sessions, not a product bug**: clicking
  precisely on a small Konva canvas shape (an arrow's thin line, a
  player's circle) via the Browser pane's `computer` tool's `left_click`
  was unreliable — sometimes took several attempts, occasionally didn't
  register at all even after 5+ tries, despite `removeMode`/`onArrowClick`
  wiring being verified correct via direct Konva inspection
  (`window.Konva.stages[0].find('Arrow')`, checked `listening: true`).
  Clicking *empty* canvas (any placement mode) was always reliable — only
  small-target *removal* clicks were flaky. When `computer` clicks on a
  canvas shape don't seem to register, don't conclude the feature is
  broken — verify via `javascript_tool`: query `window.Konva.stages[0]` for
  the target node's real position, compute page coordinates from
  `stage.container().getBoundingClientRect()`, and dispatch a synthetic
  `pointerdown`/`mousedown`/`pointerup`/`mouseup`/`click` sequence directly
  on `stage.content.querySelector('canvas')` at that position — this
  worked reliably every time it was tried. Also note: `read_network_requests`
  never captured any Supabase REST calls in this session (cross-origin,
  possibly not intercepted by this tool) — use a full page reload +
  re-check the UI/DOM state as the reliable way to confirm a write
  persisted, not network-request inspection.
- Two new (harmless) `set-state-in-effect` oxlint warnings in
  `TacticBoard.tsx` (lines 84, 93) — structurally identical to unflagged
  effects in `DrillPreview.tsx`, so this is oxlint's React-Compiler
  heuristic reacting to something else in the file's overall shape, not a
  real bug. Same "known, safe to ignore" status as the two pre-existing
  `AttendancePage.tsx`/`SessionPlanner.tsx` warnings.

### Not started yet

- Phase 4 (mobile-first audit)
- Phase 5 (final verification + docs)

### Blockers / deviations from the plan

- None currently blocking. One resolved mid-flight: Supabase's email
  confirmation was ON by default (the plan assumed it might be, and
  recommended disabling it) — I can't toggle it myself, so I asked the
  user, who disabled it in the dashboard. Documented here in case a future
  session needs to know why sign-up behaves the way it does.
- `gaffer/CLAUDE.md` was found overwritten mid-session (the `/init`
  architecture doc replaced by a generic guidelines block, pasted with a
  clipped first character — "ehavioral" instead of "Behavioral"). User
  chose to restore-and-merge; done — both sections now live in the file.

### Exact next step

Phase 3 (Tactic Creator) is now fully done — start Phase 4 (mobile-first
audit) per UPGRADE_IMPLEMENTATION_PLAN.md's Phase 4 section. This phase is
mostly verification + targeted CSS fixes, not new feature work — and it's
the first phase where *every* screen being audited (including the two
brand-new ones from Phases 1–3) can actually be checked live, since Phase 1
unlocked real login.

1. `resize_window` to the `mobile` preset (375×812) in the Browser pane.
2. Walk every screen: Login/Sign-up/Forgot-password (new, Phase 1),
   Dashboard, Calendar, Team Overview, Roster, Sessions, **Attendance**
   (the roadmap's one explicitly-named critical mobile workflow — check it
   can be completed in a small number of taps, and record the actual
   count), Design (drill creator — canvas + right-panel toolbar stacking
   at narrow width, now with the wider equipment/arrow toolbar from Phase
   2B/2C), Drill library, Tactics (new, Phase 3 — same canvas+panel layout
   concern as Design).
3. For each: screenshot, check no horizontal page scroll, tap targets
   reasonably sized, hamburger nav reachable and usable.
4. Any issue found: fix using the repo's established pattern — shared
   `grid-template-columns` constants for header+row UI (per this file's own
   prior "Watch Out For" precedent below), not `flex`/`flex-1`.
5. **Tooling note carried over from Phase 3**: if verifying a canvas-based
   interaction (Design/Tactics pages) at mobile width and `computer` clicks
   on small shapes seem unreliable, don't conclude something's broken —
   use the `javascript_tool` + `window.Konva.stages[0]` technique described
   in the Phase 3 entry above before assuming a real bug.

No test account changes needed — reuse `gaffertest2026v2@gmail.com` above,
which already has a team, roster, drills (all 4 sizes), and one tactic to
audit against.

---

## Prior session log (pre-upgrade)

No test suite. At the time of this log, auth was magic-link only, so **no
agent could log into the app to do
a live browser walkthrough** — verification has always been `npm run build` +
`npm run lint` (oxlint) + manual code review, never an authenticated screenshot.

## Goal

Ongoing iterative feature/design work directed by the user (a coach, sole
user of the app) in short back-and-forth turns — no big upfront spec, mostly
"do X" one request at a time, sometimes with a clarifying-question round
first for genuinely ambiguous/large asks.

## Current Progress

All committed and pushed to `origin/main` as of commit `fbb5541`. In order:

1. **`2475c1c`** — Big nav/structure redesign:
   - Two-tier nav in `src/layout/AppShell.tsx`: coach-level tabs
     (Dashboard/Teams/Calendar) vs team-level tabs (Overview/Roster/Sessions/
     Attendance/Design/Drills), swapped based on route (`TEAM_SCOPED_PATHS`),
     rendered as a horizontal top bar on `lg:`+ and a hamburger drawer below
     it — replaced the old permanent sidebar entirely.
   - `src/pages/DashboardPage.tsx` became a coach-level team picker (was
     previously single-team-scoped).
   - New `src/pages/TeamOverviewPage.tsx` (route `/overview`) carries what
     used to be Dashboard's team-scoped content (stat cards, upcoming
     sessions, quick actions).
   - New `src/pages/CalendarPage.tsx` + `src/components/CalendarGrid.tsx`
     (route `/calendar`): cross-team weekly time-grid, cards positioned by
     `start_time`/`duration_minutes`, colored per-team via
     `src/lib/teamColor.ts` (hash-based, static Tailwind class palette),
     overlapping sessions split into side-by-side lanes via
     `src/lib/calendarLayout.ts` (`layoutDayColumn`).
   - `session.start_time` added (migration `007_session_start_time.sql`),
     required in the create/edit forms in `SessionPlanner.tsx`.
   - `team.format` (pitch format) dropped entirely — migration
     `008_drop_team_format.sql` — it never drove anything, `Drill.pitch_format`
     is the field that actually matters for canvas rendering.
   - Shared `src/lib/date.ts` extracted from `SessionPlanner.tsx`'s
     previously-local date helpers.
   - Teams tab (`TeamManagement.tsx`) upgraded from a bare list to summary
     cards (player count / upcoming session count) via new
     `src/hooks/useTeamSummaries.ts`.

2. **`a492abd`** — Roster/Sessions field cleanup + new features (this was a
   4-item user request handled in one pass):
   - `player.dob` dropped (migration `009_drop_player_dob_and_session_extras.sql`,
     same migration also drops `session.physical_load`/`session.equipment`).
   - Removed all UI for those three fields (forms, badges, the load-colored
     border accent on session rows).
   - **Recurring sessions**: `SessionPlanner.tsx` has a "+ Add a recurring
     schedule" toggle → `RecurringScheduleForm` (pick weekdays + date range +
     time + duration) → `sessionSlice.createRecurringSessions` generates one
     ordinary, independent `session` row per matching weekday (not its own
     concept/table — just a loop over the existing `createSession` action).
   - **Attendance rebuilt as a roll-call grid**: `src/pages/AttendancePage.tsx`
     is now a week-of-sessions × roster `<table>`, click a cell to cycle
     unconfirmed → present → injured → away. Per explicit user choice, this
     **repurposes** the existing `availability.status` enum rather than
     adding a new column — migration `010_attendance_roll_call_status.sql`
     renames the enum values (`available`→`present`, `unavailable`→`away`,
     kept `unconfirmed`), so the one status field now serves both as a
     pre-session RSVP (`AvailabilityPanel.tsx`, unchanged UI, relabeled
     options) and the post-session roll-call outcome.

3. **`04dea64`** — Added a per-player weekly "Attended X/Y" tally column to
   the Attendance grid (right-hand sticky column).

4. **`3616981`** — Added a season-long attendance stat
   (`present/total-past-sessions`, as a %) to each Roster row — counted
   against sessions with `date <= today` only, so it doesn't understate a
   player's rate early in the season before most sessions have happened yet.

5. **`37d5942`** + **`4cc5bbc`** — Roster row layout: spread squad#/name/
   position/attendance into columns instead of clustering left with a big
   gap before the Notes/Edit buttons. First pass used `flex` + `flex-1`,
   which **misaligned the header from the rows** (see What Didn't Work)
   — fixed by switching both to a shared CSS Grid template
   (`ROW_GRID` const in `PlayerRoster.tsx`).

6. **`fbb5541`** — Hid the create-player form behind a "+ Add player"
   toggle (mirrors the recurring-schedule toggle pattern from item 2).

## What Worked

- **Migration-drop pattern for unused fields**: when a field turns out to
  drive nothing (verified by grepping every usage first), drop the column
  via a numbered migration + strip all UI, rather than leaving it half-wired.
  Used for `team.format`, `player.dob`, `session.physical_load`/`equipment`.
  User has been fine with this every time — no pushback, explicit "commit
  this" afterward.
- **Repurposing an existing field instead of adding a new one** when the
  user is given the choice (Attendance roll-call reusing
  `availability.status` rather than a new `attendance_status` column) —
  asked via `AskUserQuestion`, user picked "replace," and it turned out
  cleaner than a parallel field would have been.
- **Toggle-behind-a-button for rarely-used forms** (recurring schedule,
  add-player) — small, reusable pattern: `useState<boolean>` + ternary
  between a trigger button and the form-with-Cancel.
- **CSS Grid over Flexbox for header/row column alignment**: a shared
  `grid-template-columns` constant applied to both the header and every
  data row guarantees alignment regardless of how many items are in a given
  row. Flex's `flex-1` growth depends on sibling count in that specific flex
  container, which silently breaks alignment the moment two "same-looking"
  rows have a different number of flex children (header had 4 cells, data
  rows had 5 including actions) — worth remembering for any other
  header+repeated-row UI in this app (e.g. if the Calendar or Attendance
  grids ever grow a similar flex-based header).
- Supabase MCP (`mcp__2bd2f61e-df7f-4945-9166-c0ca89631337__*`) works
  directly against the live project — `apply_migration` + `execute_sql` to
  verify. Always also write the matching file under `supabase/migrations/`
  for the repo's own numbered-migration convention (`schema.sql` itself is
  never retroactively edited — confirmed via `git log` showing it untouched
  since the initial commit; all schema evolution lives in `migrations/`).
- Build/lint after every edit, not just at the end — `npm run build` (tsc +
  vite) then `npm run lint` (oxlint) from `/Users/max/Desktop/app/gaffer`.
  A recurring **pre-existing** oxlint warning
  (`react(preserve-manual-memoization)`) shows up on 2-3 files
  (`SessionPlanner.tsx`, `AttendancePage.tsx`) — confirmed via `git diff`
  that the flagged `useMemo` blocks are unchanged logic, not something any
  session introduced. Safe to ignore/expect it in `npm run lint` output.

## What Didn't Work / Watch Out For

- **`flex flex-1` for aligning a header row against repeated data rows** —
  see "CSS Grid" note above. If a new list+header UI is requested anywhere
  else in this app, reach for a shared `grid-template-columns` constant from
  the start rather than flex.
- **Bash `cd` state is per-turn-ish, not guaranteed persistent** — a couple
  of times mid-session a `cd /Users/max/Desktop/app/gaffer && ...` command
  was needed again after previously `cd`-ing, because a fresh Bash call
  landed back in `/Users/max/Desktop/app` (the outer, non-git directory —
  note `Desktop/app` itself is *not* a git repo, only `Desktop/app/gaffer`
  is). Always `cd` into `gaffer/` explicitly rather than assuming state
  carried over from an earlier command in the same session.
- **Can't verify authenticated UI live** — every "verify in browser" step
  in this session has topped out at "no console errors on the logged-out
  screen." Actual visual/interaction confirmation of anything past login
  has only ever come from the user's own screenshots (e.g. the roster
  column-misalignment bug was only caught because the user pasted a
  screenshot — build/lint alone would never have caught it, since it was a
  pure CSS layout issue with no type or lint error).
- No dead ends on the backend/migration side this session — every migration
  applied cleanly on the first attempt.

## Next Steps

Nothing currently pending — all requested work through `fbb5541` is
committed **and pushed** to `origin/main`. `_to_delete/` remains an
untracked, pre-existing dead-code directory (from before this line of
sessions) that has been deliberately left alone every time — never added to
a commit, never deleted, per no explicit instruction either way from the
user. Leave it as-is unless the user says otherwise.

Open threads / things the user has hinted at but not yet asked for
outright — worth surfacing if they come up naturally, not proactively:
- No live browser verification has ever happened past the login screen in
  this whole line of work — if a future change looks visually risky, it may
  be worth asking the user to log in and screen-share/screenshot rather than
  assuming build+lint-clean means visually correct (see the roster
  misalignment precedent above).
- The Attendance/Calendar/Roster pages all independently fetch
  `sessions`/`players` per-page (no shared cache) — fine at this app's
  scale (solo coach, small rosters), not worth optimizing unless it becomes
  a real complaint.
