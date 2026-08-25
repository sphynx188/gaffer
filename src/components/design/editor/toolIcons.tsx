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
// canvas/EquipmentShapes.tsx, and the markings tools use plain icons.
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

