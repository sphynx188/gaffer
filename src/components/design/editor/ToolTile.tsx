import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'

// One placeable thing in the editors' tool palettes — a player swatch, a piece
// of equipment, a marking tool — as a small tile: icon on top, label under it
// (2026-10-28). The palettes used to be one full-width row per item, which
// spent most of the right panel's width on empty space beside short labels and
// made it a long scroll; three tiles to a row let the panel narrow (EditorShell)
// so the pitch gets the width instead.
//
// The label is clamped to two lines rather than truncated, so "Passing gate"
// or "Curved arrow" wraps instead of losing its second word. A keyboard
// shortcut, where there is one, sits in the corner and in the tooltip.
export const TOOL_GRID = 'grid grid-cols-3 gap-1'

export function ToolTile({
  icon,
  label,
  pressed,
  onClick,
  onPointerDown,
  shortcut,
  anchor,
}: {
  icon: ReactNode
  label: string
  pressed: boolean
  onClick: () => void
  onPointerDown?: (event: ReactPointerEvent) => void
  shortcut?: string
  anchor?: string
}) {
  return (
    <button
      type="button"
      data-onboarding-anchor={anchor}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-pressed={pressed}
      title={shortcut ? `${label} (${shortcut.toUpperCase()})` : label}
      className={
        'relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 text-center transition-colors ' +
        (pressed ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
      }
    >
      {icon}
      <span className="line-clamp-2 text-[11px] leading-tight">{label}</span>
      {shortcut && (
        <span aria-hidden className="absolute right-1 top-0.5 font-mono text-[9px] uppercase text-ink-faint">
          {shortcut}
        </span>
      )}
    </button>
  )
}
