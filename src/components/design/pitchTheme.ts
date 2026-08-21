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

// Agility pole — a tall slim shaft on a flat base (the internal `kind`/
// jsonb value stays 'cone' for backward compatibility with already-saved
// drills; only the label and rendering changed). Named colors from the
// phase JSON's optional `cones[].color` field map here; anything
// unrecognized falls back to yellow, matching the reference pole photo.
export const CONE = {
  named: {
    orange: '#f59e0b',
    yellow: '#eab308',
    red: '#ef4444',
    blue: '#3b82f6',
  } as Record<string, string>,
  fallback: '#eab308',
  base: '#18181b', // the pole's flat base
} as const

// Upgrade Phase 2B (UPGRADE_IMPLEMENTATION_PLAN.md) equipment type —
// distinguished from CONE (the agility pole) by shape, not just color, same
// "shape distinction over palette" rule PLAYER's comment sets out. Restyled
// to match a reference photo of a classic flat-base training cone: a
// tapered body on a flat pill-shaped base, single flat fill color, no
// stroke/stripe.
export const WITCHES_HAT = {
  fill: '#c0392b',
} as const

// Training mannequin/dummy — rendered as a ring head + mesh-look torso +
// splayed legs (not a plain circle) so it's never mistaken for a player dot
// at a glance. Blue, matching the common plastic-dummy training equipment
// this is meant to depict.
export const MANNEQUIN = {
  fill: '#2563eb',
  stroke: '#1e3a8a',
} as const

export const BALL = {
  fill: '#fefdf8', // off-white so it doesn't vanish against light markers
  stroke: '#1e293b',
} as const

// Upgrade Phase 2C (UPGRADE_IMPLEMENTATION_PLAN.md): two visually distinct
// arrow kinds — solid red for player movement (unchanged from before this
// distinction existed, so every pre-existing arrow with no `kind` still
// looks the same), dashed blue for ball/pass movement (blue matches CONE's
// existing "blue" named cone color, giving ball-related markings a
// consistent hue across the canvas).
export const ARROW = {
  player: { stroke: '#dc2626', dash: undefined as number[] | undefined },
  ball: { stroke: '#3b82f6', dash: [10, 6] as number[] | undefined },
} as const

export const ANNOTATION = {
  background: '#fefdf8',
  border: '#1e293b',
  text: '#1e293b',
} as const
