import type { TourStep } from '../design/editor/onboarding/tourSteps'

// The tactics editor's walkthrough (TACTICS_BOARD_REWORK_PLAN.md Stage 10.1).
// Plain data, like the drill editor's, so the copy can be edited without
// touching any positioning logic — and the same `TourStep` shape, walked by
// the same `useOnboardingTour` and drawn by the same `OnboardingTour`. Nothing
// here is a second implementation of anything.
//
// ── The arc is the plan's, in its order ───────────────────────────────────
// Stage 10.1 names it exactly: "dual view → formation → ball → draw → select
// → keyframe → animate → replay → save → export". That is ten steps and these
// are those ten, in that sequence. It is deliberately a different arc from the
// drill tour's, which walks a rail of tools: a tactic is a shape that MOVES,
// so this one teaches two sides, then a timeline, then the ways out.
//
// Two steps share the `timeline-bar` anchor (keyframe, animate). That strip is
// one element and teaches two separate ideas — where a change is recorded, and
// what playing it back does — and splitting a coach's attention across two
// callouts on the same control reads better than one paragraph doing both.
//
// `openProperties` opens the RIGHT sheet below `lg`, which in this editor is
// the Inspector (see tourSteps.ts — the flags name the side, not the
// contents). `openTools` opens the LEFT one, which here is the Squad panel.
export const TACTIC_TOUR_STEPS: TourStep[] = [
  {
    id: 'view',
    anchor: 'tactic-view',
    title: 'One side, or both',
    body: 'Single shows the side you are working on; Dual shows both teams facing each other. It is a filter over the same board, not two boards.',
    placement: 'bottom',
  },
  {
    id: 'formation',
    anchor: 'tactic-formation',
    title: 'Pick a shape',
    body: 'Twenty-nine formations, per side. Choosing one moves the players you already have into it rather than starting over — and you can save your own shape once you like it.',
    placement: 'right',
    openTools: true,
  },
  {
    id: 'ball',
    anchor: 'tactic-ball',
    title: 'Add the ball',
    body: 'A ball is just another thing on the board: drop it in, then move it between keyframes like any player.',
    placement: 'bottom',
  },
  {
    id: 'draw',
    anchor: 'tactic-tools',
    title: 'Runs, passes and zones',
    body: 'Fourteen drawing tools, each with a keyboard shortcut. Drawings have their own undo, separate from the animation — clearing your arrows can never rewind the movement.',
    placement: 'left',
    openProperties: true,
  },
  {
    id: 'select',
    anchor: 'tactic-canvas',
    title: 'Move people around',
    body: 'Drag a player to reposition them, or drag a box around several to move them together. Whatever you change is recorded into the keyframe you are parked on.',
    placement: 'top',
  },
  {
    id: 'keyframe',
    anchor: 'tactic-timeline',
    title: 'Keyframes',
    body: 'A tactic is a sequence, not a snapshot. Add a keyframe for each moment you want to show — the shape at the start, the shape after the press is broken — and they play back in that order.',
    placement: 'left',
    openProperties: true,
  },
  {
    id: 'animate',
    anchor: 'tactic-timeline',
    title: 'Watch it move',
    body: 'Press play and the players travel between your keyframes. Paths and trails show the routes they take, and Speed up or Slow down changes how fast you watch it.',
    placement: 'left',
    openProperties: true,
  },
  {
    id: 'replay',
    anchor: 'tactic-present',
    title: 'Show it to the squad',
    body: 'Presentation mode fills the screen and steps through your phases one at a time, so you can talk between them. Escape comes back here.',
    placement: 'bottom',
  },
  {
    // Anchored to the NAME field, not to the save indicator it talks about:
    // that indicator is `hidden sm:inline`, so on a phone it is display:none
    // and `findVisibleAnchor` correctly finds nothing — which would leave this
    // step as a dimmed screen with no card. The name field is always visible,
    // sits right beside the indicator on wider screens, and is the thing a
    // coach edits and then wonders whether they need to save. The drill tour's
    // first step makes the same pairing for the same reason.
    id: 'save',
    anchor: 'tactic-name',
    title: 'Nothing to save',
    body: 'Rename it here whenever you like. Every change is written for you a moment after you stop making it — there is no save button to forget.',
    placement: 'bottom',
  },
  {
    id: 'export',
    anchor: 'tactic-export',
    title: 'Take it with you',
    body: 'A still, an animated GIF, a printable one-page card, or a link anyone can open without an account. All of it lives behind this button.',
    placement: 'bottom',
  },
]
