import { ANNOTATION, ARROW, BALL, CONE, MANNEQUIN, PLAYER, WITCHES_HAT } from '../pitchTheme'

// Player A/B tool-icon colors — the same navy/red pair PitchCanvas assigns to
// whichever two team labels appear first (pitchTheme.ts's PLAYER.colors), used
// here directly since a tool icon is a static preview, not tied to a specific
// frame's actual assigned colors.
export const PLAYER_A_COLOR = PLAYER.colors[0]
export const PLAYER_B_COLOR = PLAYER.colors[1]

// Small previews matching pitchTheme.ts's actual canvas rendering, one per
// placeable element/tool — "the actual thing" (a cone, a witches' hat, an
// arrow) rather than just a text label, so the tool rail reads at a glance
// the same way the pitch itself does.
export function PlayerToolIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="11" r="8" fill={color} />
    </svg>
  )
}

// Agility pole — slim shaft on a flat base (internal `kind` stays 'cone',
// see pitchTheme.ts's CONE comment).
export function ConeToolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <ellipse cx="11" cy="19.3" rx="6" ry="1.7" fill={CONE.base} />
      <rect x="9.6" y="2" width="2.8" height="16.5" rx="1.4" fill={CONE.fallback} />
    </svg>
  )
}

export function WitchesHatToolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <polygon points="8.5,2 13.5,2 19,15.5 3,15.5" fill={WITCHES_HAT.fill} />
      <rect x="1.5" y="15.5" width="19" height="3.3" rx="1.65" fill={WITCHES_HAT.fill} />
    </svg>
  )
}

// Ring head + mesh-look torso (a couple of vertical divider lines standing
// in for the mesh pattern) + four splayed legs — matches the reference
// plastic training-dummy photo.
export function MannequinToolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <circle cx="11" cy="3.3" r="2.1" fill="none" stroke={MANNEQUIN.stroke} strokeWidth="1.4" />
      <rect x="6.5" y="6" width="9" height="9.5" rx="1" fill={MANNEQUIN.fill} stroke={MANNEQUIN.stroke} strokeWidth="1.2" />
      <line x1="9.2" y1="6" x2="9.2" y2="15.5" stroke={MANNEQUIN.stroke} strokeWidth="0.7" />
      <line x1="12.8" y1="6" x2="12.8" y2="15.5" stroke={MANNEQUIN.stroke} strokeWidth="0.7" />
      <line x1="7.5" y1="15.5" x2="6.5" y2="20" stroke={MANNEQUIN.stroke} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="9.3" y1="15.5" x2="8.8" y2="20" stroke={MANNEQUIN.stroke} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="12.7" y1="15.5" x2="13.2" y2="20" stroke={MANNEQUIN.stroke} strokeWidth="1.4" strokeLinecap="round" />
      <line x1="14.5" y1="15.5" x2="15.5" y2="20" stroke={MANNEQUIN.stroke} strokeWidth="1.4" strokeLinecap="round" />
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

export function ArrowToolIcon({ kind }: { kind: 'ball' | 'player' }) {
  const style = ARROW[kind]
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <line
        x1="4"
        y1="18"
        x2="16"
        y2="6"
        stroke={style.stroke}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeDasharray={style.dash ? style.dash.join(' ') : undefined}
      />
      <polygon points="16,6 10.5,7.5 14.5,11.5" fill={style.stroke} />
    </svg>
  )
}

export function NoteToolIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <rect x="3" y="5" width="16" height="12" rx="2" fill={ANNOTATION.background} stroke={ANNOTATION.border} strokeWidth="1.25" />
      <line x1="6" y1="9" x2="16" y2="9" stroke={ANNOTATION.text} strokeWidth="1.1" />
      <line x1="6" y1="12.5" x2="13" y2="12.5" stroke={ANNOTATION.text} strokeWidth="1.1" />
    </svg>
  )
}
