// Canvas color scheme — locked in by `discussion_visual_style.md` and spelled
// out concretely in `gaffer_mvp_build_steps.md` 2a: "navy/dark circles with
// white numbers for players, orange/yellow triangles for cones, white/off-
// white with dark outline for balls, red or black strong-contrast arrows."
// Kept to 2-3 colors per phase for pitch-side legibility — see 3.3's
// legibility Definition of Done, which this file is what that check runs
// against.
//
// This is the ONE place canvas colors live. Nothing in PitchCanvas should
// hardcode a hex value outside of here.

export const TURF = {
  fill: '#3f7d52', // mid-green — not too saturated, so markers pop (visual-style discussion)
  line: 'rgba(255, 255, 255, 0.75)', // thin white pitch lines
} as const

export const PLAYER = {
  // Team distinction is shape/2-color-pair, never a big palette (visual-style
  // discussion). The phase JSON's `team` field is freeform text (e.g.
  // "attack" in the 0.5.1 hardcoded phase) — we don't know the real values
  // ahead of time, so colors are assigned by first-seen-team-label order,
  // not by matching a specific string. See `assignTeamColor` in
  // pitchGeometry.ts.
  colors: ['#152238', '#b91c1c'] as const, // navy, then red
  fallback: '#475569', // slate-600, a third+ team label (shouldn't normally happen)
  numberText: '#ffffff',
} as const

export const CONE = {
  // Named colors from the phase JSON's optional `cones[].color` field map
  // here; anything unrecognized falls back to orange.
  named: {
    orange: '#f59e0b',
    yellow: '#eab308',
    red: '#ef4444',
    blue: '#3b82f6',
  } as Record<string, string>,
  fallback: '#f59e0b',
  stroke: '#7c4a03',
} as const

export const BALL = {
  fill: '#fefdf8', // off-white so it doesn't vanish against light markers
  stroke: '#1e293b',
} as const

export const ARROW = {
  stroke: '#dc2626', // red — strong contrast, reads at a glance mid-session
} as const

export const ANNOTATION = {
  background: '#fefdf8',
  border: '#1e293b',
  text: '#1e293b',
} as const
