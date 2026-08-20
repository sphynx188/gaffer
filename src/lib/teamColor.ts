// Deterministic team_id -> accent color, for telling teams apart on the
// cross-team Calendar. Fixed, statically-enumerated palette — Tailwind v4's
// content scanner only picks up class names that appear literally in
// source, so this can't be built by interpolating a hex value into a class
// string at runtime (same constraint SessionPlanner's LOAD_BORDER_CLASS
// already works around for physical-load colors).
const BORDER_CLASSES = [
  'border-l-accent',
  'border-l-ok',
  'border-l-warn',
  'border-l-bad',
  'border-l-[#a855f7]', // violet
  'border-l-[#14b8a6]', // teal
  'border-l-[#f97316]', // orange
  'border-l-[#ec4899]', // pink
] as const

const DOT_CLASSES = [
  'bg-accent',
  'bg-ok',
  'bg-warn',
  'bg-bad',
  'bg-[#a855f7]',
  'bg-[#14b8a6]',
  'bg-[#f97316]',
  'bg-[#ec4899]',
] as const

function hashTeamId(teamId: string): number {
  let hash = 0
  for (let i = 0; i < teamId.length; i++) {
    hash = (hash * 31 + teamId.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function teamAccentBorderClass(teamId: string): string {
  return BORDER_CLASSES[hashTeamId(teamId) % BORDER_CLASSES.length]
}

export function teamAccentDotClass(teamId: string): string {
  return DOT_CLASSES[hashTeamId(teamId) % DOT_CLASSES.length]
}
