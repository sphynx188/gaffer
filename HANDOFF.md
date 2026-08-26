# Handoff — Gaffer

Solo-built football/soccer coaching PWA. React 19 + Vite + TypeScript (non-strict)
+ Zustand 5 (slices) + Supabase (Postgres/Auth/RLS) + Tailwind v4 (`@theme`
CSS-first tokens, dark-mode-only) + Konva/react-konva + react-router-dom v7.
Repo root: `/Users/max/Desktop/app/gaffer`. Supabase project id: `zaougjiavbqdlgweidpc`
(name "Gaffer 2", region ap-northeast-1) — reachable via the Supabase MCP server
already configured in this environment.

---

## ✅ UPGRADE COMPLETE

[UPGRADE_IMPLEMENTATION_PLAN.md](UPGRADE_IMPLEMENTATION_PLAN.md) (source:
[Upgrade Roadmap Plan.md](Upgrade%20Roadmap%20Plan.md)) is fully executed —
all 5 phases done, each verified live against a real test account (not
just build/lint), each committed as its own checkpoint. Kept both plan
docs in the repo as the historical record of what was built and why; no
open items from the plan remain. The detailed per-phase log below is kept
as-is (not summarized away) since it's the record of *why* things were
built the way they were, which the plan document alone doesn't capture —
useful context for any future work that touches this code, not just for
resuming an in-progress upgrade.

**Shipped, in order**: persistent email/password auth (replacing magic
link) → Drill Creator pitch size/orientation (4 sizes × 2 orientations,
replacing the old fixed 2-format system) → two new equipment types
(witches' hat, mannequin) → distinguishable ball/player movement arrows
(including building the arrow-drawing UI from scratch, which didn't
previously exist) → a brand-new Tactic Creator feature (team-specific,
roster-linked, static tactical boards) → a mobile-first audit that found
the existing responsive patterns already held up with zero code changes
needed.

**Explicitly deferred** (per the plan's own scope boundary, not an
oversight): drill/tactic animation-and-playback, and a native iOS/Android
app. Both were staged as later-phase work in the roadmap's own text.

Test account for live Browser-pane verification (works because Phase 1
shipped password auth + disabled email confirmation on the Supabase
project): `gaffertest2026v2@gmail.com` / `TestPass123!` — one team ("Test
U12 Reds"), 3 roster players (GK #1, DEF #4, ST #9), 5 test drills (one
per pitch size + a landscape variant), 1 test tactic, 1 test session with
seeded availability. Left in place as scratch/reference data — ask the
user before deleting any of it, same as `_to_delete/` is never touched
without being asked.

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

- **Phase 4 (mobile-first audit)** — done, **no code changes needed**. Every
  screen was clean at 375×812 (`resize_window` mobile preset): Dashboard,
  the hamburger drawer, Roster (card layout, not the desktop grid table —
  no misalignment risk there), Sessions, Overview, Drill Library,
  Login/Sign-up/Forgot-password (well-centered), and — the two highest-risk
  screens given Phase 2/3's new wider toolbars — **Design** and **Tactics**:
  the expanded 10-button equipment/arrow toolbar wraps cleanly into a
  3-column grid, and the Konva canvas stays responsive via its existing
  `ResizeObserver` (`useMeasuredWidth` in `PitchCanvas.tsx`, unchanged).
  **Attendance** (the roadmap's named critical mobile workflow) was tested
  functionally, not just visually: seeded one test session + availability
  rows directly via SQL (`execute_sql`) since creating one through the
  mobile UI hit the same animated-toggle timeout described below, tapped a
  cell, confirmed it cycled Unconfirmed → Present → Injured correctly and
  the "Attended" tally updated live. From an already-logged-in,
  already-team-selected state, marking one player present is 2 taps
  (Attendance tab, then the cell) — well inside "as few taps as possible."
  One non-bug worth knowing about: **Calendar**'s 7-day week grid only
  shows ~3 days at 375px width, the rest reachable by swiping — confirmed
  via `el.scrollWidth`/`scrollLeft` that this is a properly-scoped
  `overflow-x-auto` container (the *page* itself never scrolls
  horizontally, `document.body.scrollWidth === 375`), so it's the correct
  pattern, just with no visual hint that more days exist off-screen. Purely
  a discoverability nicety, not something this phase's scope ("no
  horizontal *page* scroll") requires fixing — flagged here in case a
  future session wants to add a peek/affordance.
  **Important tooling finding for future sessions** (broader than just this
  phase — also hit repeatedly in Phase 3): the Browser pane's `computer`
  tool's `left_click` reliably **times out after 30s ("pane hidden")** on
  any interaction that triggers a CSS transition (the mobile nav drawer's
  slide-in) or an async write (attendance cell tap, any Supabase-backed
  toggle) — **even though the interaction itself completes successfully**.
  Don't read a timeout as "broken." Verify via DOM/state inspection instead
  (`read_page`, `get_page_text`, or `javascript_tool` reading the relevant
  class/state) before concluding something doesn't work, and prefer
  `javascript_tool`'s `element.click()` (or the Konva synthetic-event
  technique from the Phase 3 entry above, for canvas shapes specifically)
  to drive the interaction reliably when a `computer` click keeps timing
  out.
  Leftover test data on the "Test U12 Reds" team from this phase: one
  session (today's date, 17:30) with availability rows seeded for all 3
  roster players, Alex Keeper currently marked "Injured" — harmless scratch
  data, consistent with everything else already on that test team.

- **Phase 5 (final verification + docs)** — done. `npm run build`/`npm run lint`
  clean (0 errors; the 4 known warnings — 2 pre-existing, 2 new-but-harmless
  from Phase 3 — present exactly as documented above, nothing new). Full
  regression smoke test: navigated every core page (Dashboard, Overview,
  Roster, Sessions, Attendance, Design, Drills, Tactics, Calendar, Teams)
  fresh, zero console errors. This HANDOFF.md section folded into the
  closing summary above. `UPGRADE_IMPLEMENTATION_PLAN.md` and
  `Upgrade Roadmap Plan.md` kept in the repo as the historical record.
  Test data on "Test U12 Reds" left in place (see closing summary above) —
  a judgment call, not something the user was blocked on; easy to clean up
  later if they'd rather.

### Blockers / deviations from the plan (historical — none outstanding)

- Supabase's email confirmation was ON by default (Phase 1) — resolved by
  asking the user to disable it in the dashboard, since no available tool
  could do it directly.
- `gaffer/CLAUDE.md` was found overwritten mid-session (Phase 0) — resolved
  by restoring the `/init` architecture doc and merging it with the
  generic guidelines block that had replaced it.

Neither blocked completion — both resolved within the session they came up
in.

---

## Session log — Tactics board rework, Stage 2: tacticSlice on entities and keyframes

Stage 2 of [TACTICS_BOARD_REWORK_PLAN.md](TACTICS_BOARD_REWORK_PLAN.md). The
store can now build, animate, undo and autosave a tactic. No UI calls any of it
yet — that's Stages 5-7 — so the shipped tactics screen is unchanged.

### What happened, in order

1. **Wrote `src/store/sceneActions.ts` first**, as the plan's execution note
   insists: pure `(document, args) => document` reducers over a
   `SceneDocument`, no Zustand anywhere. `Drill` and `Tactic` both structurally
   satisfy the interface, so one set of reducers serves both with no adapter.
2. **Rewired `drillSlice` onto them** — 985 lines down to 794, with zero
   behaviour change (build clean, same lint output, drill editor verified).
3. **Rewrote `tacticSlice`** around entities/keyframes/markings/phases/sides,
   mirroring drillSlice's commit → undo-snapshot → debounced-flush machinery,
   plus `copyTacticKeyframe`/`pasteTacticKeyframe` and `setTacticOrientation`.
4. **Two undo stacks**, and then a correction — see below.
5. **Corrected 020b's and 021's re-run gate** (see What Didn't Work).

### What Worked

- **Extracting the reducers before touching either slice.** Doing it in that
  order meant drillSlice's rewire was a pure mechanical substitution that the
  existing drill editor immediately re-verified, so tacticSlice was built on
  code already proven in production rather than on a fresh copy.
- **Driving the Verify step through the store directly.** The tactics editor
  doesn't exist yet, so there is no UI to click. Importing
  `/src/store/index.ts` through the Vite dev server's module graph gives the
  live store instance, and instrumenting `window.fetch` counts PATCHes exactly.
  60 dragmoves + 1 dragend = **1 write**; `saveState` stayed `saved` for the
  whole drag; a press-and-release that moved nothing cost **0** writes.
- **Stopping the extraction at the reducers.** The commit/undo/autosave layer
  genuinely differs between the two slices, so hoisting it too would have
  produced exactly the unreadable generic "document slice" the plan warns
  against.

### What Didn't Work / Watch Out For

- **The first two-stack design was wrong, and testing caught it.** Timeline
  snapshots held the whole scene, so a timeline undo silently wiped arrows the
  coach had drawn afterwards. The plan only states the other direction
  ("clearing drawings must not rewind the animation"), which passed — but
  drawings vanishing looks like data loss. Fixed by making the two stacks own
  **disjoint** halves of `scene.markings`: keyframe-bound markings belong to
  the timeline scope (they die with their keyframe), free-drawn ones to the
  drawing scope. `clearDrawnMarkings` now spares bound markings for the same
  reason. Both directions verified.
- **Action names could not match drillSlice's**, as 2.1 asks. One shared store
  (CLAUDE.md) means `addEntity`/`undo`/`saveState` are taken; a duplicate key
  would silently shadow drillSlice. Everything carries a `Tactic` infix, which
  is what this slice already did (`addTacticPlayer`).
- **`view` is deliberately not undoable.** Plan 2.3's snapshot list omits it,
  and single/dual is a way of looking at a tactic rather than part of it. It
  still autosaves, via `commitUntracked`.
- **020b/021's re-run gate was wrong and is now corrected.** I had written that
  020b stops being re-runnable "once Stage 2 rewrites tacticSlice". It doesn't:
  Stage 2 adds store actions that nothing calls, and TacticBoard.tsx still
  reads and writes `board`, so `board` stays authoritative. The real cutoff is
  **Stage 7**, and 020b should be re-run one last time immediately before that
  switch. This is the same class of stale instruction that made 013b dangerous.
- **A test fixture is left on the "4-2-2" tactic** (1 entity, 2 markings, 2
  keyframes, 1 phase, landscape, dual view) in the new columns. Its `board` is
  untouched and empty, so the live screen renders it exactly as before and the
  residue is invisible in the app; the legitimate 020b re-run before Stage 7
  clears it. Cleanup was attempted and blocked by the permission classifier.

## Next Steps

1. **Stage 3 — formations.** The 29-formation table plus `setTacticSide`
   already exists to receive it.
2. Nothing calls the new tactic actions yet. The first consumer is Stage 5's
   editor shell; until then `tacticSaveState` stays `saved` in normal use.

---

## Session log — Tactics board rework, Stage 1: tactic scene, keyframes, sides

Stage 1 of [TACTICS_BOARD_REWORK_PLAN.md](TACTICS_BOARD_REWORK_PLAN.md).
Tactics are now on the same entities+keyframes model drills are, so the whole
shipped drill engine — `frameAt`, `PitchCanvas`, the timeline, export — works
on a tactic unchanged. Mostly adoption, not invention.

### What happened, in order

1. **Extended the SHARED `SceneEntity`** rather than forking a tactic entity:
   `player_id`, `role`, `scale`, `markerStyle`, `roleTag`, `highlight`,
   `statusRing`, `statusColor`, plus the `PlayerRole` / `MarkerStyle` /
   `StatusRing` vocabularies. All optional, all jsonb, all unset on drills —
   no migration needed for any of them. `'home'`/`'away'` go in the existing
   `team` field; no parallel `side` field, because the canvas already colours
   by `team`.
2. **New types** `TacticPhase`, `TacticSide`, `SessionTactic`; `Tactic` grew
   `scene`/`keyframes`/`phases`/`duration_seconds`/`pitch`/`sides`/`view` plus
   the four light-metadata fields, keeping `board` marked deprecated.
3. **Migration 020** (additive): the columns above, a partial unique index on
   `share_token` matching 018's, and `session_tactics` mirroring
   `session_drills` column for column, its RLS reusing `is_team_member`
   through the session join.
4. **Dry-ran 020b read-only before applying it** — the habit Stage 0 forced.
   It matched `board` exactly on all 4 rows, so it was applied.
5. **Fixed the orientation/coordinate bug (1.6)** in `canvas/transposeScene.ts`,
   wired into `drillSlice.setDrillPitch`.

### What Worked

- **`setDrillPitch` was the right seam for the transpose.** `PitchPanel` only
  receives `{pitch, onChange}` and can't see the scene, so the fix could not
  live there. `setDrillPitch` has the whole drill, is the one funnel both
  panel call sites (ToolRail, DrillDetailsDrawer) go through, and routing
  through `commit` makes a flip a single undo step rather than leaving the
  content one step behind the pitch.
- **Transposing angles too, not just positions.** The plan's 1.6 lists three
  positional fields; `EntityState.facing` and `SceneEntity.rotation` are the
  same defect on the same content. Fixing where a player stands but not which
  way they face leaves a flip half-applied, which is harder to spot than not
  applied at all. `(90 - a) mod 360` is the angular form of the same mirror.
- **Verified live, not just by build.** Flipped "Test drill passing" to
  landscape in the real editor: goalmouth, players, cones and arrows all moved
  together; one Undo restored it; the DB came back byte-identical to the
  pre-flip coordinates.

### What Didn't Work / Watch Out For

- **The four existing tactics are backfilled PORTRAIT, not the column's
  landscape default.** Their coordinates were authored against
  TacticBoard.tsx's hardcoded portrait `TACTIC_PITCH` (now removed — the board
  reads `tactic.pitch`). Writing landscape would have transposed the markings
  and left the players put, i.e. the exact bug 1.6 documents, and would have
  broken this stage's own DoD. Landscape remains the default for NEW tactics,
  and any of the four can now be flipped correctly in one click.
- **020b has 013b's trap armed.** It derives scene FROM board and is
  re-runnable only while `board` is authoritative — i.e. only until Stage 2
  rewrites tacticSlice. From the first save through the new editor, `board` is
  stale. Both 020b's and 021's headers say so explicitly.
- **No anon read policy for `tactic.share_token` yet**, deliberately. 018
  pairs drill's token with a header-scoped anon policy; the tactic equivalent
  belongs with the sharing UI that mints the tokens (Stage 8.3). Adding it now
  would open a public surface nothing can use.
- Both migrations needed explicit user approval — the permission classifier
  blocks schema changes, additive ones included.

## Next Steps

1. **Stage 2 — `tacticSlice` on entities and keyframes.** Port drillSlice's
   committed-mutation model, undo stack and debounced autosave. Note that the
   moment this ships, `board` goes stale and 020b must never run again.
2. **Stage 7** is what unblocks migration 021 (drop `board`): all 4 tactics
   opened in the new editor with nothing moved.

---

## Session log — Tactics board rework, Stage 0: land migration 014, retire the phases bridge

Stage 0 of [TACTICS_BOARD_REWORK_PLAN.md](TACTICS_BOARD_REWORK_PLAN.md) — the
drill rework's last loose end, done first so Stage 1's tactics migration isn't
written against a schema about to move. `drill.phases` and `drill.pitch_size`
are now gone from the database and from `src/`.

### What happened, in order

1. **Dry-ran `013b_backfill_scene.sql` read-only before touching anything** —
   the plan's step 1 said to re-run it. It would have been destructive. 013b
   derives `scene`/`keyframes` FROM `phases`, and since Stage 5 the editor
   writes `scene`/`keyframes` directly and never touches `phases`, so `phases`
   was the stale copy, not the authoritative one. Re-running it would have cut
   "Test drill passing" from 17 entities / 4 keyframes to 0 / 1, "ma" from
   9 / 5 / `indoor_cage` to 5 / 1 / `full`, "rondo" from 9 / 5 to 0 / 1, and
   reverted six drills' equipment names from the post-015 `pole`/`marker` back
   to `cone` — undoing migration 015. No drill would have gained anything
   (`backfilled_entities <= current_entities` on all 14 rows). **Skipped it**,
   and recorded why in 014's header, in 013b's own header (now marked
   SUPERSEDED AND INERT), and in CLAUDE.md.
2. **Pre-drop audit** — no policy, index, constraint, view or function
   references either column; the `pitch_size` type had exactly one dependent.
3. **Backed both columns up** for all 14 drills to
   `../drill_phases_pitch_size_backup_2026-08-26.json` (outside the git repo).
4. **Applied 014** (needed explicit user approval — the permission classifier
   blocks column drops) and confirmed `information_schema` shows neither
   column and `pg_type` no longer has `pitch_size`.
5. **Stripped `src/`** — deleted `canvas/phaseFrame.ts` (no callers left);
   removed `DrillPhase`/`PhasePlayer`/`PhaseCone`/`PhaseBall`/`EquipmentKind`/
   `PitchSize`/`PITCH_SIZE_LABELS`/`Drill.phases`/`Drill.pitch_size` from
   `types.ts` and their re-exports from `store/index.ts`; removed the ten
   deprecated `phases[]` actions plus `derivePitch`/`PRESET_LENGTH_METERS`/
   `makeBlankPhase`/`movePhaseElement` from `drillSlice.ts` (−311 lines).
6. **`CreateDrillForm` now builds a `PitchConfig`** from `pitchPresets.ts`
   instead of writing `pitch_size`. Same four options, resolved through
   `findPreset`/`presetLabel` (the legacy ids still resolve), so a drill
   created today and one backfilled by 013b still describe the same pitch.

### What Worked

- **Dry-running the migration's own SQL as a SELECT diff.** The plan's
  instruction was written when `phases` was still authoritative and had gone
  stale; running it read-only first is what caught that. A Supabase *branch*
  would not have caught it — branches get a fresh DB with no production data,
  so there is nothing to diff.
- **Keeping `PhasePoint`/`ArrowKind`/`PhaseArrow`/`PhaseAnnotation`.** The
  names say "phases" but they are load-bearing: `PhasePoint` is the normalized
  0-1 coordinate the whole canvas is authored in (`Marking.points`,
  `EntityState.path`), and the other three are what `TacticBoard` still
  stores. Deleting on the strength of the name would have broken tactics.
- Verified the four legacy pitch options produce byte-identical dimensions to
  the old `derivePitch` (`preset` id and metres both match).

### What Didn't Work / Watch Out For

- **`013b` must never be run again.** Its own header still contains the
  now-inverted "re-run it if a drill was edited" instruction; a SUPERSEDED
  banner was added above it, but read the banner, not the body.
- **Only 5 of the 14 drills were opened in the editor.** The signed-in coach
  belongs to two teams; the other 9 drills belong to "Test U12 Reds", owned by
  the disposable test account. Signing in as it would mean typing its password,
  which I don't do. The 5 that were opened include all four the skipped 013b
  re-run would have damaged, and all 14 passed a structural check plus a
  `frameAt`-resolvability check on their stored shape. The other 9 are the
  original seed drills, unchanged since the backfill.
- `supabase/sanity_check.sql` still inserts `phases` and `pitch_format` (the
  latter dropped back in 011), so it was already stale before this. Left alone
  — it's a scratch helper, not schema. Flagging rather than deleting.

## Next Steps

1. **Stage 1 — tactic scene, keyframes, sides.** Unblocked: the drill tables
   are settled, so the tactics migration can be written against a stable
   schema. Start with `SceneEntity`'s optional tactics fields (`player_id`,
   `role`, `scale`, marker overrides) — all jsonb, no migration needed for
   them — then the `tactic` table's own columns.
2. **Optional:** open the remaining 9 drills in "Test U12 Reds" to close out
   Stage 0's verify step in full.

---

## Session log — Drill Creator rework, Stage 11: onboarding, and the 3D decision

Stage 11 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md). Two
items: an onboarding tour, and an explicit decision on 3D. Only the tour was
built — see below for why 3D wasn't.

### The 3D decision: deferred, not skipped

The plan's own text recommends this and asks for the decision to be made
explicitly rather than silently dropped, so: **3D is deferred.** Nothing
changed here — no `three`/`@react-three/fiber` dependency, no camera rig, no
rigged models. The 2D/3D toggle in `EditorTopBar` stays disabled, same as it's
been since Stage 5.

Why, restated from the plan with nothing new added: the 2D view is what a
coach actually reads pitch-side, on a phone, which is what this app is built
for. 3D means a second full renderer — a pitch mesh, run/backpedal/shuffle
animation clips, goalkeeper ball physics, a camera rig with lens control, an
environment system — plus real bundle-size cost on a PWA. Teloframe itself
gates 3D export behind a paid tier, which is a signal about how load-bearing
their own team considers it. None of this is a one-way door: `scene`/
`keyframes` from Stage 1 is renderer-agnostic by construction, so 3D — if it
ever happens — slots in later without touching a single stored drill. This
call should be revisited only with a concrete reason (a coach asking for it),
not on a schedule.

### What happened, in order

1. **`data-onboarding-anchor` attributes**, added retroactively — Stages 5–7
   didn't carry them, so this was the retrofit the plan warned about, not the
   cheap version. Six live in `ToolRail` (select, player, equipment, marking,
   pitch, drill-details — each on `RailButton` via a new `anchor` prop),
   one each on `EditorTopBar`'s name field, `PitchCanvas` (via a new optional
   `onboardingAnchor` prop — every other caller, DrillLibrary/the Coach's
   Card/the share page, leaves it unset), `TimelineBar`'s root, and the
   properties panel's two wrapping `<div>`s in `DrillEditor`.
2. **`editor/onboarding/tourSteps.ts`** — ten steps, plain data.
3. **`editor/onboarding/useOnboardingTour.ts`** — open/step state, a
   `localStorage` "seen" flag (`gaffer-onboarding-drill-editor-seen`) that
   auto-starts the tour once per browser, `restart()` for the replay button.
4. **`editor/onboarding/OnboardingTour.tsx`** — the coach-mark overlay: a CSS
   spotlight ring (the standard `box-shadow: 0 0 0 9999px` cutout trick, no
   SVG mask needed), a positioned tooltip that flips sides and clamps to stay
   on screen, Escape/backdrop-click to skip.
5. **`EditorTopBar`** — a help-icon button that calls `tour.restart()`
   ("replayable from the editor").
6. **`DrillEditor`** — mounts the tour and, on mobile only, opens whichever
   sheet (tools drawer / properties sheet) a step's anchor lives inside
   before the tour tries to measure it.

### What Worked

- **Verifying against the real DOM shape rather than trusting the code
  read.** `ToolRail` and the properties panel each render TWICE at any given
  moment — once for the desktop-persistent layout, once inside the
  always-mounted mobile sheet (see Sheet's own "always mounted,
  transform-animated" doc comment) — hidden from each other by opposite
  Tailwind breakpoint classes, not by `display: none` toggling on open/close.
  A plain `querySelector` on `data-onboarding-anchor` would silently grab
  whichever copy comes first in source order, which is wrong exactly half
  the time. Built and live-tested `findVisibleAnchor` against a fixture
  reproducing that exact duplicate-DOM shape (real dev server, real Tailwind
  classes, both the "desktop visible" and "mobile sheet open" cases) before
  trusting it — confirmed it always measures the actually-on-screen copy,
  confirmed Next/Back/Escape/Done all reach the right state, confirmed the
  spotlight ring's pixel position matches the anchor's `getBoundingClientRect`
  exactly (6px padding, 12px tooltip gap).
- **`useState(() => !hasSeenTour())` instead of an effect.** This app has no
  server render (plain Vite + client React), so there's no hydration
  mismatch to guard against, and seeding state lazily from `localStorage` is
  both simpler and one render cheaper than the effect-plus-`setState`
  version it replaced — which oxlint's `set-state-in-effect` rule flagged
  immediately as exactly the pattern it exists to catch.

### What Didn't Work / Watch Out For

- **I deleted a committed file by accident while building the verification
  harness, then restored it.** Needed a temporary local dev-server config
  outside this repo's tracked files to drive the fixture above; the first
  attempt landed a scratch `.claude/launch.json` at the wrong directory
  level, and clearing it with `rm -rf .claude` from the wrong `cwd` deleted
  gaffer's own pre-existing, git-tracked `.claude/launch.json` (a real dev
  server config, port 5173) without checking `git status` first — the exact
  mistake CLAUDE.md's own safety protocol exists to prevent. Caught it
  immediately via `git status` showing the file as deleted, restored with
  `git checkout HEAD -- .claude/launch.json`, confirmed the restored content
  matches history. Recorded here rather than smoothed over, per the file's
  own convention for anything that went sideways mid-session — nothing was
  lost, but it should not have happened.
- **Both duplicate-DOM copies have a non-null `offsetParent` more often than
  expected.** The check that disambiguates them (`offsetParent === null` for
  a `display: none` ancestor) does NOT distinguish "mobile sheet open" from
  "mobile sheet closed" — Sheet never sets `display: none`, only a
  `translateX` transform, so a closed sheet's copy still measures as
  "visible" by that test and its (off-screen) rect would be used if nothing
  else intervened. This is exactly why `DrillEditor` has to open the right
  sheet BEFORE a step needing it is shown, rather than relying on the tour to
  discover the correct copy on its own — the offsetParent check only tells
  desktop-copy from mobile-copy apart, not open from closed.
- **The sheet-opening effect is gated to `window.innerWidth < 1024` and only
  fires on `tour.step`/`tour.open` changes, not on resize.** Rotating a
  device or resizing the window mid-tour, mid-step, in a way that crosses the
  `lg` breakpoint is a known, accepted gap — the spotlight would briefly
  target whichever copy is visible without necessarily having the right
  sheet open. Narrow enough (rotating a tablet mid-walkthrough) that it
  wasn't worth the extra state to close for a stage scoped as "close to
  mechanical."
- **`settleMs` (250ms) is a fixed constant, not measured.** Sheet's own CSS
  transition is `duration-200`; 250ms is simply "longer than that," not
  derived from it. If Sheet's transition duration ever changes, this constant
  doesn't follow it automatically.

## Next Steps

1. **Nothing else is planned in DRILL_CREATOR_REWORK_PLAN.md** — Stages 1–11
   (onboarding half) are all done. 3D remains an explicit, revisitable "no."
2. **Still outstanding, all needing a signed-in session** — unchanged from
   Stage 10's list, plus the tour itself has never been seen by a real coach:
   the share link in a private window, a real browser print of the card,
   Export/GIF end to end, typing into the Details drawer (Stage 8), the
   library's filters against real data (Stage 9), tap/drag placement, and the
   11-drill read-back that gates migration 014 — still the one
   written-but-unapplied migration.

---

## Session log — Drill Creator rework, Stage 10: export & share

Stage 10 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md). A
drill that can't leave the app can't be handed to an assistant coach or pinned
to a clipboard. Four exits now: PNG, an animated GIF, a printable Coach's Card,
and a public link that animates.

### ⚠️ Read this first: a pre-existing anon hole, found and closed

`drill_all_members_or_unscoped` in `rls_policies.sql` was created with no `to`
clause, so it applied to the `public` role — **including `anon`**. Its USING
clause is `team_id is null or is_team_member(team_id)`; for an unauthenticated
caller `is_team_member` is false but `team_id is null` is simply TRUE. Every
coach-owned drill was therefore readable — and, since the policy is `for all`
with the same WITH CHECK, writable — by anyone holding the anon key, which
ships in the browser bundle and is not a secret.

**Verified live, not inferred**: inserted a `team_id is null` drill, read it
back under `set local role anon`, got the row, deleted the probe. Nothing was
actually exposed — all 11 drills are team-scoped, so the clause never fired —
but it was latent, armed by the first coach-owned drill anyone creates.

Migration 018 Part 1 adds the `to authenticated` the policy should always have
had. No app behaviour changes; every caller in `src/` is a signed-in coach.
Fixed here rather than filed for later because Stage 10.4 adds the project's
first anon-reachable surface, and "sharing is opt-in per drill" is not true
while anon can already read drills nobody opted into.

### What happened, in order

1. **`018_drill_share_token.sql`** — Part 1 above, then `share_token` (nullable,
   partial-unique) and an anon select policy.
2. **`drillSlice`** — `enableDrillSharing` / `disableDrillSharing` /
   `fetchSharedDrill`, plus `mintShareToken` (128 bits from
   `crypto.getRandomValues`, 32 hex chars).
3. **`export/exportFile.ts`** — filename stem + blob download, shared by PNG
   and GIF.
4. **`pages/DrillCardPage.tsx`** — the Coach's Card, a print-styled route at
   `/drills/:drillId/card`, rendered outside AppShell.
5. **`pages/SharedDrillPage.tsx`** + **`App.tsx`** — the public `/d/:token`
   page, and the router hoisted above the auth gate so it renders signed-out.
6. **`export/QrCode.tsx`**, **`editor/ExportPanel.tsx`**, and the top bar's
   Export button, disabled since Stage 5, finally wired up.
7. **`export/recordGif.ts`** — 25fps sampling and client-side GIF encoding.

### What Worked

- **Verifying the RLS policy by hand, five ways**, as the plan's own execution
  note demands ("an RLS mistake here is a data-exposure bug, not a rendering
  bug"). With three probe drills — one shared, one shared with a different
  token, one coach-owned and unshared — an anon caller sees: exactly one drill
  with the right token; nothing with a wrong token; **nothing with no header at
  all**; not the unshared coach-owned drill; and no non-SELECT policy exists
  for `anon`. Probes deleted, back to 11 drills.
- **Measuring the print layout at real A4 instead of eyeballing it.** The card
  was server-rendered against a maximal fixture (every field filled, four long
  lists) with react-konva stubbed, then measured in a browser at 794x1123 with
  the `@page` margins applied. First attempt: **1.55 pages** — the plan says
  one. Diagram-beside-facts plus two-column text sections brought it to 830px
  of the 1017px available, comfortably one page, 0px horizontal overflow. A
  minimal drill renders zero empty sections and no `null` strings.
- **Screenshotting the result anyway.** Same lesson as Stage 7: the numbers
  said "fits", but only looking confirmed the two columns balance and nothing
  collides.

### What Didn't Work / Watch Out For

- **The share policy is tighter than the plan's wording, deliberately.** The
  plan asks for "a public-select policy scoped to non-null tokens". Scoped to
  non-null *alone*, `select * from drill` as anon returns **every** shared
  drill — so anyone holding one share link could enumerate all the others,
  which is not what "opt-in per drill" is meant to buy. The policy adds
  `share_token = current_setting('request.headers')::json->>'x-share-token'`,
  so a reader gets exactly the drill they have a link for. Confirmed the GUC
  round-trips a custom header, and that a missing header yields null → the
  comparison is null, not true → no rows. **It fails closed.**
- **`fetchSharedDrill` builds its own session-less Supabase client.** It has to
  carry the `x-share-token` header (per-request data that has no business
  pinned to the app-wide client), and creating it with `persistSession: false`
  means a signed-in coach previewing their own link sees what the recipient
  sees. A share page that only works for its author is worse than none.
- **GIF only; no MP4.** The plan pairs GIF with "MP4 via WebCodecs + mp4-muxer
  where supported, with a GIF fallback". Only the fallback is built. It works
  everywhere, the MP4 path would need it anyway, and — the deciding factor —
  the codec-config edge cases are exactly what can't be verified without a real
  browser session, which sign-in still blocks. The plan ranks this whole item
  last and most deferrable.
- **The GIF drives the LIVE stage, not an offscreen one.** The plan says
  offscreen; that would mean reimplementing every shape `PitchCanvas` draws
  (~800 lines) against imperative Konva and keeping two renderers in step
  forever. Seeking the playhead and grabbing `stage.toCanvas()` is one function
  and cannot drift from what the coach sees. **Two `requestAnimationFrame`s
  per frame, not one** — a single rAF intermittently captures the previous
  frame, which shows up as the whole animation lagging one step behind.
- **`gifenc`, not the plan's `gif.js`.** Same job; gif.js needs a separate
  worker script copied into the build output and is long unmaintained.
  A substitution inside the dependency the plan already sanctions.
- **`qrcode-generator` is a third new dependency**, which the plan doesn't
  explicitly sanction. The plan does ask for a QR code, and a QR encoder is
  Reed-Solomon over GF(256) plus mask-penalty scoring — not something to
  hand-roll and then be unable to scan-test. Its output is rendered as our own
  SVG off `isDark(row, col)`, so no hardcoded colours leak in from the library.
- **The QR is the one place that ignores the theme tokens.** A QR code is read
  by a camera; scanners need dark modules on a light quiet zone, so inverting
  it in dark mode would look consistent and scan badly. Documented in the
  component.
- **`DrillCard` is exported from `DrillCardPage.tsx`** purely so the print
  layout can be rendered against a fixture with no store behind it. Zustand v5
  hands React `getInitialState` as the SSR snapshot and copies it onto the
  bound hook by reference, so a seeded store can't be made visible to
  `renderToString` from outside — exporting the presentational half was the
  clean way through.
- **Everything here is still unexercised by a real signed-in coach.** The RLS
  is verified at the database level and the layouts are measured, but nobody
  has clicked Export, printed a card from a browser's own print dialog, or
  opened a share link in a private window. That last one is the plan's own
  Verify step and remains outstanding.

## Next Steps

1. **Stage 11 — onboarding, and the explicit 3D decision.** The plan
   recommends shipping 1–10 and then deciding on 3D with the editor in hand,
   which is now the position we're in.
2. **Still outstanding, all needing a signed-in session:** the share link in a
   private window (Stage 10's Verify), a real browser print of the card,
   Export/GIF end to end, typing into the Details drawer (Stage 8), the
   library's filters against real data (Stage 9), tap/drag placement, and the
   11-drill read-back that gates migration 014 — still the one
   written-but-unapplied migration.

---

## Session log — Drill Creator rework, Stage 9: library, cards & session integration

Stage 9 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md).
Metadata is only worth entering if something consumes it — this is the
"something": `DrillLibrary.tsx` becomes a filterable card grid with real
animated playback, and the two places a drill gets picked (`DrillLibrary`
itself, `SessionDrillsPanel`) get richer than a name.

### What happened, in order

1. **`drillSlice.duplicateDrill`** — whole-drill duplication, the useful unit
   now that a drill is one cast of entities plus keyframes rather than a list
   of independent phases (only phases could be duplicated before). Two
   Supabase calls under the hood: `createDrill` for the structural fields
   (scene, keyframes, pitch, duration), then `updateDrill` for every Stage 8
   metadata field — `thumbnail_url` is the one deliberate omission, see below.
2. **`DrillLibrary.tsx`** rewritten — a card grid (thumbnail, name, category
   chip, duration, level, intensity, player count, age band) replacing the
   old name-only list rows, a filter bar (search · age · session block ·
   players · level · more filters, matching the target editor's own bar), and
   real interpolated playback (`useTimelinePlayback` + `frameAt`, read-only)
   replacing the old phase-cut timer. This retires the file's old comment
   about interpolation being impossible between two phases with unrelated
   element sets — Stage 1 made every entity's id stable across the whole
   drill, so it isn't impossible any more.
3. **`SessionDrillsPanel.tsx`** — the attach picker's Dropdown options now
   read `12 min · Technical` instead of just the pitch format when Stage 8
   metadata is present; picking a drill prefills the Minutes field from the
   drill's own `duration_minutes` (still editable); each attached row gets a
   small duration/session-block badge line under its name.

### What Worked

- **Every filter narrows the same array the fetch already loaded.** No new
  network calls — the "this scale doesn't need server-side search" note from
  build guide 2b still holds at eleven drills and will hold at a few hundred.
- **Building the age/category filter option lists from the data itself.**
  `age_min`/`age_max`/`category` are free text (Stage 8 deliberately didn't
  freeze them into unions), so a fixed dropdown list would either be wrong or
  need constant hand-maintenance. Deriving the options from what's actually
  on the eleven drills means the filter is never stale and never invents a
  band nobody uses.
- **A fresh `useTimelinePlayback` instance per selected drill**, via a `key`
  on the panel component that owns it — reusing one instance across
  selections would carry the previous drill's `currentTime`/`playing` state
  into a drill with a different duration.

### What Didn't Work / Watch Out For

- **`duplicateDrill` deliberately drops `thumbnail_url`.** The stored URL
  points at a Storage object keyed by the *source* drill's id
  (`<drill id>.png` — see Stage 8's bucket). Copying the string would point
  the duplicate at the source's own image, and since auto-capture only fires
  when a drill has no thumbnail yet, the duplicate would never get one of its
  own — it would silently start showing whatever the source's board looks
  like *now* the next time the source re-captures. Leaving it `null` lets the
  duplicate pick up a correctly-pathed thumbnail the first time it's edited,
  same as any other new drill. Verified this by hand against the live
  database (insert a fully-populated scratch drill, run the same two-step
  copy `duplicateDrill` performs, confirm every field round-trips except
  `thumbnail_url`), not just by reading the code.
- **A player-count or duration filter can't confirm a fit it has no data
  for.** A drill missing `min_players`/`max_players` never matches a players
  filter, and one missing `duration_minutes` never matches a duration filter
  — excluded, not treated as "fits anything". This is the stage's own point
  restated as code: metadata is what makes a drill findable, so a drill
  without it stays unfindable by that filter until Details is filled in.
- **Duration isn't one of the plan's five named primary filters** (search ·
  age · session block · players · level), but the stage's own definition of
  done — "a 12-minute technical rondo for 8 players" — needs one to exist
  somewhere. It lives under "more filters" alongside intensity, phase of play
  and category rather than crowding the primary bar past five controls.
- **All eleven live drills still carry no metadata** — the Details drawer
  built in Stage 8 has never been typed into (sign-in still blocks it), so
  every filter and card field beyond name/pitch/thumbnail was verified
  against a synthetic dataset and a live-database round-trip rather than the
  real library. Filter-combination logic (boundary cases on player-count and
  duration ranges, age-band derivation, search scope) was checked with a
  standalone script mirroring the component's exact predicate, not just
  read over.

## Next Steps

1. **Stage 10 — export & share.** Everything it needs (thumbnails, the
   richer drill record) is now in place.
2. **Still outstanding, all needing a signed-in session:** typing into the
   Details drawer for real (Stage 8), the library's filter bar and animated
   preview against real data, the tap/drag placement gestures, `/tactics`
   from Stage 3, and the 11-drill read-back that gates migration 014 — still
   the one written-but-unapplied migration, so the repo and the deployed
   database deliberately disagree by that file.

---

## Session log — Drill Creator rework, Stage 8: drill metadata & the Details drawer

Stage 8 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md). A
drill record was `name + pitch_size + orientation`; everything that makes one
findable and coachable now has a column, and a four-tab drawer to enter it in.

### What happened, in order

1. **`016_drill_metadata.sql`** — the nineteen columns from §8.1, plus indexes
   on `category` and `session_block`. Numbered 016, not the plan's 015: that
   number went to Stage 6's equipment remap, written after the plan was.
2. **`017_drill_thumbnail_bucket.sql`** — the `drill-thumbnails` bucket §8.5
   needs. The project had no storage bucket at all before this.
3. **`types.ts`** — the nineteen fields on `Drill`, a `DrillCoaching` jsonb
   shape, and four short vocabularies (difficulty, intensity, phase of play,
   session block) as unions with label tables.
4. **`drillSlice`** — `DrillUpdateInput` widened; `uploadDrillThumbnail`
   added, funnelled through `runSupabaseAction` like everything else.
5. **`editor/DrillDetailsDrawer.tsx`** — Basic info · Pitch · Coaching ·
   Settings. The Pitch tab is Stage 7's `PitchPanel` reused as-is.
6. **`editor/equipmentSummary.ts`** — "Cones ×12, Agility poles ×4" read off
   `scene.entities` (§8.3), with a manual override in `coaching.equipment`.
7. **The rail's "Drill details" button stopped being disabled** and now opens
   the drawer; `PitchCanvas` gained a `stageRef` so the stage can be captured.

### What Worked

- **Rendering the drawer server-side to smoke-test it.** Sign-in still blocks a
  real walkthrough, but `renderToString` over a fully-populated drill and an
  empty one caught what a type-check can't — that "not recorded" renders as an
  empty field rather than the string `null`, that only the chips a coach picked
  come back `aria-pressed`, and that the derived equipment line reads off the
  board. Bundle it with esbuild as **CJS**, not ESM: `react-dom/server` pulls
  `util` through a dynamic `require` that an ESM bundle can't satisfy.
- **Deriving equipment instead of asking for it.** It cannot drift, it costs a
  coach nothing, and the override is one click away for the things the board
  can't know about (bibs, a ball bag).

### What Didn't Work / Watch Out For

- **`updateDrill` could roll back unsaved canvas work, and now doesn't.** It
  merges the server's whole row back into local state; with metadata committing
  from a drawer open over the same canvas the coach was just dragging cones on,
  a field blur inside the 800ms autosave window would have discarded the drag.
  It now applies anything still queued in `pendingSaves` over the response, the
  same guard `fetchDrills` already had. This was latent before this stage — the
  top bar's name field could hit it too.
- **Thumbnail auto-capture is deliberately conservative.** It fires only after
  a drill has been edited *and* saved in this session, with something on the
  pitch, no thumbnail yet, and the playhead back at the start. Opening a drill
  is not enough — capturing on mount races the canvas's own width measurement,
  and would also write to a drill nobody touched. The eleven existing drills
  therefore get a thumbnail the first time each is edited, not the first time
  each is opened. The **Capture current view** button overrides all of it.
- **The thumbnail bucket is public-read.** A line drawing of cones on grass
  isn't worth a signed URL, and public read is what lets Stage 9's cards use a
  plain `<img src>`. Writes are scoped: the object is named `<drill id>.png`,
  and the policy joins back to the drill row through `is_team_member`.
- **A stable object path needs a cache-buster.** Re-capturing upserts to the
  same key, so the stored URL carries `?v=<timestamp>` or the browser keeps
  showing the old picture.
- **`category`/`subcategory` are deliberately free text.** The plan doesn't
  give a taxonomy and inventing one would freeze a coach's own naming into a
  type. The four fields Stage 9 filters on *are* unions.
- **`coaching.equipment` is a jsonb field, not a column.** §8.3 asks for an
  override and §8.1's column list has nowhere to put it — jsonb, no migration.
- **CLAUDE.md's data-model section is stale** (pre-existing, since Stage 5): it
  still says nothing in `src/` reads `scene`/`keyframes`. Left alone.

## Next Steps

1. **Stage 9 — library, cards & session integration.** It consumes exactly what
   this stage stores, including the thumbnails.
2. **Still outstanding, all needing a signed-in session:** a real walkthrough of
   the Details drawer (every field round-trips at the database level, but the
   form has never been typed into), the tap/drag placement gestures, `/tactics`
   from Stage 3, and the 11-drill read-back that gates migration 014 — still the
   one written-but-unapplied migration, so the repo and the deployed database
   deliberately disagree by that file.

---

## Session log — Drill Creator rework, Stage 7: pitch presets & overlays

Stage 7 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md). Four
pitch sizes become thirty-five presets keyed to real metre dimensions, and
`pitchGeometry.ts` stops switching over hand-authored constants and starts
deriving markings from whatever width and length it's handed.

### What happened, in order

1. **`canvas/pitchPresets.ts`** — the five families from §1 of the plan, each
   preset carrying real dimensions and the metadata the panel needs.
2. **`pitchGeometry.ts` generalised** — one `getPitchMarkings(config)` deriving
   boundary, boxes, halfway line and centre circle from the dimensions, plus
   `getPitchOverlays(config)` for the six overlays. The metres-based authoring
   and `transpose()` carry over untouched.
3. **`editor/PitchPanel.tsx`** — family tabs, preset cards with a mini plan
   view and real dimensions, m/yd toggle, portrait switch, custom size, and
   the overlays with an opacity slider.
4. **The `OverlayLayer` slot Stage 3 marked is now filled**, sitting above the
   turf and under everything a coach places.
5. **`SessionDrillsPanel` and `DrillLibrary`** label drills by preset name plus
   dimensions rather than "half pitch · portrait".

### What Worked

- **Verifying the invariant numerically rather than by eye.** 398 assertions
  over all 35 presets × 2 orientations: worst scale skew 2.17e-16, which is
  floating-point noise — pixels per metre are equal on both axes everywhere,
  which is the whole reason a centre circle stays circular. Also checked that
  every marking sits inside its pitch and that transposition swaps the two axes
  and nothing else. Worth re-running if `pitchGeometry` is ever touched again;
  it bundles standalone with esbuild because it imports only types.
- **Letting presets carry a `goalEnds` hint.** §7.2's rule on its own would
  have put two penalty boxes on the 53×68 "Attacking half" — four live drills
  use that space, and a half pitch has one goal. The hint lives in the preset
  table, so `PitchConfig` — the shape that's actually stored — stays exactly as
  the plan specifies, and a custom size still derives.

### What Didn't Work / Watch Out For

- **The centre circle has to scale with the pitch.** Holding it at the
  regulation 9.15m and merely clamping it to fit gave futsal a circle covering
  ninety per cent of the court, and denied 5v5 one entirely. It scales with the
  boxes now, which is both more honest and what made the small-sided family
  read as a progression. The numeric test passed *before* this fix — it only
  checked the circle was unclipped — so this one needed looking at.
- **`overlayOpacity` is a new optional field on `PitchConfig`.** §7.4 asks for
  an opacity slider and §7.1's interface has nowhere to put the value. jsonb,
  so no migration.
- **The four legacy preset keys are resolved but not offered.** Drills saved
  before this stage still say `full` / `three_quarter` / `half` / `quarter`;
  `findPreset` maps them so they render and label correctly, but the panel
  offers `attacking_half` and `final_third` instead, which are the same spaces
  under the names a coach would use. Nothing rewrites the stored key until a
  coach picks a new preset.
- **Quarter-pitch drills changed proportion, as flagged back in Stage 1.** The
  plan's own mapping made `quarter` 35×68 while the phases-era geometry drew it
  30×40. Three drills are affected; their markers are normalized 0-1 and sit
  where they always did.
- **Seven rondo presets had no dimensions in the plan's table** (4v1 tight,
  transfer, diamond, hexagon, end-zone, 4-zone box, 5-channel corridor).
  They're filled in with realistic coaching sizes rather than left out.
- **`markings: 'full' | 'grid' | 'none'` stays optional** on `PitchConfig`,
  against §7.1's interface. Migration 013b never wrote the field, so requiring
  it would describe data that doesn't exist; omitted means "derive from the
  dimensions", which is §7.2's rule anyway.

## Next Steps

1. **Stage 8 — drill metadata & the Details drawer.** It claims migration 015
   in the plan's text; that number is taken by Stage 6's equipment remap, so
   it wants 016.
2. **Still outstanding, all needing a signed-in session:** the tap/drag
   placement gestures, `/tactics` from Stage 3, and the 11-drill read-back that
   gates migration 014 — which remains the one written-but-unapplied migration,
   so the repo and the deployed database deliberately disagree by that file.

---

## Session log — Drill Creator rework, Stage 6: element library & properties

Stage 6 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md).
Equipment goes from three types to eleven, the markings panel gains the seven
drawing tools Gaffer never had, and every selected thing finally has properties
to edit.

### What happened, in order

1. **`EquipmentType` widened to eleven** and `SceneEntity` gained `rotation`.
   Both jsonb, so no schema migration — but see below for the one data
   migration this did need.
2. **`canvas/EquipmentShapes.tsx`** — the eleven silhouettes plus matching SVG
   icons for the panels, and an `EQUIPMENT` palette in `pitchTheme.ts` cut down
   to three families (marker / frame / ground).
3. **`EquipmentPanel`** (Core/Advanced), **`MarkingsPanel`** (the nine tools plus
   Gaffer's existing Pass and Note, and Clear All), **`GridPanel`**.
4. **`PitchCanvas`** gained a drawing state machine, a five-metre grid,
   snap-to-grid, smart guides and equipment rotation.
5. **`PropertiesPanel`** — the four sections, including the gated Draw Route.

### What Worked

- **Three drawing gestures, not eleven.** Drag-and-release for anything with
  two ends (arrow, line, circle, rectangle, ruler), tap-per-point for polylines
  (curve, zone), and a recorded trail for freehand. Draw Route reuses the
  polyline rule exactly — "tap the last point again to finish" — so there's one
  gesture to learn rather than two.
- **Storing rectangles and ellipses as their bounding-box corners** and
  reconstructing them at render time, rather than as two-point polylines. It's
  what lets the Konva Transformer from Stage 3 keep working on them unchanged.
- **Curved arrows are arrows.** Routing `curve` through the same Konva `Arrow`
  as a straight one with `tension` applied keeps the arrowhead, which is what
  makes a bent pass read as a pass rather than as a stray line.

### What Didn't Work / Watch Out For

- **The plan's eleven types collide with the old three, and that needed a data
  migration after all.** The phases-era `'cone'` was *drawn* as an agility pole
  — pitchTheme.ts said so outright — and the new set has a real `cone` and a
  real `pole`. Left alone, 17 pieces across 6 drills would have silently
  changed shape the next time a coach opened them. Migration 015 remaps
  `cone → pole` and `witches_hat → cone` in `scene.entities`; the same mapping
  is carried in `canvas/phaseFrame.ts` so the drill library preview, which
  still reads `phases`, doesn't disagree with the editor. §6.1's "no migration"
  is true of the *schema*, which is untouched.
- **Snap-to-grid and smart guides fight each other.** One pulls to a fixed
  lattice, the other to whatever is already placed. Snap wins when both are on,
  and the grid panel says so rather than leaving it a mystery.
- **The ruler measures and keeps nothing.** It isn't one of `Marking`'s kinds
  and shouldn't be — it's a question a coach asks, not a thing they draw. It
  shares the drawing machinery and is dropped on release.
- **Marking colours are named swatches, not a picker.** An arbitrary hex would
  defeat the shape-over-palette rule the whole equipment library is drawn to,
  and would put colour authoring outside `pitchTheme.ts`.
- **`mini_goal` and `full_goal` are the same silhouette at different widths.**
  That's honest — they *are* the same object at different sizes — but it's the
  one pair in the library that needs the size difference to tell them apart, so
  don't shrink the gap between them.
- **The equipment shapes were built here rather than fanned out to subagents**
  as the execution note suggests; agents only get spawned when asked for.

## Next Steps

1. **Stage 7 — pitch presets & overlays**, which replaces the four-preset
   bridge in `PitchCanvas` (`sizeForPreset`) and the matching table in
   `DrillEditor` with the real ~35-preset set, and generalises
   `pitchGeometry.ts` to arbitrary metre dimensions.
2. **Still outstanding, all needing a signed-in session:** the tap/drag
   placement gestures (Konva ignores synthetic events, so they were verified
   through their wiring rather than driven), `/tactics` from Stage 3, and the
   11-drill read-back that gates migration 014.

---

## Session log — Drill Creator rework, Stage 5: editor shell

Stage 5 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md). The
917-line `DrillPreview` is gone, replaced by a routed editor: top bar, left
tool rail, pitch, contextual right panel, timeline docked at the bottom — and
below `lg`, a drawer, a sheet and a floating dock. This is the stage where
everything Stages 1-4 built becomes something a coach can actually touch.

### What happened, in order

1. **Routing** — `/design` is now the drill picker; `/design/:drillId` is the
   editor. Deep-linking to a drill was impossible before and Stages 9 and 10
   need it.
2. **`design/editor/`** — `DrillEditor` (layout plus all the editor's view
   state), `EditorTopBar`, `ToolRail`, `PropertiesPanel`, with `toolIcons` and
   `CreateDrillForm` carried over from the old editor rather than rewritten.
3. **`ui/Toast`** — the minimal toast §5.5 asks for, split into a context/hook
   file and a provider so `react/only-export-components` stays quiet.
4. **`DrillPreview.tsx` deleted.** The plan's own table marks it "Replaced",
   and this change is what made it dead.

### What Worked

- **Giving every rail tool exactly today's capability rather than a
  placeholder.** Equipment offers the three kinds that exist, Markings offers
  arrows and notes, Pitch offers the four presets — Stages 6 and 7 widen those
  panels rather than building them from nothing. Grid & Guides and Drill
  Details have no data behind them at all, so they render *disabled*, which is
  the treatment the plan itself specifies for the 2D/3D toggle; Export gets it
  too.
- **Capping the canvas by height, not just width.** A tall preset in a wide
  column ran to ~900px and pushed the docked timeline below the fold. The cap
  belongs in `PitchCanvas` because it's the only place that knows the aspect
  ratio relating the two — a `maxHeight` prop, applied as a width cap.
- **Verifying the properties panel branch by branch.** All five states check
  out: keyframe list when nothing is selected, player (team/number/label),
  equipment, multi-select, and marking.

### What Didn't Work / Watch Out For

- **`TEAM_SCOPED_PATHS` needed no edit**, contrary to the plan's decision note.
  It matches with `startsWith('/design')`, so `/design/:drillId` was already
  covered and the team-level nav keeps showing inside the editor.
- **Drag-to-place only writes into a keyframe the playhead is parked on.**
  Between keyframes there's no single frame to write to, and silently editing
  the nearest one would move markers the coach can't see; the editor says so
  in a toast instead. Whether scrubbing off a keyframe should instead stage a
  transient frame — which is what would make Stage 4's dirty dot light up — is
  a real design question Stage 6 will have to answer.
- **Details sits in the rail only.** §5.2 lists it in both the top bar and the
  rail; two disabled buttons for one future drawer reads worse than one.
- **44px targets hold below `lg`; desktop uses 32-40px.** Stage 4's timeline
  controls were 32px throughout, which fails the touch bar now that the
  timeline is docked in the shell, so they're `h-11 lg:h-8`. The one
  deliberate exception is the keyframe diamonds, widened from 12px to a 24px
  hit area rather than 44px — two keyframes a few seconds apart would be
  impossible to hit apart otherwise, and a track handle is direct manipulation
  rather than a tap target.
- **Tailwind can't see a class built from a template string.** The mobile
  sheet's `${side}-0` never reached the stylesheet; both sides are written out
  in full now. Worth remembering for any other side-parameterised component.
- **Konva ignores synthetically dispatched pointer events**, so tap-to-place
  couldn't be driven from the console the way the timeline could. The wiring is
  verified — tool arming, the placement hint, and one placement that did land
  through to the store with an undo entry — but the tap gesture itself wants a
  human once signed in.

## Next Steps

1. **Walk the editor signed in** — place a player, drag one from the rail,
   draw an arrow, and confirm the toasts. The layout is verified at 390, 800
   and 1440 with no horizontal scroll, but the placement gestures were only
   verified through their wiring.
2. **Stage 1's migration 014 is now unblocked in principle** — the new editor
   exists, so "read all 11 drills back in the new editor" can finally be done.
   Do that walkthrough before applying it, and remember `DrillLibrary` still
   reads `phases` until Stage 9.
3. **Stage 6 — element library & per-entity properties**, which widens the
   Equipment and Markings panels, fills in the rest of the entity properties,
   and adds `GridPanel`.
4. **Still outstanding:** `/tactics` signed-in check from Stage 3.

---

## Session log — Drill Creator rework, Stage 4: timeline & playback

Stage 4 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md) — the
visible payoff of Stages 1-3. A drill now has a clock, a scrubbable track, and
a per-segment readout that says out loud whether the movement a coach just drew
is physically possible.

### What happened, in order

1. **`timeline/useTimelinePlayback.ts`** — a rAF clock owning `currentTime`,
   `playing`, `speed` and `loop`. `currentTime` is React state in the hook and
   nowhere near Zustand: it changes sixty times a second, and every component
   subscribed to that store would re-render with it.
2. **`timeline/speeds.ts`** — normalized Δ to metres, divided by segment
   seconds, maxed per entity kind, colour-coded against 8 m/s for a player and
   25 m/s for a driven pass.
3. **`timeline/cursor.ts`** — which keyframe the playhead is on, prev/next, and
   the `mm:ss` clock. Three consumers, so it earns its own module.
4. **`timeline/TimelineBar.tsx`** — clock, keyframe count, transport, speed,
   loop, onion skin, expand. Presentational; owns no drill state.
5. **`timeline/TimelineEditor.tsx`** — ruler, click-to-scrub, draggable
   playhead, draggable keyframe diamonds, segment bars, the context-aware
   primary button, and delete/clear/balance/duration.
6. **`timeline/useKeyframeToggle.ts`** and **`useTimelineKeys.ts`** — the shared
   Add/Update action and the Space/arrows/`,`/`.`/`K` shortcuts.
7. **`timeline/onionSkin.ts`** + a real `OnionSkinLayer` in `PitchCanvas`,
   filling the slot Stage 3 left marked.

### What Worked

- **Checking the physics by hand before trusting the UI**, as the plan asks.
  45 Node assertions over `speeds.ts` and `cursor.ts`, including both halves of
  the plan's own Verify and the orientation trap: `PitchConfig` stores canonical
  *portrait* metres plus an orientation flag, so landscape has to swap the axes.
  Getting that backwards would quietly report a 68m run as 105m, and no UI check
  would have caught it.
- **Retiming a keyframe writes once, on release.** `moveKeyframe` is a
  committed mutation — calling it per pointer-move would have pushed an undo
  entry per frame of the drag. The diamond shows a local preview and commits on
  pointerup: verified as store-untouched during the drag, one entry after.
- **`K` proved the gap Stage 2 left open is closed.** Pressing it at 4s captured
  the *interpolated* frame — player at y=0.25, ball at 0.285, and the player who
  isn't on the pitch yet recorded as `{ hidden: true }` — and split the segment
  without changing its speed, so nothing snapped.

### What Didn't Work / Watch Out For

- **The caution band opens at 90% of the ceiling, not 80%.** The plan's Verify
  pins it: 105m in 15s is 7 m/s and has to read green against the 8 m/s player
  ceiling. 7 m/s is a genuinely quick sprint, so this band is generous by
  design — if it ever wants tightening, that Verify step has to move with it.
- **Segment speed is the straight-line chord**, which is what Stage 4.4
  specifies. Once Stage 6's Draw Route lets a coach bend a run, the real
  distance is longer than its chord and the readout becomes a lower bound.
  Closing that means measuring the spline in metre space —
  `interpolate.ts` already does exactly that internally for playback, so it's a
  matter of exporting it rather than writing it.
- **Onion skin ghosts entities only, not markings**, and draws them as plain
  silhouettes rather than the full shapes. Ghost arrows and notes are clutter;
  movement is the thing onion skin exists to show.
- **The `OnionSkinLayer` sits *below* the entities**, not above them where the
  plan's §1 layer list puts it — Stage 4.5's own wording is "beneath the live
  one", and ghosts drawn on top of live markers would be worse than useless.
  Six layers now, with OverlayLayer (Stage 7) still to come: exactly seven.
- **The timeline shortcuts stand down when the canvas has claimed a key.** Both
  want arrows and space. The canvas handles them on its own container and calls
  `preventDefault`; the timeline listens on window, runs afterwards, and checks
  `event.defaultPrevented`. Without that, one arrow press would nudge a player
  *and* scrub the playhead.
- **Nothing mounts these yet.** Stage 5.2 is "Timeline docked bottom", and the
  only editor that exists today edits `phases[]` — docking a keyframe timeline
  onto it would mean converting it to scene/keyframes, which is Stage 5's job.
- **rAF is suspended while the browser pane is hidden**, which is correct
  behaviour but means the playback loop can't be sampled from a background tab.
  Verified by substituting the frame source (a `setTimeout` shim) so the hook's
  real elapsed-time maths still ran: 4.99s of drill time in 5.00s of wall clock.

## Next Steps

1. **Stage 5 — editor shell.** It should call `useTimelinePlayback`, render
   `TimelineBar` + `TimelineEditor` docked at the bottom, feed the canvas
   `frameAt(...)` and `onionFramesFor(...)`, and pass `useKeyframeToggle`'s
   `toggle` to the bar so `K` works while the track is collapsed.
2. **Still outstanding:** open `/tactics` signed in (Stage 3), open the 11
   drills and confirm nothing moved (Stage 1), and don't apply migration 014
   until its header's three conditions hold.

---

## Session log — Drill Creator rework, Stage 3: interpolation, selection, transform

Stage 3 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md) — the
stage that turns the entities+keyframes data into something on screen.
`frameAt(scene, keyframes, t)` is the seam: a pure function resolves a drill to
placed shapes, and `PitchCanvas` renders that frame exactly as it rendered a
phase before, so the rule CLAUDE.md states about the canvas never touching
Supabase survives the rework intact.

### What happened, in order

1. **`canvas/interpolate.ts`** — written and verified on its own before the
   canvas was touched, as the plan advises. Bracketing with clamping at both
   ends, linear lerp, centripetal Catmull-Rom over a custom `path` with
   arc-length reparameterisation, `facing` from explicit value → travel vector
   → `bodyShape` offset, `hidden` entities omitted.

2. **`PitchCanvas`** — `frame: RenderFrame | null` and `pitch: PitchConfig`
   replace `phase`/`pitchSize`/`orientation`. Split into named Konva layers.
   Selection, multi-select drag, arrow-key nudge, a Transformer for markings,
   and wheel/pinch zoom with space-drag pan and a Fit reset.

3. **Every caller adapted in the same change** — `TacticBoard` (which the plan
   names), plus `DrillPreview` and `DrillLibrary`, which hand the canvas a
   `DrillPhase` and would otherwise have broken the build that Stage 3's own
   Verify requires. `canvas/phaseFrame.ts` is the bridge; it dies with the
   phases column in migration 014.

### What Worked

- **Testing `frameAt` as a plain Node module.** It imports only *types* from
  the store, so esbuild strips every runtime import and it runs standalone —
  44 assertions covering clamping, appearing/leaving entities, marking
  binding, all four `bodyShape` cases, path endpoints, monotonicity, degenerate
  inputs and purity. Worth knowing for Stage 4: `speeds.ts` will be testable
  the same way.
- **Arc-length reparameterisation was the right call.** Sampling the spline by
  raw parameter would have made a marker sprint through tightly-spaced
  waypoints and crawl through wide ones. Measured over a three-waypoint route,
  equal time steps cover distances within a 1.12 ratio; the straight-line case
  is exactly 1.0000. Stage 4's speed readout depends on this — it would
  otherwise report a number the animation doesn't move at.
- **Driving the real canvas with real pointer events.** Box-select then drag
  moved all three selected entities by an identical delta (0.2264, 0.165) with
  unselected ones untouched, in 3 move calls with exactly 1 commit — which is
  also a live confirmation that Stage 2's dragmove/dragend split holds through
  the canvas.

### What Didn't Work / Watch Out For

- **`frameAt` filters markings by the governing keyframe.** The plan's
  signature doesn't mention it, but without it every phase's arrows would draw
  at once — a visible regression against today's per-phase arrows, and the
  reason Stage 1 gave markings a `keyframeId` at all. Static markings (no
  `keyframeId`) always draw. Verified: `a1+n1+z1` at t=0, `z1` alone at t=5.
- **Five layers, not seven.** `OverlayLayer` (Stage 7) and `OnionSkinLayer`
  (Stage 4.5) have nothing to draw yet and an empty Konva layer is a real
  canvas. Both slots are marked in place in the JSX so they drop in without
  restructuring, and five plus those two is exactly the seven-layer ceiling.
- **Text markings render in the EntityLayer, not the MarkingsLayer.** Teloframe
  puts markings under entities, but Gaffer's notes have always read on top and
  moving them under players is a regression. This is the one place the layer
  split isn't strictly by kind — and it's what keeps the count at five.
- **`pitch.preset` is bridged back to a `PitchSize`.** `pitchGeometry` still
  hand-authors markings per size; generalising it to metre dimensions is Stage
  7.2. Doing it now would have changed the quarter pitch's aspect ratio
  (35×68 vs today's 30×40) and broken "no regression". The bridge is ~6 lines
  and Stage 7 deletes it.
- **Selection is wired into `DrillPreview`**, which is throwaway — Stage 5
  replaces that component. It's there because "the editor" is where the plan
  puts selection state, and because the DoD's "box-select + drag moves a
  group" isn't demonstrable otherwise.
- **`facing` is computed but nothing renders it yet.** It's part of the
  `RenderFrame` contract Stage 4/6 read; the Faces UI is Stage 6.
- **No memoisation inside `frameAt`.** Stage 4 will call it 60x/sec. Measured
  cost is a few hundred float ops per pathed entity per frame, and a
  cache-invalidation bug in the correctness core would be far worse than that.
  If profiling ever says otherwise, key a WeakMap on the `path` array — it's
  stable, because the store is immutable.
- **`/tactics` wasn't clicked through** — see Next Steps.

## Next Steps

1. **Open `/tactics` signed in and confirm no regression** — the one Verify
   item left outstanding. The adapter's exact output was rendered through the
   same canvas and looks right (full pitch portrait, one team colour, name
   labels, solid and dashed arrows, note on top), and `phaseToRenderFrame` was
   checked lossless against a real stored drill phase, but the signed-in
   click-through needs a human at the keyboard.
2. **Stage 4 — timeline & playback.** `frameAt` is ready for it; onion skin is
   two more calls at low opacity, and the OnionSkinLayer slot is marked.
3. **Stage 4 should pass `frameAt`'s result into `addKeyframe(drillId, t,
   states)`**, closing the gap Stage 2 left deliberately open.
4. **Still outstanding from Stage 1:** open the 11 drills in the editor and
   confirm nothing moved; don't apply migration 014 until its header's three
   conditions hold.

---

## Session log — Drill Creator rework, Stage 2: store actions, undo/redo, autosave

Stage 2 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md).
`drillSlice`'s old contract — local mutation, then the caller fires exactly one
`updateDrill` — was right in spirit but doesn't survive a timeline: dragging a
player while a playhead scrubs would have fired dozens of full-document writes.
This replaces it with a committed-mutation model, a bounded undo stack and a
debounced autosave.

### What happened, in order

1. **Entity/keyframe/marking actions** — `addEntity` (auto-numbering per team),
   `updateEntity`, `removeEntity` (clears the entity out of every keyframe's
   `states` too), `setEntityPosition`, `addKeyframe`, `updateKeyframeState`,
   `moveKeyframe`, `deleteKeyframe`, `clearKeyframes`, `balanceTiming`,
   `addMarking` / `updateMarking` / `removeMarking`, `setDrillPitch`,
   `setDuration`. Everything except `setEntityPosition` is a *committed*
   mutation: undo snapshot, mark dirty, schedule the write.

2. **Undo/redo** — `{scene, keyframes, duration_seconds, pitch}` snapshots,
   bounded at 50 per drill, held in the slice closure rather than in reactive
   state (nothing renders a stack, and 50 snapshots per drill would be compared
   on every store update for nothing). Every stack mutation is accompanied by a
   `set`, so `useStore((s) => s.canUndo(drillId))` stays reactive.

3. **Autosave** — 800 ms idle debounce sitting *above* `runSupabaseAction`,
   never inside it. One `saveState: 'saved' | 'dirty' | 'saving' | 'error'`
   field. `flushDrillSave()` forces a write for unmount/route change;
   `beforeunload` is wired in the slice itself, the only place that both knows
   `saveState` and outlives every editor mount.

4. **`createDrill` seeds the new shape** — one keyframe at `t: 0` (the direct
   translation of the old "a drill always keeps at least one phase" invariant;
   without it `addEntity` has nowhere to record a position) and a `pitch`
   derived with the same four-value table migration 013b used.

### What Worked

- **Verifying the store directly in the browser instead of waiting for Stage
  5's editor.** Both of the plan's Verify steps name UI that doesn't exist yet,
  but the slice is drivable from the console via a dynamic
  `import('/src/store/index.ts')`, and counting at the `fetch` boundary counts
  exactly what a DevTools Network panel would. Results: a 5.8-second drag
  produced **0** PATCHes during the drag and **1** in total; 60 committed edits
  gave **exactly 50** undo steps (159→110, oldest ten evicted), 50 redos back
  to 160, and a new edit correctly abandoned the redo branch.
- **The browser throttling background timers to ~1s/tick made the drag test
  stronger, not weaker.** Every gap between dragmoves was longer than the 800 ms
  debounce, so a debounce wrongly scheduled from `dragmove` would have fired
  several times over. It fired once, at commit.
- **Simulating offline by rejecting `fetch` rather than by unplugging
  anything.** `dirty` → `error`, local value kept, and the queued payload
  retried intact once the network came back.

### What Didn't Work / Watch Out For

- **Four signatures deviate from the plan's literal text**, each forced by the
  spec itself:
  - `setEntityPosition(…, commit?)` — the hot path is "local-only", but the undo
    snapshot has to be captured at drag *start* or Ctrl+Z steps back to a point
    part-way through the gesture. The flag is the smallest way to say "this call
    is the drag-end one" without inventing `beginEdit`/`commitEdit`.
  - `updateKeyframeState(drillId, keyframeId, states)` — "recapture current
    positions" needs a source, and the playhead deliberately isn't in this store
    (plan §4.1). The caller owns the frame.
  - `addKeyframe(drillId, t, states?)` — defaults to the keyframe holding at `t`
    under step semantics. Stage 4 should pass a `frameAt` result once Stage 3
    lands; **without that, a keyframe added mid-segment will visibly snap** once
    interpolation exists. Deliberately not solved here — duplicating
    `interpolate.ts` in the slice would give it two sources of truth.
  - `undo(drillId)` / `canUndo(drillId)` — the plan's own text makes the stacks
    per drill.
- **The `phases` block is still in the slice**, marked deprecated and untouched.
  Removing it means rewriting `DrillPreview` (Stage 5); the plan puts the
  editor's break at Stage 3, not here, so the build stays green and the old
  editor keeps working. It is *not* part of the undo stack or the autosave
  queue — don't wire anything new to it.
- **No action sets a keyframe's `name`/`description`.** Stage 4.3 needs one
  ("keyframe properties: index, time, name, description"); Stage 2's action list
  doesn't include it, so it isn't here. Stage 4 should add
  `updateKeyframe(drillId, keyframeId, patch)`.
- **`setDuration` deliberately leaves keyframes past the new end where they
  are.** Silently dragging a coach's keyframes is worse than leaving one out of
  reach, and `balanceTiming` is the tool for redistributing. Stage 4's duration
  control should decide whether to prompt.
- **Two keyframes may never share a `t`** — `addKeyframe` and `moveKeyframe`
  both refuse, and times are rounded to the millisecond so float noise can't
  sneak a near-duplicate past the guard. Stage 3's interpolator can therefore
  assume every segment has non-zero length.
- **Undo history survives a refetch of the same drill.** It's pruned only for
  drills that vanish from the fetched list, because every screen refetches on
  mount and clearing on each one would lose undo just by glancing at the
  library.

## Next Steps

1. **Stage 3 — canvas: frame interpolation, selection, transform.** `frameAt`
   is the piece Stage 2 deliberately left a hole for (see `addKeyframe` above).
2. **Nothing calls the new actions yet.** The editor still runs on `phases`;
   Stages 3–5 move it over.
3. **Still outstanding from Stage 1:** open the 11 drills in the current editor
   and confirm nothing moved, and don't apply migration 014 until its header's
   three conditions hold.

---

## Session log — Drill Creator rework, Stage 1: entities + keyframes

Executing Stage 1 of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md)
— the data-model change every other stage in that plan depends on. A drill
stops being a list of independent snapshots (`phases[]`, each carrying its own
`players/cones/balls/arrows/annotations`) and becomes one cast of entities with
ids stable for the whole drill, plus keyframes saying where each of them is at
time `t`. That identity across time is what makes interpolation, onion skin,
movement paths and the per-segment speed readout expressible at all; none of
them are definable against `phases[]`.

### What happened, in order

1. **Types (`src/store/types.ts`)** — added `EntityKind`, `PlayerDisplay`,
   `BodyShape`, `EquipmentType`, `SceneEntity`, `EntityState`, `Keyframe`,
   `Marking`, `DrillScene`, plus the `PitchConfig` / `OverlayKind` that
   `Drill.pitch` needs. `Drill` gained `scene` / `keyframes` /
   `duration_seconds` / `pitch`; `phases` and `pitch_size` stay, marked
   `@deprecated`, because the plan's own §1.2 says to leave them until the
   backfill has been eyeballed. Re-exported from `src/store/index.ts`.

   One deviation from the plan's literal type block: `EntityState.x`/`.y` are
   optional, not required. Its own backfill rule 3 writes `{hidden: true}` with
   no coordinates for an entity that isn't on the pitch at a given keyframe, so
   required `x`/`y` would have been a lie about the data.

2. **`013_drill_scene_keyframes.sql`** — the four additive columns, verbatim
   from the plan. Applied. Nothing existing is touched, so `phases` stays the
   authoritative copy and the backfill stays re-runnable.

3. **`013b_backfill_scene.sql`** — the plan's six conversion rules as one
   `WITH … UPDATE`. Dry-run as a `SELECT` first and diffed against the old
   shape, then applied. All 11 drills round-trip: 14 assertions over the
   *persisted* columns (every element at the same keyframe with byte-identical
   coordinates, hidden-vs-present correct both ways, every keyframe's `states`
   covering the whole cast, keyframe gaps equal to the phase durations they came
   from, every arrow and annotation carried over with its `keyframeId`, no
   duplicate entity/marking ids) all return 0.

4. **`014_drop_drill_phases.sql`** — written, **deliberately not applied**. Its
   gate in the plan is "once a manual read-back of all 11 drills *in the new
   editor* looks right", and that editor is Stage 5. The file's header names the
   gate and lists every `src/` reference that has to be stripped in the same
   change, per the 008/009/010 precedent.

### What Worked

- **Dry-running the backfill as a `SELECT` beat the plan's suggested
  branch-and-diff.** Because 013/013b only ever write the four new columns,
  the conversion could be computed, diffed against `phases`, and re-run freely
  without a Supabase branch — cheaper, and reversible in a way a branch merge
  isn't.
- **Checking the real jsonb before writing any SQL.** Three things that would
  have been silent bugs came out of it: arrow ids repeat across phases (`a1` in
  two different phases), so markings had to be namespaced `<phaseId>:arrow:<id>`
  to stay unique in one flat array; 8 of 18 phases have no `duration_seconds`,
  so the 3s default matters more than it looks; and one player's `number`
  differs between phases (below).
- **Preserving today's ordering deliberately.** Entities are emitted equipment
  → balls → players, matching `PitchCanvas`'s existing draw order, which also
  keeps each phase's original player order intact so `assignTeamColors` still
  hands team A and team B the same two colours.

### What Didn't Work / Watch Out For

- **The conversion is lossy in exactly one place.** "Finishing Circuit" carries
  player id `p1` with number 7 in phase 1 and number 11 in phase 2. An entity
  has one number for the whole drill by definition, so first occurrence (7)
  wins. Inherent to the model change, not to the SQL.
- **`quarter` maps to 35×68 m, which is not today's quarter pitch.** The plan's
  Stage 7 table says `quarter→35×68`; `pitchGeometry.QUARTER` is currently
  30×40. Followed the plan, but the three quarter-pitch drills will render at a
  different aspect ratio once Stage 7 starts reading `pitch`. Marker coordinates
  are normalized 0–1 and are unaffected. Worth an explicit decision in Stage 7
  rather than a surprise.
- **`createDrill` still writes only the old columns**, so any drill created
  before Stage 2 lands gets default `scene`/`keyframes`/`pitch` while its real
  content goes to `phases`. That's why 013b is re-runnable — re-run it before
  applying 014. Fixing `createDrill` is Stage 2's job, not Stage 1's.
- **`Drill.orientation` and `Drill.pitch.orientation` now duplicate each other.**
  The backfill keeps them in sync. Stage 7 should decide which one survives;
  the plan's 1.4 only drops `phases` and `pitch_size`.
- **The signed-in editor click-through wasn't done** — see Next Steps.

## Next Steps

1. **Open the 11 drills in the current editor and confirm nothing moved** — the
   one Verify item from Stage 1 left outstanding. The data-level proof is done
   (the `UPDATE`'s `SET` list names only the four new columns, so `phases` could
   not have changed, and its derived counts still match the pre-migration
   snapshot exactly), and the app was confirmed to build, load and log no
   console errors, but the signed-in walkthrough itself needs a human at the
   keyboard.
2. **Stage 2 — store: entity/keyframe actions, undo/redo, autosave.** Nothing
   in Stage 1 pre-empts it: `drillSlice` is untouched and still phases-based.
3. **Don't apply 014 until its header's three conditions are all true.**

---

## Session log — design rework: skeletons, icon rail, focus ring

Executing `rework-plan-gaffer-2026-08-22.md` (the Supabase Studio design
brief diffed against Gaffer) via a staged execution plan. Stages: 0
baseline, 1 remove stray `shadow-sm`, 2 skeleton loading states app-wide,
3 persistent icon-rail sidebar, 4 shadow-based focus ring, 5 final
verification + deploy. Stages 3 and 4 deliberately override settled
`DESIGN.md` decisions at explicit user instruction — see each entry.

Nothing is pushed to `origin/main` until Stage 5, after user sign-off.
Vercel auto-deploys from `main`, so the push IS the deploy.

### What happened, in order

1. **Stage 0 — baseline and clean tree** — verified `main` in sync with
   `origin/main` and a clean `npm run build` + `npm run lint` on the
   untouched tree before any changes, so later failures are attributable
   to this work rather than inherited. Committed the pre-existing
   uncommitted `HANDOFF.md` session log plus the untracked
   `rework-plan-gaffer-2026-08-22.md` as housekeeping, so every
   subsequent stage commit contains only that stage's changes.
   **Verified**: clean build; lint exits 0 with the known
   `preserve-manual-memoization` warning *plus* two
   `react(set-state-in-effect)` warnings on `TacticBoard.tsx:84,93` that
   are also pre-existing (they appear on the untouched tree, before any
   change in this session) but are NOT listed in `CLAUDE.md`'s
   known-warnings note. Clean `git status` afterwards.

2. **Stage 1 — removed the stray `shadow-sm`** —
   `src/components/design/PitchCanvas.tsx:216` carried
   `shadow-sm` on the canvas wrapper, the one live violation of
   `DESIGN.md`'s "never a shadow" rule for chrome. Removed; `grep -rn
   "shadow-sm" src` now returns zero hits. `shadow-xl` on the mobile
   drawer in `AppShell.tsx` was deliberately left alone — the no-shadow
   rule governs chrome surfaces, not a modal overlay that needs
   separation from the page behind it.
   **Verified**: clean build, lint unchanged from the Stage 0 baseline.

3. **Stage 2 — skeleton loading states across 10 screens** — added
   `src/components/ui/Skeleton.tsx` (a flat `animate-pulse` bar on the
   `bg-line` token, so it flips correctly under the light theme) and
   replaced the plain `Loading…` text line in `PlayerRoster`,
   `SessionPlanner`, `TeamManagement`, `PlayerNotes`, `CalendarGrid`,
   `DrillLibrary`, `DrillPreview`, `TacticBoard`, `DashboardPage` and
   `AttendancePage` with skeletons shaped like each screen's real rows.
   The one that mattered most is `SessionPlanner`: its 7-day week
   scaffold renders regardless of load state, so every day used to read
   "No session" while the first fetch was still in flight — actively
   telling the coach they had an empty week. `AttendancePage` carried the
   same class of bug ("No sessions this week") and is now guarded the
   same way.
   Every skeleton is gated on `loading && list.length === 0`, never on
   the loading flag alone: those flags are shared with writes
   (`drillsLoading` fires on every canvas dragend), so a flag-only gate
   would flash placeholders during ordinary editing.
   Accessibility: the bars are `aria-hidden`, and each call site carries
   `role="status"` + `aria-busy` + an `sr-only` label so the announcement
   the removed visible "Loading…" text used to provide still happens. In
   `SessionPlanner` those attributes go on the `<ul>` itself and are
   dropped once loaded — a `<span>` isn't valid inside `<ul>`, and a
   permanent `role="status"` there would announce every later edit.
   **Deliberately left as text**: the whole-app auth gate in `App.tsx`
   (no page shape to stand in for yet) and `SessionDrillsPanel`'s
   `Attaching…`/`Saving…`, which are write states — a skeleton says
   "content is coming", not "your click is processing".
   **Verified**: clean build; lint shows the same 5 pre-existing warnings
   and no new ones.
   **Not verified live** (honest gap): the skeletons have not yet been
   watched rendering in a browser — that needs a logged-in session, so
   it's folded into the single Stage 5 walkthrough rather than asking for
   a login at every stage. Low risk to defer: the colour is a one-line
   change in `Skeleton.tsx` if it reads wrong, since all 10 consumers
   inherit it.

4. **Stage 3 — persistent icon-rail sidebar** (`AppShell.tsx`) — the
   desktop tab strip that lived inside the sticky top bar is gone,
   replaced by a fixed `<aside>` pinned below that bar at `lg:`+
   (`w-16`, icon-only, `z-20` so the `z-30` header still wins overlaps),
   with `<main>` offset by a matching `lg:pl-16`. `NavList`'s
   `direction` prop went from `'row' | 'col'` to `'col' | 'rail'` — the
   `'row'` branch was the tab strip and became dead once it was removed.
   Mobile is untouched: below `lg` the rail isn't rendered and the
   hamburger drawer is still the only nav, which is also how the Supabase
   Studio rail this was adapted from behaves at phone width.
   Rail links have no visible text, so each carries an explicit
   `aria-label` on top of the existing `title` tooltip — `title` alone is
   an unreliable accessible name.
   Targets are 44px square, not Studio's much tighter rail: adopting the
   pattern, not the all-day-desktop-tool density, since Gaffer is used
   pitch-side on a touch screen.
   **This deliberately overrides a settled decision** — `DESIGN.md` and
   `CLAUDE.md` both stated there was no permanent sidebar. Both were
   updated in the same commit to describe the rail and to record the
   reversal as intentional rather than quietly rewriting them; the
   earlier choice was deliberate too and deserves to stay legible.
   **Verified**: clean build, lint unchanged (same 5 inherited warnings),
   no `direction="row"` references left anywhere.
   **Not verified live yet** — same reason as Stage 2, folded into the
   Stage 5 walkthrough.

5. **Stage 4 — shadow-based focus ring** (`src/index.css`) — the global
   `:focus-visible` rule went from `outline: 2px solid var(--color-accent)`
   to a `box-shadow` glow, `0 0 0 3px` of the accent at 30% via
   `color-mix(in oklab, …)` so it tracks whichever theme is active without
   a second rule. A `@media (forced-colors: active)` block hands a real
   `outline` back, because a painted ring disappears entirely under
   Windows High Contrast and `outline: none` would otherwise leave
   keyboard users nothing at all.
   **This deliberately overrides `design.md`'s "never a shadow"**, at
   explicit instruction. `design.md` now scopes that rule to surface
   treatments and records the focus ring as the one carve-out, so it
   doesn't read as licence for shadows on cards or panels.
   **Verified live** in the browser pane at `localhost:5174` by real Tab
   presses: a plain button (`Forgot password?`) resolves to
   `oklab(… / 0.3) 0 0 0 3px` with `outline-style: none`, and the email
   input keeps its own `focus:border-accent` + `ring-2` treatment
   untouched (`border-color: rgb(94, 106, 210)`, the ring's own
   multi-layer shadow stack).

6. **Stage 5 — full logged-in walkthrough** — verified live in the browser
   pane against a signed-in account at `localhost:5174`:
   - **Rail** renders at 1280 (`display: flex`), is `display: none` at
     375, and flips theme correctly — light mode gives it
     `bg #ffffff` / `border #e4e4e7`, i.e. the `--color-panel` /
     `--color-line` tokens, not hardcoded values.
   - **Mobile drawer is untouched**: opens on the hamburger and still
     lists all seven labelled links. The rail's own links come back as
     empty text content, which is the icon-only variant behaving as
     designed — their names come from `aria-label`.
   - **Roster skeleton** captured rendering: four rows matching the real
     five-column `ROW_GRID` shape.
   - **SessionPlanner skeleton** captured with `role="status"`,
     `aria-busy="true"`, `aria-label="Loading sessions…"`, seven bars
     (one per day) and — the actual point of the fix — **zero** "No
     session" strings on screen during load.
   - **Focus ring** (from Stage 4) confirmed by real Tab presses.
   Both themes checked; the theme was left back on dark, matching what
   was stored before the walkthrough.

7. **Post-sign-off change — the rail now auto-hides** — asked for at
   review, before anything was pushed. The rail no longer holds a column
   open: it sits off-canvas at `-translate-x-full` and slides in when the
   cursor reaches an invisible `w-4` strip pinned to the left edge,
   overlaying content instead of displacing it. `<main>`'s `lg:pl-16`
   is gone, so the page is full-width and never shifts.
   Worth noting this *resolves* rather than deepens the tension with the
   old "no permanent sidebar" rule — that rule existed so nothing would
   reserve screen width, and an auto-hiding rail keeps that true. Both
   `design.md` and `CLAUDE.md` were updated to say so.
   Implementation is pure CSS off a `group`, no React state. Two
   non-obvious bits: the wrapper is `pointer-events-none` (strip and rail
   re-enable it for themselves) so the hidden rail's column doesn't
   swallow clicks meant for content underneath, and `group-focus-within`
   runs alongside `group-hover` because a keyboard user never generates a
   hover — without it, tabbing would move focus into a rail that stays
   off-screen and the nav would be unreachable without a mouse.
   **Verified live** at 1280: hidden by default (`translate: -100%`,
   `getBoundingClientRect().x === -64`), slides to `x === 0` on left-edge
   hover, returns off-canvas on leave, and reveals on programmatic focus
   of a rail link (`:focus-within` true, `translate: 0px`). `<main>`
   confirmed at `padding-left: 0px`. At 375 the wrapper is
   `display: none` and the hamburger is present — mobile and tablet get
   the drawer only, as asked.

8. **Rail shows labels, and the hover target got bigger** — also asked
   for at review, still nothing pushed. The rail went from a `w-16`
   icon-only strip to a `w-56` panel with icon + text per item, and the
   invisible reveal strip from `w-4` to `w-10` (an unmarked target has to
   be forgiving enough to hit without aiming).
   Adding labels collapsed the rail's shape into the drawer's, so
   `NavList`'s `'col' | 'rail'` split and its `navLinkClass(direction)`
   parameter were removed rather than left as a variant with one caller —
   both surfaces now render the same list. The per-link `aria-label`
   added when the rail was icon-only is gone too: visible text names the
   link, so it was redundant.
   **Verified live** at 1280, full cycle: hidden by default
   (`translate: -100%`, `x === -224`) → hovering the 40px strip reveals
   it (`x === 0`, 224 wide, labels rendered) → moving away hides it again
   (`x === -224`). `<main>` stays at `padding-left: 0px` throughout.

9. **Theme toggle no longer flickers** — reported at review. Traced it
   first, rather than guessing: instrumented the toggle with a
   `MutationObserver` on `data-theme` and polled `body`'s computed
   background across the click. Result was a single, clean attribute
   write with no thrashing, no delayed re-render, no StrictMode
   double-toggle — the toggle logic itself was never the bug. The real
   cause was `index.css` having zero `transition` on any color property
   anywhere, so every `--color-*` token (body, panels, borders, text, the
   `panel-edge` highlight) swapped in one synchronous instant. That
   all-at-once hard cut is what read as a flicker.
   Fix is a `@layer base` rule transitioning
   `background-color`/`border-color`/`color`/`box-shadow` at 0.15s on
   `*, ::before, ::after`, plus an unlayered `prefers-reduced-motion:
   reduce` override (unlayered so nothing can out-rank it, same reasoning
   as the forced-colors fallback in Stage 4). `@layer base` is the reason
   this stays surgical rather than a blunt `*` rule: Tailwind's own
   `transition-colors` utilities live in `@layer utilities`, which always
   wins over `base` regardless of source order, so anything that already
   declares its own transition (every button, every nav link) keeps its
   own property list and timing untouched — verified directly on a rail
   link, whose computed `transition-property` still reads Tailwind's full
   list (`color, background-color, border-color, outline-color,
   text-decoration-color, fill, stroke, --tw-gradient-*`) rather than
   mine. Only elements with no transition utility at all — the surfaces
   that were actually snapping — pick up the new one.
   **Not verified by literal pixel-sampling mid-animation**: polling
   `getComputedStyle` during the transition only ever caught the
   already-settled value, since tool round-trip latency (~700ms+ per
   call) is far coarser than the 150ms transition window. What's
   verified instead: the transition-property/duration compute correctly
   on both a plain div (picks up the new rule) and a rail nav link
   (correctly keeps Tailwind's own, confirming the layer precedence
   actually holds); the mechanism itself is standard, well-established
   CSS behavior once those two facts are true.

10. **The one card that still snapped** — reported at review: the "Test
    U12 Reds" team card on the Coach Dashboard didn't smooth out with
    everything else. Cause was the interaction between two things that
    were each individually correct: this `Card` (and `StatCard` on
    `TeamOverviewPage`, same shape) carries its own `transition-colors`
    for its hover tint, and Tailwind utilities in `@layer utilities`
    completely win over the `@layer base` rule from the previous fix —
    not merge with it. `transition-colors`' property list doesn't include
    `box-shadow`, so on these two cards specifically, `panel-edge`'s
    theme-varying highlight (`inset 0 1px 0 rgba(255,255,255,.05)` dark
    vs `rgba(0,0,0,.04)` light) was left out of any transition and kept
    snapping while the border and background around it faded.
    Fix: removed `transition-colors` from both — it was redundant, since
    `@layer base` already covers `background-color`/`border-color`/
    `color` at the same 0.15s, and additionally covers `box-shadow`.
    One small, accepted trade: Tailwind's default easing is
    `cubic-bezier(0.4, 0, 0.2, 1)`, `@layer base`'s is
    `cubic-bezier(0, 0, 0.2, 1)` — close enough at 150ms to be
    imperceptible, not worth keeping two systems over.
    **Verified live**: computed `transition-property` on the Dashboard
    card now includes `box-shadow`; toggling themes updates its
    `panel-edge` shadow value correctly in both directions; hover classes
    confirmed still present and unaffected.

11. **Rail redesigned again — from auto-hide to expand-in-place** — the
    previous session added a click-to-close handle to the auto-hiding
    rail; that was rolled back at the start of this one (`git reset
    --hard 249dba1`, clean history, nothing had been pushed) in favor of
    a different pattern entirely, shown via reference screenshots of a
    Vercel-style sidebar: icons permanently visible at rest, no
    off-canvas state, widening in place on hover to reveal labels.
    `AppShell.tsx`'s `<aside>` now rests at `w-16` and grows to `w-56` on
    `hover:`/`focus-within:` via a plain `transition-[width]` — no React
    state at all, simpler than either of the two previous versions.
    `<main>` carries a permanent `lg:pl-16` matching the *resting* width;
    the wider hover state overlays on top rather than pushing content,
    since the rail is `fixed` and out of document flow.
    `NavList` gained a `fadeLabel` prop, used only by the rail. It wraps
    the label in a span that's `opacity-0` until the ancestor `.group`
    (the aside itself) is hovered/focus-within — this turned out to be
    necessary, not decorative: overflow-hidden alone left a stray sliver
    of each label's first letter visible at rest (the label text
    overflows past 64px regardless of opacity; clipping just cuts off
    however much of it doesn't fit, and a normal-opacity fragment inside
    the visible 64px still renders). Fading the label's opacity to 0
    makes that same fragment fully transparent instead.
    **On the width-reservation question, worth being explicit about**:
    this version genuinely reserves 64px of screen width permanently,
    which the immediately-prior auto-hiding version specifically
    avoided. That's a real step further than before, not a return to
    where things started — recorded in `design.md`/`CLAUDE.md` as such.
    **Verified live**: rests at 64px with labels at `opacity: 0`
    (confirmed via computed style, not just visually — the very bug
    being fixed was subtle enough that a screenshot alone wasn't
    trustworthy); widens to 224px on hover and retracts on mouse-out;
    Tab-focusing a link widens it and blurring retracts it; `<main>`
    stays at a constant `padding-left: 64px` regardless of hover state;
    mobile drawer's own labels (a separate, non-faded `NavList` call)
    unaffected — confirmed they still render plainly.

12. **Team selector moved from top-right to top-left, as a breadcrumb off
    "Gaffer"** — asked for at review, with a reference screenshot of a
    Vercel-style org-switcher breadcrumb (`logo / org name ⌄`). This is
    the **second** reversal of the same decision: `design.md` already
    recorded a prior top-left attempt that was walked back to top-right
    specifically because it competed with "Gaffer" for the same
    "where am I" role. Flagged that history before making the change,
    then proceeded on explicit instruction with a concrete reference —
    same pattern as the sidebar-rail and focus-ring overrides earlier
    this session.
    No new component: `TeamSwitcher compact` (unchanged) now renders
    after a plain `/` separator glyph directly following `BrandBlock`,
    instead of in the right-hand cluster next to the theme toggle. Same
    `inTeamContext` gate as before (team-scoped routes only) and same
    `lg:`-only visibility — mobile still gets team switching via the
    drawer's own full `TeamSwitcher`, untouched.
    **Verified live**: on a team-scoped desktop route, header reads
    "Gaffer / Test U12 Reds"; on a coach-level route (`/`), just "Gaffer"
    with nothing after it; at 375px, neither the separator nor the
    switcher render at all. Only one team exists on the test account, so
    `TeamSwitcher`'s own 2+-team `<select>` branch (unchanged code,
    already relied on before this move) wasn't exercised live here.

13. **Team selector redesigned as a real trigger+popover** — asked for at
    review with a reference screenshot of a Vercel-style project switcher
    (bordered pill trigger, opens to a searchless list with a checkmark
    on the active item and a "+ New" action). `TeamSwitcher`'s `compact`
    mode (`src/components/TeamSwitcher.tsx`) gained a new
    `CompactTeamMenu` — a real popover with its own `open` state,
    dismissed on outside click (`pointerdown` on `document`, checking
    `containerRef.current.contains`) or Escape, rather than a styled
    native `<select>`. No existing click-outside pattern existed
    anywhere else in the codebase to reuse; this one is small and
    self-contained rather than a new shared utility, since nothing else
    needs it yet.
    Skipped the reference's search box on purpose — Gaffer's `Team`
    table has no realistic path to the list sizes that make searching a
    project switcher worthwhile, and adding it would be exactly the kind
    of unrequested "flexibility" the project's own guidelines call out.
    **Then asked to go further**: the popover should be available at 0
    and 1 team too, not just 2+. Originally `compact` short-circuited to
    `null` (0 teams) or plain unclickable text (1 team) before ever
    reaching the multi-team branch — moved the `compact` check to the
    very top of `TeamSwitcher` so `CompactTeamMenu` now owns every team
    count itself: the trigger falls back to "Select team" text when
    nothing is selected (0 teams — `teams.find(...) ?? teams[0]` both
    sides undefined), and the panel body swaps between the real list and
    a plain "No teams yet" line depending on whether `teams.length > 0`.
    The non-compact drawer block was deliberately left branching on
    count, unchanged — a bare `<select>` genuinely has nothing useful to
    render for 0 or 1 option, unlike a popover that can always offer
    "+ New team".
    **Verified live** against the real 1-team test account: clicking the
    header pill opens a panel showing "Test U12 Reds" with a checkmark
    plus "+ New team" below it (previously just inert text); a click
    outside the panel closes it (`role="listbox"` element gone from the
    DOM afterward); Escape closes it the same way; clicking "+ New team"
    navigates to `/teams` and closes the panel in the same action; the
    mobile drawer's own `Team` block still renders as plain text,
    confirming the non-compact path is untouched. The 0-team empty state
    (`teams.length === 0` inside the panel) was verified by reading the
    ternary rather than forcing it live — no safe way to zero out the
    real test account's one team just to look at it, and the branch
    itself is a one-line conditional with nothing left to go wrong once
    the surrounding trigger/panel mechanics were already confirmed
    working against real data.

14. **Team selector extended to the Dashboard** — asked for at review:
    show it on the main Dashboard too, right after login, rather than
    only on team-scoped pages. `AppShell.tsx` gained a
    `showTeamSelector` boolean (`inTeamContext || pathname === '/'`),
    replacing the bare `inTeamContext` check the breadcrumb block used —
    `Teams` and `Calendar`, the other two coach-level routes, were
    deliberately left alone, since only the Dashboard was asked for.
    `CompactTeamMenu`'s empty-state trigger text changed from "Select
    team" to "No team selected" (muted ink, `text-ink-muted`, vs. the
    normal `text-ink` a real team name gets) — the Dashboard is exactly
    where a coach would land with nothing chosen yet, so this is a
    status readout more than an instruction now, and the visual
    distinction says "this is a state, not a name" at a glance.
    **Verified live**: the breadcrumb now renders on `/` with the real
    team name and opens the same working popover there; `/teams`
    confirmed to still have no `[aria-haspopup="listbox"]` trigger in
    its header at all, i.e. genuinely unaffected, not just visually
    similar.

15. **Teams page toolbar rebuilt after a Supabase Studio "Projects" list
    reference screenshot** (`TeamManagement.tsx`) — asked for at review:
    search, sort, grid/list view toggle, and a "New team" action, styled
    like the reference's project-list toolbar. Status filtering from
    that reference was explicitly dropped — teams have no status field.
    Added: a search input (client-side `name` substring filter over the
    already-loaded `teams` array — no new fetch), a `<select>` sort
    control (Name / Player count / Newest first, the last two reading
    `useTeamSummaries` and `created_at`), a grid/list view toggle
    (`LayoutGrid`/`List` icon buttons, active state reusing the same
    `bg-accent/15 text-accent` treatment as nav active state), and a
    "New team" button that now toggles the existing `CreateTeamForm`
    into view instead of showing it permanently under the list. Grid
    mode keeps the existing `TeamCard`; list mode is a new `TeamRow`
    component. Both share one `useTeamCardState` hook (name/editing/
    saving/confirm-delete state) rather than duplicating that logic
    twice, since the edit/delete flow itself didn't change, only the
    layout on top of it. A no-results empty state (`EmptyState`, reusing
    the search icon) covers "search matches nothing" as a state distinct
    from "no teams at all" (still the loading skeleton / a truly empty
    list falling through with no matching block).
    **Verified live**: typing a non-matching query shows the empty
    state and clears correctly; grid↔list toggle re-renders the same
    team data in both layouts; "New team" opens/closes the form without
    losing entered text on a stray re-render; confirmed at 375px (mobile
    hamburger drawer unaffected — this page has no rail) and in both
    themes. Build and lint clean, no new warnings.

16. **Every dropdown in the app converted to one shared popover
    component** (`src/components/ui/Dropdown.tsx`, new) — asked for at
    review after a Vercel/Studio-style org/project-switcher screenshot:
    make every dropdown look like the team switcher's popover (trigger
    button, optional search, checkmarked option list, optional footer
    action), not just the team switcher itself. `Dropdown` generalizes
    what used to be `TeamSwitcher`'s bespoke `CompactTeamMenu` — same
    dismissal behavior (click-outside/Escape via a document
    `pointerdown` listener), same visual language — into a reusable
    `{value, onChange, options, placeholder, searchable, footer,
    ariaLabel}` component. Every native `<select>` in the app now uses
    it: `TeamSwitcher` (both the compact popover and the drawer's 2+-team
    case), `TeamManagement`'s sort control (entry 15), the drill pickers
    in `SessionDrillsPanel` and `DrillPreview`, `DrillPreview`'s pitch
    size/orientation pickers, `AvailabilityPanel`'s status picker, and
    `TacticBoard`'s tactic picker. Zero `<select>` elements remain
    anywhere in `src/` (`grep -rn "<select" src` returns nothing but
    comments referencing the old pattern).
    The search box is conditional, not universal: it only renders above
    `SEARCH_THRESHOLD` (6) options unless a caller forces `searchable`
    either way. A 3-item status or pitch-size picker has nothing worth
    filtering and a search box there is just friction — but the team
    switcher forces `searchable` on regardless of team count, to match
    the reference screenshot exactly even at 0/1 teams.
    One lint fix needed along the way: the first draft reset the search
    query inside the same `useEffect` that wires up the dismissal
    listeners (`setQuery('')` on open), which oxlint's
    `react(set-state-in-effect)` flagged as a new warning — moved the
    reset into the trigger's own `onClick` instead, so it only fires on
    the actual user action that opens the popover rather than as a
    render-triggered side effect.
    `design.md`'s Components section documents `Dropdown` as the
    standing convention — any future single-choice control should reach
    for it rather than a plain `<select>` or another bespoke popover.
    **Verified live**: exercised every converted picker in the browser
    (Teams sort, Dashboard/drawer team switcher — including the
    always-on search box and "+ New team" footer, Design's drill/pitch
    size/orientation pickers, Tactics' tactic picker, an availability
    status picker, and the session drill-attach picker with 8 drills to
    confirm the search box appears once past the threshold and stays
    hidden on short lists). Checked both themes; confirmed
    build + lint clean with no new warnings beyond the two pre-existing
    ones. Not pushed yet — commit is local only, part of the same
    uncommitted-at-time-of-writing change as this entry.

17. **Rail's hover-expand fixed to stop partially overlapping content**
    (`AppShell.tsx`) — reported at review with a screenshot: at narrower
    desktop/tablet widths the expanded 224px rail didn't clear all of
    `<main>`, so the overlap read as a layout bug (clipped text, a
    floating tooltip visible mid-screen) rather than an intentional
    flyout. Asked to pick one of two fixes — cover content cleanly, or
    don't expand far enough to block it — and chose the former, since it
    preserves the hover-to-reveal-labels behavior rather than removing
    it. Added a `pointer-events-none` backdrop (`bg-black/50`, matching
    the mobile drawer's own backdrop) that fades in alongside the rail's
    width transition. Both live inside a new wrapping `.group` div — the
    hover/focus target moved from the `<aside>` itself to this wrapper,
    since the backdrop is a sibling of the aside, not a descendant, and
    needs to react to the same hover/focus state. The backdrop being
    `pointer-events-none` is what keeps it from getting out of sync with
    the rail: it can never itself become the hover target, so the group's
    hover state is still driven purely by the rail, and clicks on
    `<main>` pass straight through once the rail's collapsed.
    Immediate follow-up in the same review: "still want the side rail to
    be slightly thinner, so its not flush with main screen content" —
    shrunk the rail one Tailwind step at both ends (resting `w-16`→`w-14`,
    expanded `w-56`→`w-52`) while leaving `<main>`'s `lg:pl-16` reservation
    unchanged, so there's now an 8px sliver of plain background between
    the rail's resting border and where content starts, instead of the
    two sitting flush against each other.
    **Verified live**: at 1040px width (narrow enough that the old
    version showed the reported bug), hovering the rail now dims the
    rest of the page cleanly with no visible seam or clipped text behind
    it; moving off collapses both the rail and the backdrop back in
    sync; clicking a team card behind the collapsed rail still works
    (backdrop doesn't swallow clicks once faded out). Checked in both
    themes. Confirmed the mobile drawer is untouched — this only
    changes the `lg:`+ desktop block. Build + lint clean, no new
    warnings.

18. **Calendar's time-axis scale was never actually fixed — it silently
    shrank to fit whatever sessions existed** (`CalendarWeekView.tsx`,
    `CalendarDayView.tsx`) — reported at review: "the scale is off when
    sessions are inputted, should be consistent no matter what."
    Root cause: both views compute `pxPerMin = GRID_HEIGHT_PX /
    (rangeEndMin - rangeStartMin)`, where the range grows to cover any
    session outside the default 08:00–20:00 window (an early or late
    start), but `GRID_HEIGHT_PX` stays a fixed 640px. So a single 06:00
    or 21:00 session compressed *every* session that week — a 60-minute
    session could render taller or shorter depending on what else was on
    the calendar, in either view, independently of each other (a session
    could even look a different height in Day view vs. Week view for the
    same reason). Fixed by inverting which side is fixed: `PX_PER_MIN`
    is now a module-level constant, derived once from the same default
    08:00–20:00/640px baseline and never recomputed from session data.
    The grid's rendered height (`gridHeightPx`) is now the derived value
    instead — `(rangeEndMin - rangeStartMin) * PX_PER_MIN` — so an
    outlier session makes the grid taller (more to scroll) rather than
    denser. Both views use the identical constant (same `GRID_HEIGHT_PX`
    and default-range values), so a session now renders at the same
    height in Day view, Week view, and regardless of what else is
    scheduled that week. `layoutDayColumn` (`calendarLayout.ts`) itself
    needed no change — it already just took `pxPerMin` as a parameter,
    it's the two views that were computing that parameter wrong.
    **Verified live**: created a test session at 06:00 (a Supabase test
    row, deleted after — see below) alongside the existing 18:00/90min
    and 17:30/60min sessions; confirmed those two rendered at pixel-
    identical height and position before and after adding the outlier,
    and that the grid grew taller (a visible 06:00 slot at the top) with
    a scrollbar rather than compressing anything. Cleaned up the test
    row directly via the Supabase MCP server (`execute_sql`) since there
    is no delete-session affordance in the UI at all — worth knowing for
    next time a session needs removing during testing. Build + lint
    clean, no new warnings.

    **Follow-up in the same review — this wasn't actually the main
    complaint.** Clarified: "even when there is no session there are
    still times listed on the y axis — this stays the same no matter
    what." The real bug was the y-axis *label set*, not (only) pixel
    height: both views generated labels from `presentTimes` — the exact
    start times of whatever sessions existed — falling back to a fixed
    `['08:00','12:00','16:00','20:00']` only when there were none. So the
    axis showed neat round marks on an empty day/week and a scattered set
    of exact session start times (17:30, 18:00, ...) the moment anything
    was scheduled — a completely different-looking axis depending on
    whether there was data, which is what "the scale is off when sessions
    are inputted" actually meant.
    Fixed by generating labels the same way regardless of data: a fixed
    2-hour interval starting at 08:00 (`08:00, 10:00, 12:00, ...`,
    `LABEL_INTERVAL_MIN = 2 * 60`, both views), stepping forward only as
    far as the range actually extends. An early outlier session still
    grows the grid upward (per the fix above), it just doesn't get its
    own label — the label sequence always starts at 08:00 regardless of
    how early the range now starts. Added `minutesToTime` to `date.ts`
    (the inverse of the existing `timeToMinutes`) so labels can be
    generated as plain minute offsets and formatted at render time,
    instead of manipulating time strings.
    Also fixed in the same pass, same root complaint: `CalendarDayView`
    had an early `if (calendarSessions.length === 0) return <EmptyState
    .../>` *before* rendering the grid at all — so an empty day showed no
    axis whatsoever, the most literal violation of "there are still times
    listed." Moved the empty check inside the grid: the time-axis column
    and the (now dynamically sized) grid always render, with the
    `EmptyState` absolutely centered over the content column only when
    there's nothing scheduled. `CalendarWeekView` never had this problem
    — its axis is shared across the whole week, not per-day, so an empty
    day column already just sat there blank alongside the axis.
    **Verified live**: Day view on an empty day now shows the full
    08:00→18:00+ axis with the "No sessions scheduled" message centered
    over it, in both themes. Re-added a temporary 06:00 Supabase test
    session (deleted after) and confirmed the label sequence still starts
    at 08:00 with no 06:00 label, while the grid still extends upward to
    fit it. Build + lint clean, no new warnings.

19. **Removed "Week of" from the Calendar's Week-view heading**
    (`CalendarGrid.tsx`) — asked for at review. The title now just reads
    the date range itself (`24 Aug – 30 Aug 2026`), matching Day/Month
    view's headings, which were never prefixed with "Day"/"Month" either.

### What Worked

- **Centralising the skeleton's colour in one primitive** means the
  token choice (`bg-line`) is a single-line fix across all 10 screens if
  it turns out to read too strong or too faint in either theme — which is
  what made deferring the visual check to Stage 5 a safe call rather than
  a gamble.
- **Baselining lint before touching anything** immediately paid off — it
  surfaced two `set-state-in-effect` warnings that `CLAUDE.md` doesn't
  document, so they can't later be mistaken for a regression caused by
  this session's changes.

### What Didn't Work / Watch Out For

- **An unlayered CSS rule silently overrides every Tailwind utility.**
  The first version of the Stage 4 focus ring was written at the top
  level of `index.css`, which put it outside any cascade layer — and
  unlayered rules beat layered ones regardless of specificity, so it
  clobbered the form fields' own `focus:ring-2` (Tailwind utilities live
  in `@layer utilities`). It looked fine; the inputs had just quietly
  lost their treatment. Fixed by moving the rule into `@layer base`, so
  utilities win again. The `forced-colors` fallback is deliberately left
  unlayered so nothing can override *it*. Worth remembering for anything
  else added bare to `index.css`.
- **`git add DESIGN.md` does not stage `design.md`.** The file is
  lowercase in git's index but macOS's filesystem is case-insensitive, so
  editing "DESIGN.md" edits the right file while `git add DESIGN.md`
  matches nothing and fails silently — the Stage 3 commit went in without
  the design-doc change and needed an amend. Always use the lowercase
  `design.md`, and check `git status --short` for a stray ` M` before
  committing.
- **`.focus()` from `javascript_tool` does not trigger `:focus-visible`.**
  It sets `document.activeElement` but not the keyboard-interaction
  heuristic, so the rule never matches and the computed style looks like
  the change didn't work. Drive real `Tab` presses with the `computer`
  tool instead — and note a screenshot taken afterwards tends to drop the
  focus state, so read the computed style rather than relying on a
  picture.
- **`npm run dev` won't necessarily be on 5173.** Something already held
  it, so Vite fell back to 5174 while the preview harness reported a
  different port again — read the actual server log for the real URL
  rather than trusting the reported one.
- **Stale HMR CSS will lie to you about the rail.** Mid-session the rail
  read as stuck open — `translate: 0%` with both `:hover` and
  `:focus-within` false, which is impossible from the CSS as written. A
  hard reload put it right, so it was Vite serving stale utility CSS
  after the width classes changed, not a real bug. Hard-reload before
  believing any odd rail state.
- **Read the `translate` property, not `transform`.** Tailwind v4's
  `-translate-x-full` compiles to the standalone `translate` property, so
  `getComputedStyle(el).transform` returns `none` whether the rail is
  open or shut and looks like the class isn't applying. Also allow ~600ms
  before sampling: the 200ms transition means an immediate read after a
  hover usually catches the old value and reads as a failure.
- **Catching a loading state on localhost is harder than it sounds.** A
  fetch against remote Supabase finishes well inside a single tool
  round-trip, so screenshots kept landing on the loaded state. Adding a
  temporary delay inside `runSupabaseAction` didn't help either — Vite
  never emitted an HMR update for that module and kept serving a stale
  transform (component and CSS edits hot-reloaded fine throughout, so the
  watcher itself was working). What did work: temporarily forcing the
  component's own condition (`isInitialSessionLoad = true`), screenshotting,
  then reverting. If you need to see a loading state again, force the
  branch in the component rather than trying to slow the network.
- **A `setTimeout` inside the same `javascript_exec` call that triggers
  the click is not a reliable way to sample post-transition state** — the
  tool's own round-trip latency can exceed the timeout, so the callback
  fires but the *result* gets read stale relative to real wall-clock time.
  Splitting into two separate calls (click, then a fresh query after)
  reads the settled value correctly. Cost about ten minutes of chasing a
  "still broken" result that wasn't real.
- **The click-to-close handle from the previous session was solving the
  underlying request in the wrong shape.** The ask ("show me where nav
  is, let me close it") had a much simpler answer once a concrete visual
  reference (screenshots of a Vercel-style expand-on-hover sidebar)
  arrived: no off-canvas state at all, just a narrow rail that widens in
  place. Worth remembering generally — an implementation that technically
  satisfies a description can still be the wrong shape once a reference
  image suggests a different approach entirely. Not wasted effort though:
  the auto-hide and close-handle versions are still in git history (just
  not on `main`), available if a future request calls for something
  closer to them again.
- **Opacity and `overflow-hidden` solve different problems and don't
  substitute for each other.** Clipping hides whatever extends past a
  boundary; it says nothing about what's rendered *inside* that boundary.
  A label overflowing a narrow rail needs both: `overflow-hidden` for the
  part that extends past the edge, `opacity-0` for the part that
  technically fits within the visible area but was never meant to be
  seen yet — without the second one, the first letter's leading pixels
  render as a stray, meaningless fragment.
- **`CLAUDE.md`'s known-lint-warnings note is incomplete.** It names only
  `react(preserve-manual-memoization)` on
  `SessionPlanner.tsx`/`AttendancePage.tsx`, but the untouched tree also
  emits `react(set-state-in-effect)` on `TacticBoard.tsx:84` and `:93`.
  Both are inherited, not caused by this work — don't chase them
  mid-stage, and don't read them as a regression introduced by a later
  stage.

## Next Steps

- **Pushed and live.** All 14 commits through entry 14 above
  (`32b69f4`..`c355b79`) were pushed to `origin/main` after user sign-off
  — Vercel auto-deploys from `main`, so that push was the deploy.
  Entry 15 (Teams page toolbar) landed in a later session and has **not**
  been pushed yet as of that entry — check `git status`/`git log
  origin/main..HEAD` before assuming it's live.
- Worth knowing before any future push: nothing in the repo actually
  proves the Vercel project is still connected (no `vercel.json`, no
  `.vercel/`, no workflow file, no production URL recorded anywhere). The
  push-to-deploy path comes from the repo owner's own confirmation. If no
  build fires after pushing, that assumption is where to start looking.
- Deferred by decision, not forgotten: the OKLCH hue-tied neutral
  derivation (rework plan Stage 3) — a refinement rather than a fix.
  Studio's 6px radius scale, its dense 12–13px type scale and its 2px
  spacing base all stay excluded; the override instruction covered the
  sidebar and the focus ring only.

---

## Session log — design overhaul, feature import, nav polish, Calendar views

Everything below is committed and pushed to `origin/main`, most recent
last: `bf20e62` → `d1f99cb` → `cf38b6a` → `5d33ac0` → `401f231` →
`5961ea2` → `487b7d3` → `fa38f7c` → `4e2ef87` → `8f4c5d5` → `7477452`
(plus `3209fa9`/`a4d5022`, drill-canvas equipment redesigns, and
`a82a367`/`6812599`/`215661e`/`1a8a503`/`fd4655b`, earlier Design-page
layout work — all before the identity work below). No test suite; every
item verified via `npm run build` + `npm run lint` (clean throughout,
same 4 known pre-existing warnings as the upgrade section above) plus a
live logged-in Browser-pane walkthrough on a fresh tab.

### What happened, in order

1. **Drill-canvas equipment redesign** (`3209fa9`, `a4d5022`) — cone
   redesigned to match reference photos, ending on a flat-base classic
   cone (`WITCHES_HAT` in `pitchTheme.ts` simplified to a single fill
   color, `PitchCanvas.tsx`'s render rebuilt as a tapered `Line` body +
   rounded `Rect` base). Label changed "Witches' hat" → "Cone" in
   `DrillPreview.tsx`.
2. **Claude Code skills** — searched GitHub for popular, genuinely
   verified (real star counts, not blog-farm) skills relevant to this
   project; installed 4 recommended sources into `~/.claude/skills/` at
   the user's request. Tooling-level change, not app code — nothing to
   verify in-app.
3. **Touchline redesign** (`bf20e62` → `d1f99cb` → `cf38b6a`) — first
   full UI identity pass via `/frontend-design`: amber accent, Oswald
   display type, a chalk-line signature motif. The motif itself went
   through several live A/B/C/D/E comparisons before landing on a solid
   double rule (option "D"), then was carried through every page.
   `design.md` created (`5d33ac0`) as the binding design-system
   reference, with `CLAUDE.md` updated to require reading it before any
   UI work. `401f231` added matching `:focus-visible` states app-wide.
4. **Full replacement to a Linear-inspired system** (`5961ea2`) — the
   touchline identity was fully discarded (not blended) for a
   near-black-canvas, lavender-blue-accent (`#5e6ad2`), hairline-border,
   single-voice-Inter system with no signature motif — confirmed via
   `AskUserQuestion` as "full replacement," not a merge of the two.
   `design.md` and `CLAUDE.md` rewritten to match; this is the design
   system still current as of this log.
5. **DesignSync feature import** (`487b7d3`) — imported and read a
   Claude Design mockup project via the DesignSync MCP tool
   (`get_project`/`list_files`/`get_file`, read-only), but per explicit
   instruction ("keep the current ui theme etc, just use this ui design
   as inspiration to improve and update features") extracted only a
   genuine **feature** idea — an animated drill-phase preview in the
   Drill Library (auto-advancing `PitchCanvas` preview, Play/Pause) —
   and left the Linear visual system untouched. `key={phase.id}` used on
   the preview's `PitchCanvas` to force clean remounts across rapid
   state-driven prop changes.
6. **Nav/theme/copy polish** (`fa38f7c`, corrected by `4e2ef87`) — five
   concrete changes: "Gaffer" wordmark always top-left across every
   route (`BrandBlock` in `AppShell.tsx`); team name confined to the
   header's right-hand cluster (`TeamSwitcher compact`, desktop-only,
   team-scoped routes only) — **I initially placed it top-left next to
   "Gaffer" by mistake, the user corrected "team name top right actually
   not top left," fixed in `4e2ef87`**; a dark/light theme toggle button
   top-right (new `useTheme()` hook in `src/hooks/useTheme.ts`,
   `data-theme` attribute + `<meta name="theme-color">` + `localStorage`
   under key `gaffer-theme`, FOUC-prevention inline `<script>` in
   `index.html`'s `<head>` reading `localStorage` before first paint);
   "Dashboard" renamed to "Coach Dashboard" (`DashboardPage.tsx`); team
   overview page title renamed to `"<team name> Dashboard"`
   (`TeamOverviewPage.tsx`). `index.css` gained a full
   `:root[data-theme='light']` override block (re-maps the same
   `--color-*` custom properties Tailwind utilities already read, so no
   component classes needed to change).
7. **Realistic test data** — seeded across every section (players,
   sessions, availability, drills with full jsonb phase content,
   session_drills, tactics, player notes) via the Supabase MCP
   (`execute_sql`), **scoped entirely to `team_id =
   'b4ec3149-6ce9-4252-8c42-d3f105322f53'` ("Test U12 Reds")** — audited
   `team` table ownership first to confirm no other real user's team
   data was touched. No migration/commit for this (direct data, not
   schema). One self-introduced bug found and fixed in the same pass:
   some seeded `availability` rows had `status = 'unconfirmed'` but a
   non-null `responded_at`, contradicting the app's own invariant
   ("responded" = has a `responded_at`); fixed via two `UPDATE`s (null
   out `responded_at` where unconfirmed, backfill it where a status
   implies a response but the timestamp was missing).
8. **"Test for any bugs" — started, PAUSED, not resumed.** See "Next
   Steps" below — this is the one open thread from this log.
9. **Mobile back arrow** (`8f4c5d5`) — `BackButton` in `AppShell.tsx`,
   mobile-only (`lg:hidden`), plain `navigate(-1)`, hidden on `/` (the
   landing screen). Verified: correct show/hide by route, functional
   back-nav, hidden at true desktop width (see the `resize_window` note
   under What Didn't Work).
10. **Calendar Day/Week/Month view toggle** (`7477452`, most recent) —
    Calendar previously only had the one week grid. Extracted it as-is
    into `src/components/calendar/CalendarWeekView.tsx`, added
    `CalendarDayView.tsx` (single-column time grid, fuller session
    cards, empty state) and `CalendarMonthView.tsx` (6-week grid,
    session chips per cell, today circled in accent), plus a
    Day/Week/Month segmented toggle in `CalendarGrid.tsx`'s header next
    to Prev/Today/Next. `CalendarGrid.tsx` now owns one `anchorDate` +
    `view` state; Prev/Next step by the active view's unit (day/week/
    month) and switching views keeps the same anchor. Added
    `startOfMonth`/`addMonths`/`formatMonthLabel`/`isSameDay` to
    `src/lib/date.ts`; `fetchSessionsForWeek` (sessionSlice.ts) reused
    unchanged — despite its name it already took an arbitrary
    `[startISO, endISO]` range, so no store change was needed for the
    new views. Verified live: all three views render correct sessions
    for the seeded test data, Month highlights today correctly, Day's
    empty state shows on a day with nothing scheduled, view-switching
    preserves the anchor date, zero console errors, build/lint clean.

### What Worked

- **`AskUserQuestion` for big, genuinely ambiguous design calls** — used
  once to settle "full replacement vs. blend the two systems," picked
  cleanly by the user rather than being guessed at.
- **DesignSync import scoped to "extract one feature idea, discard the
  visual system"** — reading a whole mockup project but deliberately
  taking only what the user actually asked for (a feature, not a
  restyle) avoided an unwanted second theme swap.
- **Auditing `team` ownership before seeding any test data** in a shared
  Supabase project — confirmed no other real user's rows would be
  touched before writing a single row, then kept every seed scoped to
  one `team_id`.
- **Fresh Browser-pane tab as the fix for stale-HMR false-positive
  console errors** — recurred again this session (long-lived tabs
  showing errors for identifiers that were actually fine); a fresh tab
  reliably resolved it every time, consistent with the pre-existing
  pattern from the upgrade phases above.
- **`resize_window`'s explicit `{width, height}` over the "desktop"
  preset** — the preset quirkily caps around ~605px; passing
  `{width: 1280, height: 800}` explicitly is the only reliable way to
  test true desktop width in this environment.

### What Didn't Work / Watch Out For

- **`design.md` got overwritten mid-session** with unrelated content
  (most likely a side effect of the `frontend-design` plugin skill's own
  tooling) — caught only because a follow-up `Edit`'s `old_string`
  failed to match; restored via `git show <prior-commit>:design.md` and
  reapplied the pending edit on top. **Worth a sanity check on
  `design.md`'s contents after any `/frontend-design` invocation**, not
  just trusting the diff looks plausible.
- **`replace_all: true` silently missed occurrences with different
  leading whitespace** — `DashboardPage.tsx` had two `PageHeader
  title="Dashboard"` lines at 8-space and 6-space indent; the string
  match only caught one. Caught via a grep verification pass after the
  edit, not before — grep for the expected occurrence count *before*
  trusting a `replace_all` result on anything with inconsistent
  indentation.
- **Misread "team name top right" as "top left" on the first pass** —
  implemented it next to "Gaffer," the user corrected it in the very
  next message. No structural cause, just worth re-reading nav-placement
  requests carefully since "top-left/top-right" instructions are easy to
  transpose while implementing multiple nav changes in one batch.
- Browser-pane `computer` screenshot timeouts ("pane not
  displayed/hidden") continued to show up intermittently (mobile drawer,
  Calendar, back-button testing) — same non-bug pattern documented in
  the upgrade section above; `read_page`/`get_page_text`/`javascript_tool`
  remain the reliable fallback.

## Next Steps

**Resume "test for any bugs" — the one real open thread.** The user
explicitly asked for a bug-testing pass; I covered Dashboard, Teams,
Calendar, Roster (Notes toggle), and part of Sessions (Drills panel,
attach-drill, reorder) before they interrupted to ask for a status
update. I asked "keep going through the rest, or pause here?" — **they
never answered that question**; they gave two unrelated requests instead
(mobile back arrow, then Calendar views), both now done. **Do not
silently resume the bug sweep** — ask the user first whether they still
want it, since their attention has moved elsewhere twice since it was
paused. If they do, the still-untested areas are: Attendance
status-cycling, session edit/duplicate/delete, the Design canvas (phase
management, drag-and-drop tool placement), Drill library search, Tactics
(create/place-player/arrows), the dark/light toggle round-trip, mobile
drawer nav, plus a general console-error sweep across all of those.

Other open threads, not urgent, surface only if they come up naturally:
- Calendar Day/Month views (flagged as a gap in the upgrade-phase
  mobile audit) are now **done** as of this log — no longer open.
- Test data lives only on `team_id = 'b4ec3149-6ce9-4252-8c42-d3f105322f53'`
  ("Test U12 Reds") — never seed or modify any other team in this shared
  Supabase project without the user's say-so.
- `_to_delete/` (both at this repo root and the outer
  `/Users/max/Desktop/app/_to_delete/`) remains deliberately untouched —
  never added to a commit, never deleted, absent explicit instruction.

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
