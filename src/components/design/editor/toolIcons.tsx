import { BALL, PLAYER } from '../pitchTheme'

// Player A/B tool-icon colors — the same navy/red pair PitchCanvas assigns to
// whichever two team labels appear first (pitchTheme.ts's PLAYER.colors), used
// here directly since a tool icon is a static preview, not tied to a specific
// frame's actual assigned colors.
export const PLAYER_A_COLOR = PLAYER.colors[0]
export const PLAYER_B_COLOR = PLAYER.colors[1]

// Small previews matching pitchTheme.ts's actual canvas rendering — "the
// actual thing" rather than a text label, so the tool rail reads at a glance
// the same way the pitch itself does. Equipment has its own set in
// canvas/EquipmentShapes.tsx; most markings tools use plain lucide icons,
// ArrowToolIcon below being the one exception (markingTools.tsx).
export function PlayerToolIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8" fill={color} />
    </svg>
  )
}

export function BallToolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8" fill={BALL.fill} stroke={BALL.stroke} strokeWidth="1.5" />
    </svg>
  )
}

// Player run and Pass (markingTools.tsx) both draw a diagonal arrow but
// render as visibly different marks on the pitch — a run is a solid line, a
// pass a dashed one (pitchTheme.ts's ARROW.player/ARROW.ball) — so sharing
// lucide's plain MoveUpRight icon made two functionally different tools look
// identical in a list that's now permanently visible rather than tucked
// behind a flyout tap (2026-08-31). Reuses MoveUpRight's own path data
// rather than a new glyph, so every other row's line weight and arrowhead
// shape stay unchanged; only the shaft's dash pattern differs, mirroring
// the real distinction. Deliberately NOT colored to match ARROW's actual
// red/blue — those are canvas tokens, and chrome icons stay off that
// palette the same way PitchCanvas.tsx never reaches for a chrome token.
export function ArrowToolIcon({ dashed, className }: { dashed?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M13 5H19V11" />
      <path d="M19 5L5 19" strokeDasharray={dashed ? '3.5 3' : undefined} />
    </svg>
  )
}

