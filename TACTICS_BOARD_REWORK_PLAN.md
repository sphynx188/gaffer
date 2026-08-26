# Tactics Board Rework Plan: Gaffer → Teloframe-class tactics board

**Current app:** `gaffer/` — React 19 + Vite + TS + Zustand 5 + Supabase + Tailwind v4 + Konva/react-konva.
**Current tactics creator:** `src/components/tactics/TacticBoard.tsx` (478 lines), `src/store/slices/tacticSlice.ts` (226 lines), routed at `/tactics` (`App.tsx:85`, `AppShell.tsx:54`).
**Target:** the tactics board at `https://teloframe.com/board`, analysed live on 2026-08-26 — 12-step guided tour walked end to end, full keyboard-shortcut reference extracted, every tool/formation/inspector panel opened, dual view and the Add Phase dialog exercised.
**Scope note from the user:** *"changes can be as drastic as needed. Colours don't matter too much but functionality is very important."*

---

## 0. The one thing that matters

**The drill creator rework is already done, and it built most of this board.**

Stages 1–11 of `DRILL_CREATOR_REWORK_PLAN.md` are shipped — `ce0aa59` through `a83333a`, plus fixes. That work produced, and the tactics board can consume as-is:

| Already built | Where | What it gives tactics |
|---|---|---|
| `scene` / `keyframes` entity-timeline model | migration 013, `types.ts` | stable entity identity across time |
| `frameAt(scene, keyframes, t)` | `canvas/interpolate.ts` | the pure keyframes→renderable-frame resolver |
| `PitchCanvas` on `RenderFrame` | `PitchCanvas.tsx` | selection, marquee, drag-group, transform, zoom |
| Timeline: playback, scrub, onion skin, per-segment speeds | `design/timeline/*` (9 files) | the entire animation surface |
| 35 pitch presets on real metres | `canvas/pitchPresets.ts` | pitch config + overlays |
| 11 equipment types, markings tools, properties panel | `design/editor/*` | drawing + inspector patterns |
| Export PNG/GIF/PDF + share token | `design/export/*`, migration 018 | every way out of the app |
| Onboarding tour | `editor/onboarding/*` | the tour pattern, anchors included |

**The tactics board is stuck half-migrated.** `tactic.board` is still the pre-rework shape — `{ players: TacticPlayer[], arrows: PhaseArrow[], annotations: PhaseAnnotation[] }`, no keyframes, no timeline, tap-to-place. It already *renders* through the new `PitchCanvas`, but only via a hand-rolled adapter (`TacticBoard.tsx:132`) that flattens the board into a single static `RenderFrame` with `facing: 0` and a constant `team: 'own'`. Its own comment concedes the ceiling: *"a tactic is a static diagram: nothing on it is travelling anywhere."*

> **So this is not a rebuild. It is an adoption, plus three genuinely new concepts.**

Everything Teloframe's board does that the drill engine already does — keyframes, interpolation, scrubbing, onion skin, movement paths, body shape, 2D/3D, export — comes free by putting tactics on the same model. Only three things are actually new:

1. **Two teams and formations** — home/away sides, 29 built-in formations, single/dual view. Drills have a freeform `team: 'A'|'B'` label; tactics need real sides with shape presets.
2. **Phases** — named, coloured, frame-ranged segments layered *over* the keyframe track ("Build-up", "Press", "Transition"). Nothing in the drill timeline has this.
3. **Roster binding** — a tactic entity is a real `player` row, and the squad panel manages who is on and off the pitch. Drill entities are anonymous.

**Live data check (2026-08-26):** 4 tactics, max 11 board players / 2 arrows / 1 annotation on any one. The migration is trivial; a one-shot backfill is safe, exactly as it was for the 11 drills.

### Prerequisite: close out the drill rework's last loose end

`supabase/migrations/014_drop_drill_phases.sql` is written but **deliberately unapplied** — its header gates it on the entities+keyframes editor existing and every drill being read back through it. **Those conditions are now met** (Stages 2–5 shipped; 14 drills all carry `scene` + `keyframes`), and all 14 rows still carry `phases`. Apply 014 and delete the `canvas/phaseFrame.ts` bridge (`CreateDrillForm.tsx:36` still writes `pitch_size`) **before** Stage 1 here, so the tactics migration isn't written against a schema that is about to move underneath it.

---

## 1. What Teloframe's board actually has (evidence-based inventory)

Captured from the running board, not marketing copy. *Not verified: the Customize and Export panels are gated behind sign-in for guests — their contents below are inferred from the drill editor's equivalents, which I did exercise in full, and are flagged where that matters.*

### The intended workflow (their own 12-step tour, verbatim)
1. Board basics — *"your main tactical workspace… shape the picture, animate movement, and turn ideas into saved boards"*
2. Switch to dual view — see both teams together
3. Change the home-team formation
4. Add the ball
5. Pick a drawing tool and mark the board (Arrow, Line, Draw)
6. Switch back to Select
7. Open the timeline and add the first keyframe
8. Build the animation — move time forward, drag players, add another keyframe
9. Replay the animation
10. Save the tactic
11. Open export
12. Next steps — 3D view, export options, board customization, library examples

### Editor shell
| Region | Contents |
|---|---|
| Top bar | Squad-sidebar toggle · inspector toggle · **Single (S) / Dual (D)** · **2D / 3D** · **⚽ Add Ball** · **▶ Timeline** · Actions · account |
| Left — Squad panel | **Home Team / Away Team** tabs · Team Color · **FORMATION** (dropdown + description) · **Manage Formations** · Team Selector (real teams) · **SQUAD (11) · 11 ON PITCH** + add · per-player row |
| Right — Inspector | Tabs **Tools / Player / Style**; empty state *"Select a player, ball, or annotation to edit its properties."* |
| Bottom | Timeline bar + expandable **Timeline Editor** |
| ≤ ~1000px | Panels become drawers; floating dock **Squad · ▶ · Tools** |
| Actions menu | Sign in to save and load · **Presentation** `PRO` · **Export** · **Customize** · Tutorial · **Keyboard Shortcuts** · **Board-only mode** |

### Drawing tools (14, in the Tools tab)
Basic: **Select · Arrow · Line · Curve · Arc · Circle · Box · Zone · Draw · Text**
Behind *"Show advanced tools ↓"*: **Shape · Multi · Spotlight · Highlight**
Plus Undo / Redo / **Clear drawings** (separate from the timeline's own undo/redo).

### Squad panel
Per-player row: squad number · position name · **role code + number** · **Pitch** toggle (on/off pitch) · edit · delete.
Roles are granular — **GK, RB, CB, LB, CDM, CM, LW, ST, RW** — where Gaffer has five (`goalkeeper/defender/midfielder/winger/striker`).

### Formations (29 built-in, plus Manage Formations)
`3-1-4-2 · 3-4-1-2 · 3-4-2-1 · 3-5-2 · 3-4-3 · 4-1-2-1-2 · 4-1-2-1-2 (2) Narrow · 4-1-3-2 · 4-1-4-1 · 4-2-1-3 · 4-2-2-2 · 4-2-3-1 · 4-2-3-1 (2) Wide · 4-2-4 · 4-3-1-2 · 4-3-2-1 (Christmas Tree) · 4-3-3 · 4-3-3 (2) CDM · 4-3-3 (3) Twin CDM · 4-3-3 (4) CAM · 4-4-1-2 · 4-4-2 · 4-4-2 (2) Holding Mids · 4-5-1 · 4-5-1 (2) Three CMs · 5-2-1-2 · 5-2-3 · 5-3-2 · 5-4-1`
Each carries a description — 4-3-3 is *"Balanced formation with wide attackers and strong midfield presence."*

### Player inspector (selection → Player tab)
Header *"Selected · #1 Goalkeeper · Home side"*, then: **Faces** (0°, Down/Right/Up/Left) · **Scale** (1.00×) · **Marker Overrides** (*"per-player captain, status, and style tweaks"*, with Reset) → **MARKER STYLE** (Circle) · **ROLE TAG** · **MARKER COLOR** · **HIGHLIGHT** · **STATUS RING** · **STATUS COLOR** · **Movement Path** (Draw/Clear, *"requires a keyframe with a following keyframe"*) · **Body Shape** (Auto/Backpedal/Shuffle Left/Shuffle Right) · **Edit Details**.

> Gaffer's `PropertiesPanel` already has Faces, Movement Path, Body Shape and Display. **New here:** Scale, Marker Style, Role Tag, Highlight, Status Ring/Colour, captain.

### Timeline
Bar: skip-to-first · prev keyframe · play/pause · next keyframe · skip-to-last · speed · **loop** · **onion skin** · **undo/redo timeline change** (distinct from drawing undo) · expand.
Editor: **Add/Update Keyframe** · Delete · **Clear Keyframes** · keyframe count · **+ Add Phase** · **Balance timing** · **Timeline length** (15s) · **zoom out / in / fit** (100%).

**The timeline is frame-based at 30 fps** — the Add Phase dialog reads `END FRAME 150` = `00:05.00`. Gaffer's `Keyframe.t` is seconds (a float). See Stage 6.3.

### Phases (new concept)
Add Phase dialog: **Phase Name** (*"e.g. Build-up, Attack, Counter"*) · **Quick presets** — `Build-up · Attack · Counter · Press · Transition · Defense` · **Start frame / End frame** (with mm:ss.xx readout) · **Colour** (7 swatches) · Create Phase.
A phase is a *named, coloured, frame-ranged band over the keyframe track* — structure and vocabulary, not new geometry.

### Keyboard shortcuts (their full published reference)
**Playback** `Space` play/pause · `←/→` frame · `Shift+←/→` keyframe · `Home/End`
**Keyframes** `K` add · `Ctrl/Cmd+C` copy keyframe · `Ctrl/Cmd+V` paste keyframe
**Phases** `P` add phase
**Visualization** `T` player paths · `G` ghost trails · `Alt+O` onion skin
**Tools** `M` Select `A` Arrow `L` Line `V` Curve `N` Arc `C` Circle `R` Box `Z` Zone `D` Draw `X` Text `H` Shape `U` Multi `S` Spotlight `I` Highlight
**Editing** `Ctrl+Z` / `Ctrl+Shift+Z` / `Delete` / `Escape`
**View** `Ctrl+=`/`Ctrl+-`/`Ctrl+0` timeline zoom · `Ctrl+Shift+P` performance monitor · `F` board-only mode
**3D** `Alt` move camera · `Shift+L` lock/unlock selected player or annotation
**Help** `?`

> Three visualisation modes, not one: **onion skin** (neighbouring keyframes ghosted — Gaffer has this), **player paths** (the route line), **ghost trails** (motion trail behind a moving player). Gaffer has only the first.

---

## 2. What maps directly, and what is genuinely new

| Teloframe feature | Gaffer today | Work |
|---|---|---|
| Keyframes + interpolation | `frameAt`, `interpolate.ts` | **reuse as-is** |
| Playback, scrub, speed, loop | `useTimelinePlayback`, `TimelineBar` | **reuse as-is** |
| Onion skin | `timeline/onionSkin.ts` | **reuse as-is** |
| Selection, marquee, transform, zoom | `PitchCanvas` | **reuse as-is** |
| Pitch presets + overlays | `pitchPresets.ts` | **reuse as-is** |
| Export PNG/GIF/PDF/share | `design/export/*` | **reuse, re-point at tactics** |
| Movement path, body shape, faces, display | `PropertiesPanel` | **reuse, extend** |
| Onboarding tour | `onboarding/*` | **reuse pattern** |
| Undo/redo + autosave | `drillSlice` | **port to `tacticSlice`** |
| Drawing tools | 9 marking kinds | **extend to 14** (+Arc, Shape, Multi, Spotlight, Highlight) |
| **Two teams + 29 formations** | — | **new** |
| **Phases over the timeline** | — | **new** |
| **Roster binding + squad on/off pitch** | partial (`TacticPlayer.player_id`) | **new** |
| **Player paths / ghost trails** | — | **new** |
| **Single/dual view, board-only, presentation** | — | **new** |
| **Copy/paste keyframes, timeline zoom** | — | **new** |

---

## Stage 0 — Land migration 014 and retire the phases bridge

**Size:** S · **Depends on:** nothing · **Do this first.**

1. Re-run `013b_backfill_scene.sql` so any drill touched since the original backfill is represented in `scene`/`keyframes`.
2. Open all 14 drills in the editor; confirm nothing has moved.
3. Apply `014_drop_drill_phases.sql` (drops `drill.phases`, `drill.pitch_size`, and the `pitch_size` type) **together with** the `src/` strip, per the 008/009/010 precedent `CLAUDE.md` names.
4. Delete `src/components/design/canvas/phaseFrame.ts`; remove `DrillPhase`/`PitchSize`/`Drill.phases`/`Drill.pitch_size` from `types.ts` and `store/index.ts`; fix `CreateDrillForm.tsx:36`, which still writes `pitch_size`.

**Definition of done:** `phases` and `pitch_size` are gone from the DB and from `src/`; `npm run build` and `npm run lint` clean.

**Verify:** `select column_name from information_schema.columns where table_name='drill';` shows neither column. All 14 drills still open and render.

**Execution:** `claude-opus-5` · effort **`high`** · **~0.8–1.5M in / ~40–70K out** · **40–75min** · ~$5–9
Small but destructive and ordering-sensitive. The migration file's own header is the checklist — follow it literally, and re-run 013b *before* dropping anything.

---

## Stage 1 — Data model: tactic scene, keyframes, sides

**Size:** L · **Depends on:** 0 · **Everything else depends on this.**

**Why first:** every new feature (animation, phases, formations, paths) is undefined against `board.players[]`.

### 1.1 Extend the shared entity types (`src/store/types.ts`)

`SceneEntity` is reused, not forked — one canvas, one interpolator, one export path. Two optional fields, both jsonb so no migration is needed for them:

```ts
export interface SceneEntity {
  // …existing: id, kind, team, number, label, color, goalkeeper, display,
  //            equipment, rotation
  player_id?: string        // roster binding — tactics only; drills leave it unset
  role?: PlayerRole         // 'GK'|'RB'|'CB'|'LB'|'CDM'|'CM'|'CAM'|'LW'|'RW'|'ST'
  scale?: number            // 1.0 default
  markerStyle?: MarkerStyle // 'circle'|'square'|'shield'|'jersey'
  roleTag?: string | null
  highlight?: string | null
  statusRing?: StatusRing   // 'none'|'captain'|'booked'|'injured'|'sub'
  statusColor?: string | null
}
```

`SceneEntity.team` already carries `'A'|'B'`; tactics use `'home'|'away'` in the same field. Do **not** add a parallel `side` field — the canvas already colours by `team`.

### 1.2 New tactic types

```ts
// A named, coloured band over the keyframe track. Purely organisational:
// it groups keyframes for the coach, it does not affect interpolation.
export interface TacticPhase {
  id: string
  name: string
  startSeconds: number
  endSeconds: number
  color: string
}

export interface TacticSide {
  formation: string          // key into FORMATIONS, e.g. '4-3-3'
  color: string
  teamId: string | null      // null = placeholder opposition
}

export interface Tactic {
  id: string
  team_id: string
  name: string
  scene: DrillScene          // the SAME shape drills use
  keyframes: Keyframe[]
  phases: TacticPhase[]
  duration_seconds: number
  pitch: PitchConfig         // orientation is live-switchable — see 1.6
  sides: { home: TacticSide; away: TacticSide }
  view: 'single' | 'dual'
  // Light metadata only (decided 2026-08-26). Enough to find a tactic and to
  // put it in a session; deliberately NOT drill's ~19 columns — a tactic is a
  // thinking tool a coach works through, not a 15-minute pitch activity with
  // equipment, intensity and an age band.
  description: string | null
  phase_of_play: DrillPhaseOfPlay | null   // reuses the drill enum
  thumbnail_url: string | null
  share_token: string | null
  created_at: string
  // deprecated, dropped in 021 once the backfill is verified: board
}

// Mirrors SessionDrill exactly (types.ts:441) so a session can hold both.
export interface SessionTactic {
  id: string
  session_id: string
  tactic_id: string
  order_index: number
  planned_duration_minutes: number | null
  notes: string | null
}
```

### 1.3 Migration (`supabase/migrations/020_tactic_scene_keyframes.sql`)

Purely additive, mirroring 013:

```sql
alter table tactic add column scene jsonb not null default '{"entities":[],"markings":[]}'::jsonb;
alter table tactic add column keyframes jsonb not null default '[]'::jsonb;
alter table tactic add column phases jsonb not null default '[]'::jsonb;
alter table tactic add column duration_seconds integer not null default 15;
alter table tactic add column pitch jsonb not null default
  '{"preset":"full","widthMeters":68,"lengthMeters":105,"orientation":"landscape","overlays":[]}'::jsonb;
alter table tactic add column sides jsonb not null default
  '{"home":{"formation":"4-3-3","color":"#3b82f6","teamId":null},
    "away":{"formation":"4-4-2","color":"#ef4444","teamId":null}}'::jsonb;
alter table tactic add column view text not null default 'single';

-- Light metadata (decided 2026-08-26)
alter table tactic add column description text;
alter table tactic add column phase_of_play text;
alter table tactic add column thumbnail_url text;
alter table tactic add column share_token text unique;
```

Plus the session join table, mirroring `session_drills`:

```sql
create table session_tactics (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references session(id) on delete cascade,
  tactic_id  uuid not null references tactic(id)  on delete cascade,
  order_index integer not null default 0,
  planned_duration_minutes integer,
  notes text,
  created_at timestamptz not null default now()
);
alter table session_tactics enable row level security;
-- Reuse is_team_member / is_team_owner exactly as session_drills does —
-- do not redefine membership checks inline (CLAUDE.md).
```

**Landscape is the default**, matching Teloframe and reading better for a full-pitch diagram — but it is only a default, because orientation is switchable at any time from the editor (1.6). Gaffer's `TACTIC_PITCH` currently hardcodes portrait (`TacticBoard.tsx:18`); that constant goes away.

### 1.4 Backfill (`020b_backfill_tactic_scene.sql`)

4 rows; rules mirror 013b:
1. `board.players[]` → `scene.entities[]`, `kind:'player'`, `team:'home'`, carrying `player_id`; `number`/`label` resolved from the roster at render time, not frozen in.
2. One keyframe at `t: 0` holding every entity's `{x,y}`.
3. `board.arrows[]` → `scene.markings[]` `kind:'arrow'`, `points:[from,to]`, `style.dash` from `kind==='ball'`.
4. `board.annotations[]` → `scene.markings[]` `kind:'text'`.
5. `duration_seconds` 15; `phases` `[]`.

### 1.6 The orientation switcher — and the coordinate bug it exposes

Orientation is a **live toggle in the editor chrome**, not a choice made when creating a tactic. The drill editor already has exactly this control (`PitchPanel.tsx:106` — it patches `pitch.orientation` and nothing else); Stage 7 surfaces the same toggle in the tactics top bar.

**But that existing toggle is subtly broken, and for tactics it would be fatally so.**

`pitchGeometry.ts:227` transposes the *pitch markings* when orientation flips — `config.orientation === 'landscape' ? transpose(canonical) : canonical` — while entity positions stay at whatever normalized `(x, y)` they held. So the goalmouth, penalty box and halfway line all move, and the players do not. In a drill that is often survivable, because a drill is frequently a generic grid. In a tactic it is not: flip a 4-3-3 and the back four ends up strung across a touchline.

**Therefore `setOrientation` must transpose the content in lockstep with the markings:**

- every `EntityState`'s `{x, y}` → `{x: y, y: x}`
- every `Marking.points[]` entry, the same
- every `EntityState.path[]` waypoint, the same

Use `transpose` (the diagonal mirror, `(x,y) → (y,x)`), **not** a 90° rotation, so it matches exactly what `pitchGeometry` already does to the markings. The invariant to test against: *a player standing in the home penalty area is still standing in the home penalty area after the flip.*

> **This is a live bug in the shipped drill editor too.** Put the transform in one shared helper (`canvas/transposeScene.ts`) and call it from both editors' orientation toggles. Fixing it for drills is a handful of extra lines here and removes a defect you would otherwise trip over later.

### 1.5 Drop `board` (`021_drop_tactic_board.sql`)

Written now, **gated exactly like 014** — apply only once all 4 tactics have been opened in the new editor (Stage 7) and nothing has moved. Put that gate in the file header.

**Definition of done:** all 4 tactics round-trip with the same players in the same places; a tactic and a full-pitch drill render through the identical code path.

**Verify:** `select id, name, jsonb_array_length(keyframes), jsonb_array_length(scene->'entities') from tactic;` matches the old board counts. `npm run build` clean.

**Execution:** `claude-opus-5` · effort **`max`** · **~2–3.5M in / ~120–180K out** · **1.5–2.5h** · ~$13–20
Second-highest-consequence stage after the drill migration. Much cheaper than that one was, because `SceneEntity`/`Keyframe`/`DrillScene` already exist and the whole job is extending them plus a 4-row backfill. `max` because it is still schema surgery on live rows — run it against a Supabase branch first.

---

## Stage 2 — Store: `tacticSlice` on entities and keyframes

**Size:** M · **Depends on:** 1

**Why:** `tacticSlice`'s current actions (`addTacticPlayer`, `setTacticPlayerPosition`, `addTacticArrow`…) are all board-shaped, and its caller re-writes the whole document on every drag-end with no undo.

1. Rewrite `src/store/slices/tacticSlice.ts` **against `drillSlice.ts` as the reference implementation** — same action names, same local-mutate-then-debounced-autosave split, same bounded undo stack. Where an action is identical in both, extract it rather than copy it (see 2.4).
2. Actions: `addEntity` / `updateEntity` / `removeEntity` / `setEntityPosition` · `addKeyframe` / `updateKeyframeState` / `moveKeyframe` / `deleteKeyframe` / `clearKeyframes` / `balanceTiming` · `copyKeyframe` / `pasteKeyframe` (**new** — `Ctrl+C`/`Ctrl+V`) · `addMarking` / `updateMarking` / `removeMarking` · `addPhase` / `updatePhase` / `removePhase` · `setSide` / `setView` / `setTacticPitch` / `setDuration` · **`setOrientation`** (transposes every entity state, marking point and path — see 1.6; share the helper with the drill editor).
3. **Undo/redo** — bounded snapshot stack of `{scene, keyframes, phases, duration_seconds, pitch, sides}`, pushed on committed mutations only (drag-end, not drag-move). Teloframe keeps *drawing* undo and *timeline* undo separate; do the same — one stack scoped to markings, one to scene/keyframes — because a coach clearing drawings should not be able to undo their way back through the animation.
4. **Extract the shared core.** `drillSlice` and `tacticSlice` will now share ~70% of their logic. Pull the entity/keyframe/marking reducers into `src/store/sceneActions.ts` as pure functions over `{scene, keyframes}` and have both slices call them. Do this *as part of* Stage 2, not as a later cleanup — two 400-line near-duplicates will drift within a month.

**Definition of done:** a tactic can be built, animated, undone and autosaved with exactly one `PATCH /rest/v1/tactic` per committed change.

**Verify:** DevTools Network — one write per continuous drag. Undo after a drag restores the prior position; undo after Clear Drawings does not rewind the animation.

**Execution:** `claude-opus-5` · effort **`xhigh`** · **~2.5–4M in / ~130–200K out** · **1.5–2.5h** · ~$16–26
The extraction in 2.4 is the part that needs `xhigh` — done carelessly it either over-abstracts (a generic "document slice" nobody can read) or under-abstracts (two copies). Write `sceneActions.ts` first as pure functions with no Zustand in sight, then wire both slices to it.

---

## Stage 3 — Formations

**Size:** M · **Depends on:** 1 · *Can run parallel to 2.*

1. `src/components/tactics/formations.ts` — all **29** formations from §1, each as:
   ```ts
   { key: '4-3-3', label: '4-3-3', description: 'Balanced formation with wide attackers…',
     slots: [{ role: 'GK', x: 0.05, y: 0.5 }, …] }   // 11 slots, normalized 0-1
   ```
   Coordinates are for the **home side attacking right**; mirror `x → 1-x` for away. Author them against a landscape full pitch.
2. `applyFormation(side, formationKey)` — assigns each on-pitch entity to the nearest unfilled slot **by role affinity first, then distance**, so a keeper doesn't get slotted at right-back. Writes positions into the **current keyframe only** — changing formation mid-animation is a legitimate coaching move, not a global reset.
3. Formation picker in the squad panel: dropdown, description under it, and a diagram thumbnail per formation.
4. **Manage Formations** — custom formations saved per coach (**in scope for v1**). New table `formation (id, owner_id, name, slots jsonb, created_at)` with RLS reusing `is_team_owner`, plus a "save current shape as formation" action so a coach can drag a side into a shape and keep it. Custom formations list alongside the 29 built-ins in the same picker, visually separated.

**Definition of done:** switching formation re-shapes the side sensibly at the current keyframe, with no keeper-in-midfield outcomes.

**Verify:** apply all 29 to a full 11 and eyeball each; assert every formation has exactly 11 slots and exactly one `GK` in a unit-ish check.

**Execution:** mixed · **~2–3.5M in / ~140–220K out** · **1.5–2.5h** · ~$9–16
The 29-formation coordinate table is transcription — **`claude-sonnet-5` · `medium`**, or fan it out to subagents at `low`. The slot-assignment algorithm in 3.2 is the only real logic and wants **`claude-opus-5` · `high`**. Getting the coordinates *plausible* is easy; getting them *good* needs your eye, so budget a review pass.

---

## Stage 4 — Squad panel, two teams, roster binding

**Size:** M · **Depends on:** 1, 3

1. `SquadPanel.tsx` — **Home / Away** tabs; per side: team colour, formation picker, team selector, squad list.
2. **Home side binds to the real roster.** `selectedTeamId`'s players, each row: squad number · position · role code · **Pitch toggle** · edit · delete. Toggling off sets `{hidden:true}` in the current keyframe (the shape `EntityState` already supports) rather than deleting the entity — so the player returns to the same place when toggled back on.
3. **Away side is placeholder by default and bindable to a real team** (**in scope for v1**). The team selector on the Away tab lists the coach's other teams (5 exist) — useful for prepping against a side you actually coach. Placeholder entities carry `player_id: undefined` and a generated `label`; bound ones carry a real `player_id` exactly as the home side does. Binding is per-tactic (`sides.away.teamId`), so the same tactic can be re-pointed at a different opponent without redrawing it.
4. **Extend `PlayerPosition` to the 9 granular roles.** Gaffer has 5 (`goalkeeper/defender/midfielder/winger/striker`); formations need `GK/RB/CB/LB/CDM/CM/CAM/LW/RW/ST`. Add `PlayerRole` as a *tactics-only display concept on `SceneEntity.role`* — do **not** migrate the `player_position` enum. The roster's five tags stay the source of truth for the planning side; role is a per-tactic assignment. This keeps the change inside jsonb and avoids touching `player`, `PlayerRoster`, attendance and every other consumer.

**Definition of done:** a coach picks their real squad, sets a formation per side, and toggles players on and off the pitch.

**Verify:** with 15 roster players and an 11-slot formation, the 4 unselected sit in the panel as off-pitch; toggling one on places it in the first free slot.

**Execution:** `claude-opus-5` · effort **`high`** · **~2.5–4M in / ~150–230K out** · **2–3h** · ~$16–25
4.4 is the decision that matters — the tempting move is to widen the `player_position` enum, and that would ripple through the roster, attendance and session screens for no benefit. Keep role per-tactic and in jsonb.

---

## Stage 5 — Timeline, phases and the extra visualisations

**Size:** M · **Depends on:** 2 · *The single highest-value stage — it is what makes a tactic animate.*

1. **Mount the existing timeline against tactics.** `TimelineBar`, `TimelineEditor`, `useTimelinePlayback`, `useKeyframeToggle`, `useTimelineKeys`, `onionSkin.ts` are all drill-shaped only in which store they read. Parameterise them over a small `TimelineHost` interface (`keyframes`, `duration`, `addKeyframe`, `moveKeyframe`, …) and have both editors supply one. **Do not fork these files.**
2. **Phases** (new): a coloured band track above the keyframe track. Add Phase dialog with name, the six quick presets (`Build-up · Attack · Counter · Press · Transition · Defense`), start/end, and a 7-colour swatch. Drag a band's edges to retime it; bands may not overlap. `P` adds one.
3. **Keep seconds; render frames.** Teloframe is frame-based at 30 fps (`END FRAME 150` = 5.00s); Gaffer's `Keyframe.t` is float seconds. **Do not migrate to frames** — seconds are already load-bearing in `interpolate.ts`, `speeds.ts` and 013b. Instead add `framesToSeconds`/`secondsToFrames` helpers at 30 fps and show frame numbers in the phase dialog only. Snapping keyframes to a 1/30s grid on drag is worth it; changing the stored unit is not.
4. **Timeline zoom** — `Ctrl+=`/`Ctrl+-`/`Ctrl+0`, with a percentage readout and fit-to-view.
5. **Player paths (`T`)** — the route line for each moving entity, from `EntityState.path` when set, else the interpolated straight line. **Ghost trails (`G`)** — N faded copies behind a moving entity during playback. Both are canvas layers over data `frameAt` already produces; neither needs new state.
6. **Copy/paste keyframes** — `Ctrl+C`/`Ctrl+V` on the selected keyframe.

**Definition of done:** a 4-keyframe tactic plays back smoothly, phases label the sequence, and paths/trails/onion-skin can each be toggled independently.

**Verify:** build a build-up→press→transition tactic with three phases; scrub through and confirm band colours track the playhead. Confirm the drill editor still works after the `TimelineHost` refactor — that is the regression risk in this stage.

**Execution:** `claude-opus-5` · effort **`xhigh`** · **~4–6.5M in / ~220–330K out** · **2.5–4h** · ~$26–42
5.1 touches shipped, working drill code — the parameterisation is where a regression would land, so do it as its own commit with the drill editor verified green *before* any tactics-specific work starts. 5.3's recommendation (keep seconds) is deliberate; re-deriving it costs more than following it.

---

## Stage 6 — Drawing tools to parity

**Size:** M · **Depends on:** 5

1. Extend `markingTools.tsx` / `Marking.kind` from 9 to **14**: add **Arc**, **Shape** (polygon), **Multi** (multi-segment arrow), **Spotlight** (dim everything but a radius), **Highlight** (translucent emphasis on a player or region).
2. Wire the full shortcut map: `M A L V N C R Z D X H U S I`.
3. **Clear drawings** as a distinct action from timeline undo (see 2.3).
4. Spotlight/Highlight are the two that are genuinely presentational rather than geometric — they render as an overlay layer above entities, not as markings beneath them.

**Definition of done:** all 14 tools draw, select, transform and delete; every shortcut fires.

**Verify:** draw one of each on a single board, save, reload, confirm all 14 round-trip through jsonb.

**Execution:** mixed · **~2.5–4M in / ~160–240K out** · **1.5–2.5h** · ~$11–18
Arc/Shape/Multi are geometry against an established pattern — **`claude-sonnet-5` · `high`**, or subagents at `low` one tool per agent. Spotlight and Highlight change how the whole canvas composites and want **`claude-opus-5` · `high`**.

---

## Stage 7 — Editor shell, inspector and views

**Size:** M · **Depends on:** 4, 5, 6

1. Route `/tactics/:id` to a `TacticEditor` built on the **same shell** as `DrillEditor` (`editor/DrillEditor.tsx`, `EditorTopBar.tsx`, `ToolRail.tsx`) — extract the shell where it is genuinely shared rather than copying it.
2. Top bar: back · inline name · squad/inspector toggles · **Single/Dual** · **Portrait/Landscape** · **2D/3D** · Add Ball · Timeline · Actions · Save. The orientation switcher sits here rather than buried in a pitch panel (decided 2026-08-26) — it is a framing control a coach reaches for while thinking, not a setup step. It calls `setOrientation`, which transposes content as well as markings (1.6).
3. Inspector with **Tools / Player / Style** tabs; Player tab extends the existing `PropertiesPanel` with Scale, Marker Style, Role Tag, Highlight, Status Ring/Colour (§1).
4. **Single/Dual view** — Single renders one side, Dual renders both. This is a *filter over entities by `team`*, not two scenes.
5. **Board-only mode (`F`)** — hide every panel, leaving the pitch. Cheap, and the foundation for presentation mode.
6. Responsive: panels become drawers below ~1000px with a floating **Squad · ▶ · Tools** dock, matching how the drill editor already collapses.

**Definition of done:** the tactics editor is navigable at 390px, 800px and 1440px; `TacticBoard.tsx` is deleted.

**Verify:** open all 4 migrated tactics, confirm nothing has moved — **this is the gate on applying migration 021.**

**Execution:** `claude-opus-5` · effort **`high`** · **~3–5M in / ~180–260K out** · **2–3h** · ~$18–29
Mostly composition against patterns that already exist. The one judgement call is 7.1: extract the shell only where both editors genuinely agree — a shared shell forced over two different toolbars is worse than two toolbars.

---

## Stage 8 — Export, share and presentation

**Size:** S–M · **Depends on:** 5, 7

1. Re-point `design/export/*` at tactics: **PNG** · **GIF** · **MP4** · a print-styled **Tactic Card (PDF)** (formation, both sides, phase list, drawn board).
2. **Share token** (**in scope for v1**) — `tactic.share_token` is already added in Stage 1.3; add the public-read RLS policy mirroring migration 018's, and a signed-out `/t/:token` route. **Verify the policy by hand.** This one genuinely matters: a shared tactic exposes real squad names, so the policy must grant read on exactly one row by token and nothing else.
3. **Presentation mode** (**in scope for v1**) — full-screen, phase-by-phase stepping, no chrome, driven by the `phases[]` from Stage 5. Builds directly on board-only mode (7.5). Teloframe gates this behind PRO; there is no reason to here.

**Definition of done:** a tactic exports as a still, an animation and a one-page PDF, and a share link renders signed-out without exposing any other tactic.

**Verify:** open a share link in a private window; try neighbouring tokens and confirm they 404.

**Execution:** mixed · **~2–3.5M in / ~130–190K out** · **1.5–2.5h** · ~$12–20
The export pipeline already exists, so most of this is re-pointing — **`claude-sonnet-5` · `high`**. The RLS policy is **`claude-opus-5` · `xhigh`** and wants a manual read of the final SQL.

---

## Stage 9 — Library and session integration

**Size:** M · **Depends on:** 1, 7 · *This is the stage the "add tactics to sessions" decision bought.*

**Why:** a coach wants to work on a specific tactic in a specific session — pick it during planning, then have it in front of them on the day. That makes a tactic a *plannable* item without making it a drill.

1. **Tactics list** (`/tactics`) — card grid reusing `DrillLibrary.tsx`'s patterns: thumbnail, name, formation badge per side, phase count, duration. Client-side filter by name and phase of play (the scale here is tens of rows, not hundreds — no server-side search, same call `DrillLibrary` already makes).
2. **Thumbnails** — reuse the drill capture path (migration 017's bucket, and the RLS fix in `4ff2363`). Auto-capture on save when empty.
3. **`sessionTacticSlice`** — mirror `sessionDrillSlice.ts` (153 lines) exactly: fetch/add/remove/reorder, `order_index` maintenance, `planned_duration_minutes`, `notes`.
4. **Session planner integration** — `SessionDrillsPanel.tsx` (290 lines) currently owns "what's in this session". Generalise it to hold **both** drills and tactics in one ordered list rather than building a second parallel panel: a session block is a sequence of things you do, and splitting the UI by storage table would be an implementation detail leaking into the coach's workflow. Each row shows a type badge; add-flow offers both libraries.
5. Attaching a tactic to a session is optional in both directions — a tactic never *needs* a session, and a session never needs a tactic.

**Definition of done:** a coach browses tactics, opens one, and adds it to a session alongside drills in a single ordered list.

**Verify:** add two drills and one tactic to a session; reorder across types; confirm `order_index` stays contiguous and the session's total planned duration sums all three.

**Execution:** mixed · **~2.5–4M in / ~150–220K out** · **1.5–2.5h** · ~$11–19
Item 4 is the judgement call and wants **`claude-opus-5` · `high`** — generalising `SessionDrillsPanel` over two entity types is where this either stays clean or turns into a tangle of conditionals; consider a small discriminated-union row type before touching the component. The list/cards/filters in 1–3 are established patterns and suit **`claude-sonnet-5` · `high`**.

---

## Stage 10 — Onboarding, and the 3D question

**Size:** onboarding S · 3D XL · **Depends on:** 7

1. **Tour** — reuse `editor/onboarding/*`; author ~10 steps following Teloframe's own arc (dual view → formation → ball → draw → select → keyframe → animate → replay → save → export). Add `data-onboarding-anchor` attributes while building Stages 4–7, not after.
2. **3D — still recommend deferring.** The same reasoning as the drill plan holds, and now more so: `scene`/`keyframes` is renderer-agnostic, both editors feed it, so 3D remains a pure addition whenever you want it. Teloframe's 3D features that leak into 2D (`Body Shape`, `Faces`, goalkeeper dive) are **already modelled** in Gaffer's types — they cost nothing to keep carrying. Build 3D once, against the shared model, and both editors get it. **Recommendation: ship Stages 0–9 first.**

**Execution — onboarding:** `claude-sonnet-5` · effort **`medium`** · **~0.8–1.5M in / ~50–80K out** · **40–75min** · ~$3–5
**Execution — 3D:** `claude-opus-5` · effort **`max`** · **~12–25M in / ~500–900K out** · **8–16h across 3–5 sessions** · ~$75–150
Unchanged from the drill plan's assessment, and it now covers both editors at once — which is the argument for doing it *properly*, once, rather than twice.

---

## Sequencing

```
0 ──▶ 1 ──┬──▶ 2 ──▶ 5 ──▶ 6 ──┐              ┌──▶ 8
          │                     ├──▶ 7 ──▶ ───┤
          └──▶ 3 ──▶ 4 ─────────┘              └──▶ 9 ──▶ 10
```
- **0 → 1 → 2 → 5** is the spine and should not be split across sessions.
- **3 → 4** (formations, squad) runs parallel to **2 → 5** (store, timeline) once Stage 1 lands.
- **8** (export/share/presentation) and **9** (library/sessions) are independent of each other and can run in either order, or in parallel.
- **Ship gate:** Stage 7's read-back of all 4 tactics is what unlocks migration 021.

---

## Reading the execution estimates

Same basis as `DRILL_CREATOR_REWORK_PLAN.md` — see that file's estimates section for the full method (models, effort scale, why input tokens dominate, and why the cost column is an upper bound given prompt caching).

### Totals

| | Stages 0–9 + onboarding | 3D (Stage 10.2, deferred) |
|---|---|---|
| Input tokens | **~24–39M** | ~12–25M |
| Output tokens | **~1.4–2.2M** | ~0.5–0.9M |
| Wall-clock | **~17–27h** | ~8–16h |
| Indicative cost at list rates | **~$135–225** | ~$75–150 |

Still **meaningfully cheaper than the drill rework** (~23–37h, ~$190–320) despite covering more ground, because the engine already exists — the saving is Stage 0's groundwork being paid for once and reused twice.

The four scope decisions of 2026-08-26 added roughly **4–6h** to the original ~13–21h estimate: custom formations (~1h), session integration as a new Stage 9 (~2h), presentation mode (~45min), and the orientation transpose (~30min, and it fixes a drill bug in passing).

**Stages 0–5 — the point at which a tactic actually animates — are ~7–12h**, a little under half the total. That is the natural first milestone to stop and look at.

---

## Not planned (and why)

- **Frame-based timeline (30 fps storage).** Seconds are load-bearing across `interpolate.ts`, `speeds.ts` and the 013b backfill. Frames are a *display* unit; converting the stored unit buys nothing and risks the interpolator. Snapping to a 1/30s grid gives the same feel. (Stage 5.3.)
- **Widening the `player_position` enum to 9 roles.** Role is a per-tactic assignment, not a property of the player — keeping it on `SceneEntity.role` in jsonb avoids touching the roster, attendance and session screens. (Stage 4.4.)
- **Drill-style metadata on tactics** (equipment, intensity, age band, setup time, difficulty, coaching points). Tactics get *light* metadata and session attachment instead (Stage 1.2) — a tactic is something a coach reasons with, not a 15-minute pitch activity with a kit list.
- **A separate tactics canvas.** `PitchCanvas` already renders a `RenderFrame`; a second canvas would fork the one component both features depend on. `CLAUDE.md` calls this out explicitly.
- **A second Zustand store.** Ruled out early in this codebase and still right.
- **Gating Presentation or 3D behind a paid tier.** Single-user app; Teloframe's `PRO` badges are a business-model artefact, not a design one.
- **Performance monitor (`Ctrl+Shift+P`).** An instrumentation nicety for a team shipping to thousands; not worth the surface here.
- **3D, for now.** See Stage 10.2.

---

## Decisions taken (2026-08-26)

All four open questions are now settled, and the stages above reflect them. Recorded here so a session executing one stage can see *why* its spec says what it says.

| Decision | Answer | Where it lands |
|---|---|---|
| **Pitch orientation** | Not a creation-time picker — a **live switcher in the editor top bar**, flipping between portrait and landscape at any time. Landscape is the default. | 1.3, **1.6**, 2, 7.2 |
| **How much a tactic knows** | **Light metadata, and attachable to sessions.** A coach can pick a tactic to work on and put it in a session — but not the ~19 drill columns (no equipment, intensity, age band, setup time). | 1.2, 1.3, **new Stage 9** |
| **v1 extras** | **All four in:** away side bindable to a real team · custom formations · presentation mode · public share links. | 3.4, 4.3, 8.2, 8.3 |
| **Migration 014** | **Apply first**, as Stage 0, re-running 013b beforehand exactly as the file header instructs. | Stage 0 |

**The orientation answer turned up a bug.** Asking for a live switcher forced the question of what a flip does to content — and the answer is that today it does the wrong thing. `pitchGeometry.ts:227` transposes the markings while entity coordinates stay put, so flipping a formation strings the back four across a touchline. Stage 1.6 specifies the fix, and because the drill editor's existing toggle (`PitchPanel.tsx:106`) has the same defect, the shared helper fixes both. That is the single most valuable thing this round of questions produced.

**One thing the session-integration answer changes downstream:** `SessionDrillsPanel.tsx` becomes a mixed drill+tactic list rather than gaining a sibling panel (Stage 9.4). If you would rather keep them visually separate in the planner, say so before Stage 9 — it is a UI decision, not a schema one, so it is cheap to change now and annoying to change after.

---

## What I could not verify

Signed-in-only, so the following are **inferred from the drill editor's shipped equivalents** rather than observed on the tactics board:
- **Customize panel** — assumed to be pitch colour/surface/mowing/markings toggles, matching the drill editor's Pitch panel.
- **Export panel options** — assumed PNG/MP4/GIF/PDF with size and quality presets, matching what the drill editor's export offers.
- **Save flow and the tactics library** — the board's own library/list screen was never reached.

None of these change the architecture; if any turns out to differ materially, it affects Stage 8 only.
