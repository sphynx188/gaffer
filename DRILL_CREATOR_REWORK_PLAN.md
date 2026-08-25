# Drill Creator Rework Plan: Gaffer → Teloframe-class editor

**Current app:** `gaffer/` — React 19 + Vite + TS + Zustand 5 + Supabase + Tailwind v4 + Konva/react-konva.
**Current drill creator:** `src/components/design/DrillPreview.tsx` (917 lines), `PitchCanvas.tsx` (568), `drillSlice.ts` (379), `pitchGeometry.ts` (249).
**Target:** the drill editor at `https://teloframe.com/drills/new`, analysed live on 2026-08-24 (signed in, editor exercised end-to-end: tools armed, players placed, keyframes created, animation played, 3D toggled, export and details drawers opened).
**Scope note from the user:** *"changes can be as drastic as needed. Colours don't matter too much but functionality is very important."* This plan takes that literally — Stage 1 replaces the core data model, and `DrillPreview.tsx` does not survive in its current form.

---

## 0. The one thing that matters

Everything else in this plan is downstream of a single architectural difference.

**Gaffer today models a drill as a list of independent snapshots.**
`drill.phases[]` — each phase carries its *own* `players[] / cones[] / balls[] / arrows[] / annotations[]`. A "player" in phase 1 and the "same" player in phase 2 are two unrelated objects that happen to share an id only because `addPhase('duplicate')` copies the array by value. Stepping through phases is a **hard cut**: `PitchCanvas` is handed a different phase and re-renders from scratch. `DrillLibrary`'s "play" button cuts between phases on a timer, and its own source comment admits why it can't do better:

> *"Deliberately just cuts between phases rather than tweening marker positions: phases aren't guaranteed to have matching elements … so there's no general way to interpolate between two arbitrary phases' element sets."*

**Teloframe models a drill as a cast of persistent entities plus keyframes over a timeline.**
There is one list of players/balls/equipment with **stable identity for the whole drill**. A keyframe is a `(time → {entityId: position})` snapshot. Playback **interpolates** between keyframes on a real clock. That single change is what unlocks: smooth animation, a scrubbable timeline, onion skin, per-segment speed feedback, custom movement paths, drag-to-retime, "update keyframe state", and a 3D view fed by the same data.

> **You cannot bolt Teloframe's features onto `phases[]`.** Tweening, onion skin, movement paths and speed readouts are all *undefined* without entity identity across time. Stage 1 is therefore non-negotiable and non-optional, and every later stage assumes it.

The good news: the migration is trivially small. Live DB check on 2026-08-24 — **11 drills, 18 phases total, max 3 phases on any one drill.** A one-shot backfill is safe; no permanent dual-read compatibility layer is needed.

---

## 1. What Teloframe actually has (evidence-based inventory)

Captured directly from the running editor, not from marketing copy.

### Editor shell
| Region | Contents |
|---|---|
| Top bar | Back · inline drill-name field · category chip · **undo / redo** · export · **2D / 3D toggle** · Player-Explanation (QR) · Tutorial · **Save** |
| Left rail (9 tools) | Select (V) · Add Player · Add Ball · Equipment · Markings & Zones · team-colour swatch · Grid & Guides (G) · Pitch · Drill Details (Ctrl+D) |
| Right panel | Contextual — Keyframes when nothing is selected, **Player Appearance** when a player is selected |
| Bottom | Clock `00:00 / 00:15` · keyframe count · transport · speed · loop · **onion skin** · expand Timeline Editor |
| ≤ ~1000px | Rail collapses to a drawer; a floating dock appears: **Tools · ▶ · Props** |

### Tool panels
- **Equipment library** — *Core:* Cone, Marker, Pole, Mannequin, Mini Goal. *Advanced:* Agility Ring, Full Goal, Ladder, Hurdle, Rebounder, Passing Gate.
- **Markings & Zones** — 9 drawing tools (select, straight arrow, line, curved arrow, circle, rectangle, freehand pen, zone/area, ruler) + Clear All Markings.
- **Grid & Guides** — Show Grid, Snap to Grid, Smart Guides.
- **Pitch** — ~35 presets in 5 families, each with **real metre dimensions**:
  - *Classic (6):* Full Pitch 105×68, Attacking/Defending Half 53×68, Final/Middle/Defensive Third 35×68
  - *Small-Sided (5):* 5v5 37×27, 7v7 55×37, 9v9 73×46, Futsal 40×20, Indoor Cage 25×15
  - *Functional (5):* Penalty Box 17×40, Double Penalty Box 33×40, Final Third + Goalmouth, Middle Third, Defensive Third + Goalmouth
  - *Rondo (16):* 10×10/12×12/15×15/20×20/25×25 yd grids, 3v1 Triangle 7×7, 4v1 Tight, Rectangle Rondo 18×11, **Guardiola 4v4+3** 17×23, Transfer Rondo (2 grids), Diamond Grid, Hexagon Rondo, End-zone Rondo, 4-Zone Box, 5-Channel Corridor, **Pep 20 Zones** 105×68
  - *Shape (3):* Long & Narrow 46×20, Wide & Short 25×40, Diamond/Funnel 30×30
  - Plus: m/yd units, portrait toggle, Surface, pitch colour presets (Grass, Premier League, La Liga, Bundesliga, Serie A, Camp Nou, Winter), mowing pattern, show-markings toggle
  - **Overlays:** Thirds · 5 Channels (25/75) · Lanes (5) · Half-Spaces · Pep 20 Zones · Training Grid, with opacity slider

### Selection → properties (Player Appearance panel)
- **Display:** Compact / Standard / Presentation / Dot
- **Team colour** + **individual colour override**
- **Goalkeeper** toggle
- **Movement Path** — "Draw a custom multi-point run to the next keyframe" (Draw Route / Clear). Gated: *"only works when the playhead is on a keyframe with a following keyframe."*
- **Body Shape** — Auto / Backpedal / Shuffle Left / Shuffle Right ("how this player carries their body to the next keyframe")
- **Faces** — facing angle, 0° with Down/Right/Up/Left presets

### Timeline
- Ruler `00:00 … 00:15`, draggable playhead, total-duration control
- Transport: skip-to-start · prev keyframe · play/pause · next keyframe · skip-to-end · speed cycle · loop · onion skin
- Timeline Editor: **Add Keyframe** ⇄ **Update Keyframe** (context-aware on whether the playhead sits on a keyframe) · Delete · Clear Keyframes · **Balance timing** · duration · keyframe count
- Keyframe properties: index, time, **name**, **description**, and *"Update Keyframe State — captures current pitch positions to this keyframe"*
- **Per-segment physics readout** on the track: `7.5s · P 7.0m/s · B 0.0m/s` — the implied player and ball speed for that segment. This is the single best idea in their editor: it tells a coach whether the movement they just drew is physically possible.

### Drill Details drawer (7 tabs)
- **Basic Info** — name, objective, duration (min), players, category, age range (from→to), description, thumbnail (*Capture 2D/3D view*, auto-captured on save)
- **Pitch** — the pitch/overlay settings above
- **Coaching** — Setup Instructions · Coaching Points · Progressions (Make Harder) · Regressions (Make Easier) · Common Mistakes — all repeatable list builders, with an AI-assist affordance
- **Settings** — Difficulty · Intensity · Phase of Play · Video Demo URL (+ upload) · Subcategory · **Coach Taxonomy** (Age Band *derived*, Game Format, Practice Type, Setup Time, Learning Outcome, **Session Block Fit**: Activation/Technical/Tactical/Game/Recovery, Coaching Focus) · **Field Size** (auto-synced from the pitch, or manual override) · **Delivery Constraints** (min/max players, indoor compatible, wet-weather fallback) · **Equipment & Setup** — *derived from what's actually on the board*, with manual override
- **Variants** — drill families (requires save)
- **Effectiveness** — usage insights (requires save)
- **Explain** — coach notes, player notes, board-scene link → powers a public player-facing mobile explainer

### Export & share
Filename · size preset (`Pitch Ratio (Full Pitch) · 1920×1244`) · quality (2× gated) · framing (*My view* / *Auto*) → **PNG** · **MP4** · **GIF** · **Coach's Card (PDF)** — *"printable one-page drill card for clipboard"*. Plus a QR **Player Explanation** link.

### Library
249 drills, 14 categories, filters by age / session block / players / level, cards showing thumbnail, category, duration, level, intensity, player count, age band and a 3-letter code.

### Implementation notes worth knowing
- **They use Konva too** — console shows `Konva warning: the stage has 7 layers`. Same rendering stack as Gaffer. Their layer split is roughly pitch / overlays / markings / equipment / entities / onion-skin / interaction.
- 3D is a **separate renderer over the same drill data**, not a different document.
- Radix primitives (`data-slot="tooltip-trigger"`, `bg-popover`), Tailwind, Next.js.
- Onboarding uses `data-onboarding-anchor="..."` attributes and a replayable 12-step walkthrough.
- Toast feedback on every mutation (*"Player added"*).

---

## 2. What Gaffer has today, and who depends on it

| File | Role today | Fate |
|---|---|---|
| `src/components/design/DrillPreview.tsx` | The whole editor: tool rail, drag-to-place, arrow/note/remove modes, phase filmstrip, phase meta form, create-drill form | **Replaced** — split into a shell + ~12 components |
| `src/components/design/PitchCanvas.tsx` | Presentational Konva stage; renders one `DrillPhase` | **Kept, generalised** — renders a *frame*, not a phase |
| `src/components/design/pitchGeometry.ts` | Metre-based markings for 4 sizes × 2 orientations | **Kept, generalised** to arbitrary `w×l` metres |
| `src/components/design/pitchTheme.ts` | The one place canvas colours live | Kept, extended |
| `src/components/design/DrillLibrary.tsx` | Search + read-only phase-cut preview | Updated (Stage 9) |
| `src/store/slices/drillSlice.ts` | `phases[]` CRUD, one Supabase write per mutation | **Rewritten** |
| `src/store/types.ts` | `DrillPhase`, `Drill`, `PitchSize`, `PitchOrientation` | Extended + deprecations |
| `src/components/SessionDrillsPanel.tsx` | Shows `pitchLabel(pitch_size, orientation)` | Small update (Stage 7) |
| `src/components/tactics/TacticBoard.tsx` | **Reuses `PitchCanvas` by adapting tactic data into a `DrillPhase`-shaped object** | ⚠️ Must be adapted in the same change as Stage 3 or it breaks |

**Current capability gaps vs. the target:** no entity identity, no timeline, no tweening, no selection model, no properties panel, no undo/redo, no zoom/pan, no grid/snap/guides, no zones or freehand drawing, no equipment beyond 3 types, no pitch presets beyond 4 sizes, no drill metadata beyond name/size/orientation, no export, no thumbnails, no 3D, no onboarding, no autosave (every mutation is a full-document write).

---

## Stage 1 — Data model: entities + keyframes

**Size:** L · **Depends on:** nothing · **Everything else depends on this.**

**Why first:** as set out in §0, no later feature is expressible against `phases[]`.

### 1.1 New types (`src/store/types.ts`)

```ts
// A cast member. Stable id for the entire life of the drill — this is the
// property phases[] never had, and the one every animation feature needs.
export type EntityKind = 'player' | 'ball' | 'equipment'
export type PlayerDisplay = 'compact' | 'standard' | 'presentation' | 'dot'
export type BodyShape = 'auto' | 'backpedal' | 'shuffle_left' | 'shuffle_right'

export interface SceneEntity {
  id: string
  kind: EntityKind
  // players
  team?: string              // 'A' | 'B' — drives colour, as PhasePlayer.team does today
  number?: number            // auto-assigned per team on create
  label?: string
  color?: string             // per-entity override of the team colour
  goalkeeper?: boolean
  display?: PlayerDisplay
  // equipment
  equipment?: EquipmentType  // see Stage 6
}

// Where one entity is at one keyframe.
export interface EntityState {
  x: number                  // normalized 0-1, unchanged convention
  y: number
  facing?: number            // degrees; omitted = derive from travel direction
  bodyShape?: BodyShape
  path?: PhasePoint[]        // custom multi-point route to the NEXT keyframe
  hidden?: boolean           // entity not on the pitch at this keyframe
}

export interface Keyframe {
  id: string
  t: number                  // seconds from drill start
  name?: string
  description?: string
  states: Record<string, EntityState>   // entityId -> state
}

// Arrows, lines, shapes, zones, freehand, text. Static by default;
// `keyframeId` binds a marking to one keyframe (used by the migration to
// preserve today's per-phase arrows/notes losslessly).
export interface Marking {
  id: string
  kind: 'arrow' | 'line' | 'curve' | 'circle' | 'rect' | 'freehand' | 'zone' | 'text'
  points: PhasePoint[]
  style?: { stroke?: string; dash?: boolean; fill?: string; width?: number }
  text?: string
  keyframeId?: string | null
}

export interface DrillScene {
  entities: SceneEntity[]
  markings: Marking[]
}

export interface Drill {
  id: string
  team_id: string | null
  name: string
  scene: DrillScene
  keyframes: Keyframe[]
  duration_seconds: number
  pitch: PitchConfig          // Stage 7
  created_at: string
  // deprecated, dropped by migration 014 once the backfill is verified:
  // phases, pitch_size
}
```

### 1.2 Migration (`supabase/migrations/013_drill_scene_keyframes.sql`)

```sql
alter table drill add column scene jsonb not null default '{"entities":[],"markings":[]}'::jsonb;
alter table drill add column keyframes jsonb not null default '[]'::jsonb;
alter table drill add column duration_seconds integer not null default 15;
alter table drill add column pitch jsonb not null default
  '{"preset":"full","widthMeters":68,"lengthMeters":105,"orientation":"portrait","overlays":[]}'::jsonb;
```

Leave `phases` and `pitch_size` in place for now — dropping them is Stage 1.4, after the backfill is eyeballed.

### 1.3 Backfill

Write `supabase/migrations/013b_backfill_scene.sql` (or a one-off `scripts/backfill-drills.ts` if the JSON walk is clearer in TS — 11 rows, either is fine). Rules:

1. Union every phase's `players` / `cones` / `balls` **by element id** → `scene.entities`. Ids already carry across duplicated phases, so this correctly re-identifies the same marker.
2. For phase *i*, emit `keyframes[i]` with `t = Σ duration_seconds of phases 0..i-1` (default **3s** per phase where unset — the same `DEFAULT_PHASE_SECONDS` `DrillLibrary.tsx` already uses).
3. `keyframes[i].states[entityId] = {x, y}` for elements present in that phase; `{hidden: true}` for entities absent from it.
4. Each phase's `arrows` → `markings` with `kind: 'arrow'`, `points: [from, to]`, `style.dash` from `kind === 'ball'`, and `keyframeId` = that phase's keyframe. Same for `annotations` → `kind: 'text'`.
5. `duration_seconds` = total of all phase durations (min 5s).
6. `pitch` derived from the old `pitch_size` / `orientation` via the Stage 7 preset table.

### 1.4 Drop the old columns

Once a manual read-back of all 11 drills in the new editor looks right, `supabase/migrations/014_drop_drill_phases.sql` drops `phases` and `pitch_size` and strips every remaining reference — following the 008 / 009 / 010 precedent that `CLAUDE.md` names.

**Definition of done:** all 11 existing drills round-trip through the new shape with the same markers in the same places; `phases` is gone from the DB and from `src/`.

**Verify:** `select id, name, jsonb_array_length(keyframes), jsonb_array_length(scene->'entities') from drill;` matches the old phase/element counts. `npm run build` clean. Open every existing drill in the editor and confirm nothing moved.

**Execution:** `claude-opus-5` · effort **`max`** · **~4–7M in / ~180–280K out** · **2.5–4h** · ~$25–42
Highest-consequence stage in the plan: it rewrites the shape of real data and is the one step that's genuinely painful to redo. `max` is the setting for "correctness matters more than cost". Run the backfill against a Supabase branch first, diff the output, then apply to `main`. Don't delegate the backfill logic to a subagent — it needs the whole `phases[]` history in context.

---

## Stage 2 — Store: entity/keyframe actions, undo/redo, autosave

**Size:** M · **Depends on:** 1

**Why:** `drillSlice`'s current contract — *local mutation, then the caller fires exactly one `updateDrill`* — is right in spirit but does not survive a timeline. Dragging a player across a 15-second animation with a scrubbing playhead would fire dozens of full-document writes.

1. Rewrite `src/store/slices/drillSlice.ts` around entities and keyframes:
   - `addEntity(drillId, kind, position, extra)` — auto-assigns the next `number` within `team`
   - `updateEntity(drillId, entityId, patch)` / `removeEntity` (removes it from every keyframe's `states` too)
   - `setEntityPosition(drillId, keyframeId, entityId, {x,y})` — the drag hot path, local-only
   - `addKeyframe(drillId, t)` / `updateKeyframeState(drillId, keyframeId)` (recapture current positions) / `moveKeyframe(drillId, keyframeId, t)` / `deleteKeyframe` / `clearKeyframes` / `balanceTiming(drillId)` (evenly redistribute over `duration_seconds`)
   - `addMarking` / `updateMarking` / `removeMarking`
   - `setDrillPitch(drillId, pitch)` / `setDuration(drillId, seconds)`
2. **Undo/redo** — a bounded snapshot stack (~50) of `{scene, keyframes, duration_seconds, pitch}` per drill, pushed by every *committed* mutation (drag-end, not drag-move). Expose `undo()` / `redo()` / `canUndo` / `canRedo`. Keep it in the slice, not a component — the top bar and keyboard shortcuts both need it.
3. **Autosave** — replace "one write per mutation" with a debounced flush (~800 ms idle, plus a forced flush on unmount, route change and `beforeunload`). One `saveState: 'saved' | 'dirty' | 'saving' | 'error'` field drives the top bar indicator. All Supabase traffic still funnels through `runSupabaseAction` per `CLAUDE.md`; the debounce sits above it, not inside it.

**Definition of done:** dragging a player for 5 seconds produces exactly one Supabase write; Ctrl+Z steps back through the last 50 committed edits.

**Verify:** DevTools Network panel — count `PATCH /rest/v1/drill` calls during a continuous drag (expect 1). Force an offline state mid-edit and confirm `saveState` goes to `error` and surfaces in the top bar rather than silently losing work.

**Execution:** `claude-opus-5` · effort **`xhigh`** · **~2.5–4M in / ~120–180K out** · **1.5–2.5h** · ~$16–25
Pure architecture inside one file plus its callers. The undo stack and the autosave debounce both have subtle lifecycle bugs available (flush-on-unmount, stale drill id, snapshot-on-dragmove) that `high` tends to hand-wave and `xhigh` catches.

---

## Stage 3 — Canvas: frame interpolation, selection, transform

**Size:** L · **Depends on:** 1, 2

**Why:** this is the stage that keeps `PitchCanvas` honest. `CLAUDE.md` states the rule that makes the canvas reusable — *"PitchCanvas only ever renders positions/shapes handed to it and reports interactions back via callbacks — it never talks to Supabase."* Interpolation is the seam that preserves it: a pure function turns `(scene, keyframes, t)` into a `RenderFrame`, and `PitchCanvas` renders a frame exactly as it renders a phase today.

1. New `src/components/design/canvas/interpolate.ts`:
   ```ts
   export interface RenderFrame {
     entities: Array<SceneEntity & { x: number; y: number; facing: number }>
     markings: Marking[]
   }
   export function frameAt(scene: DrillScene, keyframes: Keyframe[], t: number): RenderFrame
   ```
   - Find the bracketing keyframes; clamp before the first and after the last.
   - Linear lerp on `x`/`y`; if the entity's state at the earlier keyframe has a `path`, sample along that polyline (Catmull-Rom for a natural run) instead of a straight line.
   - `facing`: use an explicit `facing` if set, otherwise derive from the travel vector — unless `bodyShape` is `backpedal` (180°) or `shuffle_*` (±90°).
   - `hidden` entities are omitted from the frame.
2. Change `PitchCanvas`'s prop from `phase: DrillPhase | null` to `frame: RenderFrame | null`, and `pitchSize/orientation` to `pitch: PitchConfig`.
3. **Adapt `TacticBoard.tsx` in the same commit.** It currently builds a `DrillPhase`-shaped object to reuse the canvas; give it a small `toRenderFrame()` adapter instead. Skipping this breaks the tactics board.
4. Add a **selection model**: `selectedIds: string[]` (editor-local React state, not the store — it's view state). Click to select, shift-click to add, marquee drag on empty pitch to box-select, Escape to clear, Delete to remove.
5. Add **transform affordances**: multi-select drag, arrow-key nudge (1 px, 10 px with Shift), and a Konva `Transformer` for rotating/scaling markings.
6. Add **zoom & pan**: mouse wheel / pinch to zoom, space-drag or two-finger drag to pan, plus a "fit to pitch" reset. This is currently absent and is the biggest single ergonomics gap on a small pitch preset.
7. Split rendering into layers mirroring Teloframe's structure — `PitchLayer`, `OverlayLayer`, `MarkingsLayer`, `EquipmentLayer`, `EntityLayer`, `OnionSkinLayer`, `InteractionLayer`. Keep it at **7 or fewer**; Konva warns past that.

**Definition of done:** scrubbing a playhead across two keyframes moves markers smoothly; box-select + drag moves a group; the tactics board still renders.

**Verify:** `npm run build` + `npm run lint`. Manual: create 2 keyframes 5s apart, scrub, confirm smooth motion. Open `/tactics` and confirm no regression.

**Execution:** `claude-opus-5` · effort **`xhigh`**, `max` for `interpolate.ts` · **~6–10M in / ~250–400K out** · **3.5–5.5h** · ~$36–60
The hardest stage. `interpolate.ts` is the correctness core everything downstream reads through — worth its own `max`-effort pass and its own commit before the `PitchCanvas` refactor starts. Give the whole task spec up front rather than drip-feeding; long-horizon agentic work degrades when the goal arrives in pieces. Budget a second session for the `TacticBoard` adaptation if the first runs long.

---

## Stage 4 — Timeline & playback

**Size:** L · **Depends on:** 2, 3

**Why:** the visible payoff of Stages 1–3, and the feature that most distinguishes the two editors.

1. `src/components/design/timeline/useTimelinePlayback.ts` — a `requestAnimationFrame` clock owning `currentTime`, `playing`, `speed` (0.25×/0.5×/1×/2×), `loop`. Never store `currentTime` in Zustand; it changes 60×/sec and would thrash every subscriber.
2. `TimelineBar.tsx` — clock `mm:ss / mm:ss`, keyframe count, transport (skip-start, prev keyframe, play/pause, next keyframe, skip-end), speed cycle, loop toggle, **onion-skin** toggle, expand/collapse.
3. `TimelineEditor.tsx` — the expandable track:
   - Time ruler with tick labels; click-to-scrub; draggable playhead.
   - Keyframe diamonds on the track, **draggable to retime** (writes through `moveKeyframe`).
   - **Context-aware primary button**: *Add Keyframe* when the playhead is between keyframes, *Update Keyframe* when it's on one — with a dirty dot when the pitch differs from the stored state.
   - *Delete* · *Clear Keyframes* · *Balance timing* · duration control.
   - **Per-segment readout** rendered on each segment bar: `{seconds}s · P {playerMax} m/s · B {ballMax} m/s`.
4. `speeds.ts` — the physics. Convert normalized Δ to metres via `pitch.widthMeters`/`lengthMeters`, divide by segment seconds, take the max across entities of each kind. Colour-code the segment bar against realistic ceilings (**player ~8 m/s**, **ball ~25 m/s** for a driven pass): green under, amber approaching, red over. This is cheap to build once pitch dimensions are in real metres (Stage 7) and is the highest-value coaching feature in the whole target app — it catches drills that are physically impossible before a coach takes them to a session.
5. **Onion skin** — render the previous and next keyframe's frames at low opacity beneath the live one. Trivial once `frameAt` exists: call it twice more.
6. Keyboard: `Space` play/pause, `←`/`→` step frame, `,`/`.` prev/next keyframe, `K` add/update keyframe.

**Definition of done:** a 3-keyframe drill plays back smoothly, loops, scrubs, and shows honest speed numbers per segment.

**Verify:** build a two-keyframe drill where a player crosses a full pitch in 1 second and confirm the segment turns red at ~105 m/s. Set it to 15 s and confirm it goes green at ~7 m/s.

**Execution:** `claude-opus-5` · effort **`xhigh`** · **~5–8M in / ~220–350K out** · **3–4.5h** · ~$30–49
`useTimelinePlayback` is a rAF loop with real re-render hazards (the "never put `currentTime` in Zustand" rule is the one an `high`-effort pass is most likely to violate). `speeds.ts` is small but is the stage's headline feature — check its arithmetic by hand against the two-keyframe test above rather than trusting the first implementation.

---

## Stage 5 — Editor shell

**Size:** M · **Depends on:** 3, 4

**Why:** the current single 917-line component cannot host the panel count this plan adds, and its right-hand tool rail has no room for a contextual properties panel.

1. New `src/pages/DrillEditorPage.tsx` at route `/design/:drillId` (`src/App.tsx`), with `/design` becoming a drill picker/new-drill landing. Deep-linking to a drill is currently impossible and will be needed by the library, session planner and share links.
2. `DrillEditor.tsx` — layout only:
   - `EditorTopBar.tsx` — back, inline name field, undo/redo, save-state indicator, export, 2D/3D toggle (disabled until Stage 11), details button.
   - `ToolRail.tsx` — **left** rail, one active tool at a time: Select · Player · Ball · Equipment · Markings · team colour · Grid & Guides · Pitch · Details. Tools open Radix popovers anchored to the rail (mirrors Teloframe; Gaffer already has `Dropdown.tsx` to model the pattern on).
   - `PropertiesPanel.tsx` — **right**, contextual: keyframe list when nothing is selected, entity properties when something is.
   - Timeline docked bottom.
3. **Responsive**, matching what Teloframe does below ~1000px and what `AppShell.tsx` already does below `lg`: rail collapses to a drawer, right panel becomes a sheet, and a floating dock appears (**Tools · ▶ · Props**). Gaffer is explicitly a pitch-side mobile-first app — this is not optional polish.
4. Keep both drag-to-place (today's gesture, which works by touch) **and** click-tool-then-tap-pitch (Teloframe's). The existing `PlacementMode` comment argues drag reads more naturally; Teloframe proves tap-to-place scales better to 11 tools. Support both — the pointer-event machinery in `DrillPreview.tsx:349-405` already handles touch and is worth carrying over.
5. Toast feedback on placement/deletion (Teloframe's *"Player added"*). No toast component exists yet — add a minimal one to `src/components/ui/`.

**Definition of done:** every tool reachable from the rail, properties panel tracks selection, editor usable one-handed on a phone.

**Verify:** walk the editor at 390 px, 800 px and 1440 px widths in the Browser pane. Confirm no horizontal body scroll and ≥44 px tap targets.

**Execution:** `claude-opus-5` · effort **`high`** · **~3–5M in / ~150–230K out** · **2–3h** · ~$19–31
Mostly composition and responsive layout — a lot of mechanical file creation against patterns that already exist (`AppShell.tsx` for the responsive shell, `Dropdown.tsx` for the popover). `high` is the sweet spot here; `xhigh` buys little on layout work. Good candidate for **`/fast`** if you're watching it run — it's the same Opus 5 at higher output throughput, priced at $10/$50, so it buys wall-clock, not capability.

---

## Stage 6 — Element library & per-entity properties

**Size:** M · **Depends on:** 5

**Why:** Gaffer has 3 equipment types (pole, cone, mannequin) against Teloframe's 11, and no per-entity properties at all.

1. Extend `EquipmentType` to the full set: `cone · marker · pole · mannequin · mini_goal · agility_ring · full_goal · ladder · hurdle · rebounder · passing_gate`. Because equipment lives in jsonb, this needs **no migration** — exactly the extensibility `CLAUDE.md` describes for `drill.phases`, and it still holds for `drill.scene`.
2. Draw each in `pitchTheme.ts` + a new `EquipmentShapes.tsx`. Keep the existing house rule: *shape distinction over palette*, 2–3 colours per phase for pitch-side legibility.
3. `EquipmentPanel.tsx` — grouped Core / Advanced, matching the target.
4. `MarkingsPanel.tsx` — the 9 drawing tools: select, arrow, line, curved arrow, circle, rectangle, freehand pen, zone, ruler, + Clear All. Curved arrows and zones are what Gaffer most obviously lacks for expressing a passing pattern or a pressing trap.
5. `PropertiesPanel` entity sections:
   - **Player:** display style (Compact/Standard/Presentation/Dot), team, number, label, individual colour, **goalkeeper**, **facing**, **body shape**, **Draw Route** (multi-point path to the next keyframe — gate it exactly as Teloframe does, disabled unless the playhead is on a keyframe that has a successor).
   - **Ball:** none beyond position (keep it simple).
   - **Equipment:** type, colour, rotation, quantity-along-a-line helper.
   - **Marking:** stroke colour, dashed, width, fill, text.
6. `GridPanel.tsx` — Show Grid, Snap to Grid, Smart Guides (alignment guides while dragging). Snap makes cone grids and rondo boxes tolerable to build; without it, every drill looks hand-wobbled.

**Definition of done:** a rondo drill with a cone grid, a passing gate, curved passing arrows and a zoned area can be built entirely from the rail.

**Verify:** rebuild one of the 11 existing drills plus one new rondo from scratch; confirm equipment renders legibly at phone size against `design.md`'s legibility bar.

**Execution:** mixed · **~3.5–6M in / ~200–300K out** · **2–3.5h** · ~$15–28
Split it. The eleven equipment shapes are independent, repetitive SVG/Konva authoring — fan them out to **subagents at effort `low`** (the documented use for `low`: subagents and simple tasks), or run them on `claude-sonnet-5` at `high`. Keep the properties panel and the `MarkingsPanel` drawing tools on **`claude-opus-5` · `high`** — the Draw Route gating and the marking transform maths are where the real decisions are. Parallelising the shapes is what pulls this stage under three hours.

---

## Stage 7 — Pitch presets & overlays

**Size:** M · **Depends on:** 1 (can run parallel to 4–6)

**Why:** `PitchSize` is 4 values × 2 orientations. Teloframe ships ~35 presets keyed to real metre dimensions — which is also what makes the Stage 4 speed readout meaningful.

1. New `src/components/design/canvas/pitchPresets.ts`:
   ```ts
   export interface PitchConfig {
     preset: string                     // 'full' | 'rondo_20' | 'guardiola_4v4_3' | 'custom' | …
     widthMeters: number
     lengthMeters: number
     orientation: PitchOrientation
     markings: 'full' | 'grid' | 'none'
     overlays: OverlayKind[]
     surface?: string
     units?: 'm' | 'yd'
   }
   ```
   Populate all five families from §1 above (they're already measured — just transcribe the table).
2. Generalise `pitchGeometry.ts`: today `getPitchMarkings(size, orientation)` switches over 4 hand-authored constants. Change it to `getPitchMarkings(config)` deriving markings from `widthMeters`/`lengthMeters` — full markings when the pitch is big enough for a penalty box, a plain boundary + optional grid otherwise. The existing metres-based authoring and the `transpose()` orientation swap both carry over unchanged; this is a generalisation, not a rewrite.
3. `PitchPanel.tsx` — family tabs, preset cards with a mini SVG and the real dimensions, m/yd toggle, portrait switch, custom `w × l` inputs.
4. **Overlays** — Thirds · 5 Channels (25/75) · Lanes (5) · Half-Spaces · Pep 20 Zones · Training Grid, with an opacity slider. Render in `OverlayLayer` under everything else.
5. Migrate `pitch_size` → `pitch` (part of the Stage 1 backfill): `full→105×68`, `three_quarter→79×68`, `half→53×68`, `quarter→35×68`.
6. Update `SessionDrillsPanel.tsx:13-14, 131, 222` and `DrillLibrary.tsx:66-71, 157-158` — replace `pitchLabel(pitch_size, orientation)` with a preset label + dimensions.

**Definition of done:** a coach can pick "Guardiola 4v4+3" and get a correctly proportioned 17×23 m grid; Pep 20 Zones overlays a full pitch.

**Verify:** confirm the centre circle stays circular on every preset (this is exactly what `pitchGeometry.ts`'s equal-px-per-metre invariant protects — re-check it after generalising).

**Execution:** mixed · **~2.5–4M in / ~150–220K out** · **1.5–2.5h** · ~$10–18
Two different jobs. Transcribing ~35 presets from the table in §1 into `pitchPresets.ts` is data entry — **`claude-sonnet-5` · `medium`** is plenty and roughly a third the price. The `pitchGeometry.ts` generalisation is not: it has to preserve the equal-px-per-metre invariant that keeps centre circles circular, so run that part on **`claude-opus-5` · `high`**.

---

## Stage 8 — Drill metadata & the Details drawer

**Size:** M · **Depends on:** 5

**Why:** Gaffer's drill record is `name + pitch_size + orientation`. Everything that makes a drill *findable and coachable* — objective, coaching points, progressions, session-block fit — doesn't exist. This is what turns a diagram into a session asset.

1. `supabase/migrations/015_drill_metadata.sql` — real columns (unlike scene content, these get filtered and sorted, so they must not live in jsonb):
   ```sql
   alter table drill
     add column objective         text,
     add column description       text,
     add column category          text,
     add column subcategory       text,
     add column duration_minutes  integer,
     add column players_recommended integer,
     add column min_players       integer,
     add column max_players       integer,
     add column age_min           text,
     add column age_max           text,
     add column difficulty        text,
     add column intensity         text,
     add column phase_of_play     text,
     add column session_block     text,   -- activation|technical|tactical|game|recovery
     add column setup_minutes     integer,
     add column learning_outcome  text,
     add column video_url         text,
     add column thumbnail_url     text,
     add column coaching          jsonb not null default '{}'::jsonb;  -- points/progressions/regressions/mistakes/setup
   create index on drill (category);
   create index on drill (session_block);
   ```
2. `DrillDetailsDrawer.tsx` with tabs **Basic Info · Pitch · Coaching · Settings** (drop Variants / Effectiveness / Explain — see *Not planned*).
   - *Coaching* tab: repeatable list builders for Coaching Points, Progressions, Regressions, Common Mistakes, plus a Setup Instructions textarea. Model the list builder on `PlayerNotes.tsx`'s add/remove pattern.
   - *Settings* tab: difficulty, intensity, phase of play, session block, setup time, learning outcome, video URL, min/max players.
3. **Derived-equipment summary** — the best small idea in their Settings tab: read `scene.entities.filter(kind === 'equipment')`, group by type, and render *"Cones ×12, Poles ×4, Mini Goal ×2"* automatically, with a manual override. Zero extra data entry; always correct.
4. **Derived field size** — show `pitch.widthMeters × pitch.lengthMeters` read-only in Details, sourced from the pitch config.
5. **Thumbnails** — `stage.toDataURL()` on the Konva stage at the first keyframe, uploaded to a Supabase Storage bucket on save (auto if the coach hasn't captured one). Needed by Stage 9's cards.

**Definition of done:** a saved drill carries enough metadata to be filtered by block, level and player count.

**Verify:** save a drill with full metadata, reload, confirm every field round-trips. Confirm the equipment summary updates when a cone is added to the board.

**Execution:** mixed · **~3–5M in / ~180–260K out** · **2–3h** · ~$14–24
The migration and the derived-equipment/field-size logic want **`claude-opus-5` · `high`**. The four drawer tabs are ~19 form fields and four list builders against an existing pattern (`PlayerNotes.tsx`) — **`claude-sonnet-5` · `high`** handles that well and is the cheapest large win in the plan.

---

## Stage 9 — Library, cards & session integration

**Size:** M · **Depends on:** 8

**Why:** metadata is only worth entering if something consumes it. `DrillLibrary.tsx` currently searches name + pitch label only.

1. Rework `DrillLibrary.tsx` into a card grid: thumbnail, name, category chip, duration, level, intensity, player count, age band.
2. Filter bar mirroring the target: search · age · session block · players · level · more filters. All client-side — the existing "this scale doesn't need server-side search" note still holds at 11 drills, and will hold at a few hundred.
3. Replace the phase-cut preview with real animated playback — reuse `useTimelinePlayback` + `frameAt` read-only. This retires the `DrillLibrary.tsx:29-40` comment about interpolation being impossible; Stage 1 made it possible.
4. `SessionDrillsPanel.tsx` — show the richer card in the picker, and use `duration_minutes` / `session_block` to help slot a drill into a session.
5. "Duplicate drill" — a straight `scene`+`keyframes` copy. Currently only phases can be duplicated, not whole drills, which is the more useful unit.

**Definition of done:** finding a 12-minute technical rondo for 8 players takes one filter pass.

**Verify:** filter combinations return correct sets; the animated preview plays without opening the editor.

**Execution:** `claude-sonnet-5` · effort **`high`** · **~2.5–4M in / ~140–200K out** · **1.5–2.5h** · ~$6–15
Almost entirely UI over an API that Stages 4 and 8 already settled — card grid, client-side filters, and a read-only reuse of `frameAt`. No new architecture, so Opus buys little. (At Sonnet 5's intro rate of $2/$10, in effect through 2026-08-31, this lands nearer the bottom of that range.)

---

## Stage 10 — Export & share

**Size:** M · **Depends on:** 4, 8

**Why:** a drill that can't leave the app can't be handed to an assistant coach or pinned to a clipboard. This is the highest-leverage stage for real-world use and has no dependency on 3D.

1. **PNG** — `stage.toDataURL({ pixelRatio: 2 })` at the current playhead. Cheap; do this first.
2. **Coach's Card (PDF)** — the single most valuable export: one printable A4/Letter page with the pitch diagram, name, objective, duration, players, equipment summary, setup instructions, coaching points and progressions/regressions. Build it as a print-styled route (`/drills/:id/card` + `@media print`) rather than adding a PDF library — no new dependency, and it prints from any device.
3. **GIF / MP4** — sample `frameAt` at ~25 fps into an offscreen Konva stage, encode client-side. GIF via `gif.js`; MP4 via `WebCodecs` + `mp4-muxer` where supported, with a GIF fallback. This is the one place a new dependency is genuinely warranted. Treat as the last item of this stage — it's the largest and the most deferrable.
4. **Share link** — a public read-only `/d/:token` route rendering the animation + coaching points, plus a QR code, mirroring Teloframe's Player Explanation. Requires an RLS-visible `share_token` column and a public-select policy scoped to non-null tokens. ⚠️ This publishes drill content on a guessable-if-short URL — use a 128-bit token and make sharing explicitly opt-in per drill.

**Definition of done:** a coach can print a drill card and text a teammate a link that animates.

**Verify:** print preview at A4 with no clipping; open the share link in a private window (signed out) and confirm it renders and that no other drill is reachable by changing the token.

**Execution:** mixed · **~4–6.5M in / ~200–300K out** · **2.5–4h** · ~$22–38
PNG and the print-styled Coach's Card are straightforward — **`claude-sonnet-5` · `high`**. The GIF/MP4 encoder (offscreen stage, frame sampling, `WebCodecs` with a fallback path) and the **share-link RLS policy** both want **`claude-opus-5` · `xhigh`**: an RLS mistake here is a data-exposure bug, not a rendering bug, so verify the policy by hand rather than on the model's say-so.

---

## Stage 11 — Onboarding (and the 3D question)

**Size:** onboarding S · 3D XL · **Depends on:** 5

1. **Onboarding walkthrough** — an 8–10 step coach-mark tour, replayable from the editor. Add `data-onboarding-anchor` attributes as you build Stages 5–7 so this becomes cheap later rather than a retrofit. Worth doing: the new editor is substantially more complex than today's, and a tour is the difference between "powerful" and "impenetrable".

2. **3D view — recommend deferring, decide explicitly.**
   Teloframe's 3D is a separate WebGL renderer over the same drill data (their 2D is Konva, exactly like Gaffer's). Building it means: `three` + `@react-three/fiber` + `drei`, a pitch mesh, rigged player models with run/backpedal/shuffle animation clips, ball physics for the goalkeeper behaviour, a camera rig with Broadcast/Top/Side/Corner presets and lens control, and an environment system — plus the bundle cost on a PWA that is explicitly built for pitch-side mobile use.

   Against that: **the 2D view is what a coach actually reads pitch-side**, and Teloframe itself gates 3D video export behind a paid tier. The `scene`/`keyframes` model from Stage 1 is renderer-agnostic by construction, so nothing here is a one-way door — 3D can be added later without touching the data model. **Recommendation: ship Stages 1–10 first, then decide with the editor in hand.**

**Execution — onboarding:** `claude-sonnet-5` · effort **`medium`** · **~1–2M in / ~60–100K out** · **45–90min** · ~$3–5
A tour is a list of anchors and copy. If the `data-onboarding-anchor` attributes went in during Stages 5–7 as advised, this is close to mechanical.

**Execution — 3D (if you decide to do it):** `claude-opus-5` · effort **`max`** · **~12–25M in / ~500–900K out** · **8–16h across 3–5 sessions** · ~$75–150
Not a single-session task at any effort level, and the only stage where the estimate is genuinely a guess rather than an extrapolation — most of the cost is iterating on a renderer you can only judge by looking at it, which no amount of effort setting shortens. Its own branch, with a hard "if it isn't convincing by session 3, stop" gate.

---

## Reading the execution estimates

Every stage above ends with a recommended model, an effort level, a token range, wall-clock, and an indicative cost. How to read them:

**Models** — `claude-opus-5` ($5/$25 per MTok) is the default for anything that decides architecture or touches data. `claude-sonnet-5` ($3/$15, or $2/$10 at the intro rate running through 2026-08-31) is recommended where a stage is mostly filling in an already-settled pattern — forms, cards, filters, repetitive shape authoring. `claude-haiku-4-5` isn't recommended anywhere here; nothing in this plan is simple enough. `claude-fable-5` ($10/$50) would handle any of it, but nothing in this plan needs capability beyond Opus 5.

**Effort** (`low` · `medium` · `high` · `xhigh` · `max`) — set with `output_config.effort`; `high` is the default if unset, `xhigh` is Claude Code's own default and the documented sweet spot for coding and agentic work. Read the recommendations as: `max` where a mistake is expensive to undo (Stage 1's migration, 3D), `xhigh` where the logic is subtle (Stages 2–4, the export encoder, the RLS policy), `high` for layout and composition, `medium`/`low` for transcription and subagent fan-out. Lower effort doesn't just cost less — it also produces fewer, more consolidated tool calls and less preamble, which is why it suits mechanical work specifically.

**Tokens** — input is dominated by the conversation being re-sent on every turn, not by the code being written; that's why an "L" stage costs millions of input tokens against a few hundred thousand output. **Claude Code caches the conversation prefix aggressively, so the large majority of those input tokens bill as cache reads at a fraction of the headline rate. Treat the cost figures as an upper bound, not an expected invoice.**

**Wall-clock** assumes you let a stage run with light supervision. Reviewing every step roughly doubles it; so does splitting a stage across sessions, since each new session re-reads context. The ranges assume a fresh session per stage — starting Stage 4 inside the same session that finished Stage 3 costs more per turn, not less, because the Stage 3 transcript rides along in every request.

**These are extrapolations, not measurements.** They're anchored on this codebase's real size (~9,500 lines of `src/`, the four drill files totalling ~2,100) and the number of files each stage touches. Treat them as planning ranges: the ordering and relative sizing are the useful part, the absolute numbers less so. If a stage runs 2× over its range, that's a signal the scope drifted, not that the estimate was wrong.

**One cheap habit that moves these numbers most:** give each stage its full spec up front, in one message, rather than discovering it in conversation. Long-horizon agentic runs degrade measurably when the goal arrives in pieces, and every clarification round-trip re-sends the whole transcript.

### Totals

| | Stages 1–10 + onboarding | 3D (Stage 11.2, deferred) |
|---|---|---|
| Input tokens | **~37–61M** | ~12–25M |
| Output tokens | **~1.9–2.8M** | ~0.5–0.9M |
| Wall-clock | **~23–37h** | ~8–16h |
| Indicative cost at list rates | **~$195–335** | ~$75–150 |

Roughly a fortnight of evenings for the whole plan excluding 3D, or about a week of focused days. Stages 1–4 alone — the point at which a drill actually animates — are ~18–29M input tokens and **~11–17h**, a little under half the total.

---

## Sequencing

```
1 ─ 2 ─ 3 ─ 4 ─ 5 ─┬─ 6
                   ├─ 8 ── 9 ── 10
                   └─ 11 (onboarding)
        7 ────────────┘  (parallel from Stage 1; 4's speed readout wants it)
```

Stages 1–4 are one continuous piece of work — the app's drill editor will be **partially broken between Stage 1 and Stage 3**, so do them on a branch and don't ship halfway. Stages 5 onward are independently shippable.

**First meaningful demo:** end of Stage 4 — a drill that actually animates.
**First point the app is better than today for a real coach:** end of Stage 6.

---

## Not planned (and why)

| Excluded | Reason |
|---|---|
| **Variants / drill families** | A Teloframe library-scale feature. Gaffer has 11 drills; "duplicate drill" (Stage 9.5) covers the real need at this size. |
| **Effectiveness insights** | Requires usage telemetry Gaffer doesn't collect and a drill corpus large enough for the numbers to mean anything. |
| **AI-generated coaching points** | New dependency, new cost centre, new failure mode. The list builders in Stage 8 make manual entry fast; revisit only if entry proves to be the bottleneck. |
| **249-drill seeded content library** | That's a content operation, not an engineering one. Gaffer is a single-coach app with no publishing pipeline. |
| **Club/multi-tenant workspace, seasons, plan tiers** | Out of scope — Gaffer's stated model is one coach, multiple teams, no public signup. |
| **Pitch surfaces, mowing patterns, league colour presets** | Pure cosmetics, and the user said colours don't matter. `pitchTheme.ts` can absorb them later in an afternoon. |
| **Video upload** | Storage cost and moderation surface for a single-user app; a `video_url` field (Stage 8) covers linking to YouTube/Vimeo. |
| **Server-side search** | `DrillLibrary.tsx`'s existing note is right: this scale doesn't need it. |

---

## Decisions needed before Stage 1

1. **Markings across time.** This plan makes markings static by default with an optional `keyframeId` binding (which preserves today's per-phase arrows losslessly). The alternative — keyframing marking geometry too, so an arrow can grow as a pass is played — is more expressive and materially more work. **Default assumption: static + binding.** Say if you want the richer version.
2. **`/design` route shape.** Stage 5 proposes `/design/:drillId` with `/design` as a picker. This changes an existing route and the `TEAM_SCOPED_PATHS` list in `AppShell.tsx:39`. **Default assumption: do it** — deep links are needed by Stages 9 and 10.
3. **Share links (Stage 10.4)** publish drill content to unauthenticated readers. **Default assumption: build it, opt-in per drill, 128-bit tokens.** Say if you'd rather not have any public surface at all.
4. **3D (Stage 11.2)** — deferred by default per the reasoning above.

---

## Source of truth for this plan

- Teloframe drill editor at `https://teloframe.com/drills/new`, exercised live 2026-08-24 (signed-in session; players placed, keyframes created and retimed, playback run, 2D/3D toggled, export/details/pitch/equipment/markings panels enumerated).
- Public drill pages (e.g. `/training-drills/y-passing-drill-passing`) for the full metadata model.
- Gaffer source as of 2026-08-24: `DrillPreview.tsx`, `PitchCanvas.tsx`, `pitchGeometry.ts`, `pitchTheme.ts`, `DrillLibrary.tsx`, `drillSlice.ts`, `types.ts`, `App.tsx`, `AppShell.tsx`, `TacticBoard.tsx`, `SessionDrillsPanel.tsx`.
- Live Supabase project `zaougjiavbqdlgweidpc` — `drill` table columns and row counts queried directly.
- Project conventions: `CLAUDE.md`, `design.md`, `HANDOFF.md`.
