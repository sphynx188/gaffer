// The onboarding walkthrough's content (rework plan Stage 11.1) — an 8–10 step
// coach-mark tour over the drill editor. Kept as plain data, separate from the
// component that renders it, so the copy can be read and edited without
// touching positioning/overlay logic.
//
// Each `anchor` matches a `data-onboarding-anchor` attribute placed on the
// element being introduced — ToolRail's buttons, PitchCanvas, TimelineBar, the
// properties panel, and the drill-name field in EditorTopBar. `placement` is
// only a preference: OnboardingTour falls back to whatever side actually fits
// the viewport.
//
// `openTools`/`openProperties` mark the steps whose anchor lives inside a
// mobile-only sheet rather than always being on screen — the editor uses
// these to open the right sheet before measuring where to draw the callout.
// On desktop both sheets are irrelevant (the panels are always visible
// there), so these flags are simply ignored above the `lg` breakpoint.
//
// They name the SIDE, not the contents, which is what lets the tactics editor
// reuse them (TACTICS_BOARD_REWORK_PLAN.md Stage 10.1):
//   openTools      → the LEFT sheet  — drill: the tool rail · tactic: Squad
//   openProperties → the RIGHT sheet — drill: properties   · tactic: Inspector
// The names are the drill editor's because it got here first; renaming them
// would touch a shipped tour to buy nothing.
//
// `TourStep` is the shared shape both editors' step lists are written in —
// the tactics list lives in components/tactics/tacticTourSteps.ts. The array
// below is the DRILL editor's content only.
export interface TourStep {
  id: string
  anchor: string
  title: string
  body: string
  placement: 'top' | 'bottom' | 'left' | 'right'
  openTools?: boolean
  openProperties?: boolean
  // Which of the properties panel's Tools/Timeline tabs (2026-08-31) must be
  // active for this step's anchor to exist at all — unlike openTools/
  // openProperties, which only matter below `lg` (both sheets are always
  // visible on desktop), the two tabs are mutually exclusive renders on
  // EVERY viewport, so this is set regardless of breakpoint. Tactics-only
  // and pitch/canvas/name steps leave it unset. Tactics has no such tabs at
  // all — this field is drill-only.
  panelTab?: 'tools' | 'timeline'
  // Below `lg` the app's primary nav is a hamburger DRAWER rather than the
  // desktop rail, so an app-shell step pointing at a nav entry has nothing to
  // measure until that drawer is open (2026-09-01). Exactly the same problem
  // openTools/openProperties solve for the editors' mobile sheets, and set
  // for the same reason — it names the surface, and the host opens it before
  // the tour measures. Unset on every editor step; those two are unset on
  // every app-shell step.
  openNav?: boolean
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'name',
    anchor: 'topbar-name',
    title: 'Name your drill',
    body: 'Tap the name at any time to rename it. Everything else here is autosaved as you go — there is no separate save button.',
    placement: 'bottom',
  },
  {
    id: 'select',
    anchor: 'tool-select',
    title: 'Select & move',
    body: 'Drag a player, ball or piece of equipment to reposition it. Drag a box around several to move them together.',
    placement: 'right',
    openTools: true,
  },
  {
    id: 'player',
    anchor: 'tool-player',
    title: 'Add players',
    body: 'Tap a team colour to arm it, then tap the pitch to place — or skip the tap and drag the swatch straight onto it.',
    placement: 'left',
    openProperties: true,
    panelTab: 'tools',
  },
  {
    id: 'equipment',
    anchor: 'tool-equipment',
    title: 'Cones, poles & goals',
    body: 'Eleven pieces of kit live here, from a single cone to a full goal — tap one to arm it, or drag it straight onto the pitch.',
    placement: 'left',
    openProperties: true,
    panelTab: 'tools',
  },
  {
    id: 'marking',
    anchor: 'tool-marking',
    title: 'Arrows & markings',
    body: 'Draw runs, passes, zones and notes on the pitch — everything from a straight arrow to a freehand note.',
    placement: 'left',
    openProperties: true,
    panelTab: 'tools',
  },
  {
    id: 'pitch-canvas',
    anchor: 'pitch-canvas',
    title: 'The pitch',
    body: 'This is the board. Pinch to zoom, and hold space to pan — useful once a drill gets busy.',
    placement: 'top',
  },
  {
    id: 'pitch-panel',
    anchor: 'rail-pitch',
    title: 'Pitch size & overlays',
    body: 'Pick from real pitch and grid formats, from a full 105×68m pitch down to a tight rondo box, plus zone overlays.',
    placement: 'right',
    openTools: true,
  },
  {
    // This anchor was orphaned between the 2026-08-29 migration that moved
    // the standalone timeline bar's controls into this panel and the
    // 2026-08-31 tabs — nothing rendered `data-onboarding-anchor=
    // "timeline-bar"` in between, so this step silently had nothing to
    // measure. Fixed here rather than left for later: the Timeline tab this
    // step is about is exactly the container that anchor now lives on.
    id: 'timeline',
    anchor: 'timeline-bar',
    title: 'Keyframes & playback',
    body: 'A drill is a timeline, not a single snapshot. Add a keyframe wherever the picture should change, then play it back to see it move.',
    placement: 'left',
    openProperties: true,
    panelTab: 'timeline',
  },
  {
    id: 'properties',
    anchor: 'properties-panel',
    title: 'Selection details',
    body: 'Select something on the pitch to change its appearance, facing or movement path here. Nothing selected shows your keyframes instead.',
    placement: 'left',
    openProperties: true,
  },
  {
    id: 'details',
    anchor: 'rail-details',
    title: 'Drill details',
    body: 'Objective, coaching points, level and player count all live here — this is what makes a drill findable later in the library.',
    placement: 'right',
    openTools: true,
  },
]
