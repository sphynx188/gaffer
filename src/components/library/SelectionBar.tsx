import type { ComponentType, ReactNode } from 'react'
import { X } from 'lucide-react'

// The contextual bar that appears while items are selected (2026-08-28),
// replacing the inline AddToCollectionBar. Two things changed and both
// matter: it floats over the list instead of being spliced into it (the old
// bar pushed every row down the moment you ticked something, so the row you
// were aiming at moved), and it carries every bulk action rather than only
// "add to collection" — removing from the current collection and deleting
// are the other two things a coach actually wants to do to five drills at
// once.
//
// Sits at bottom-6 on every breakpoint; ToastProvider's messages are pinned
// higher (bottom-24 on mobile), so a "Added 3 drills to …" confirmation
// lands above the bar that triggered it rather than under it.
export function SelectionBar({
  count,
  noun,
  onClear,
  children,
}: {
  count: number
  /** Singular — "drill" / "tactic"; pluralized here. */
  noun: string
  onClear: () => void
  children: ReactNode
}) {
  if (count === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-full border border-line bg-panel px-2 py-1.5 shadow-xl">
        <span className="pl-2 pr-1 text-sm font-medium text-ink">
          {count} {noun}
          {count === 1 ? '' : 's'} selected
        </span>
        <span className="h-5 w-px bg-line" />
        {children}
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear selection"
          title="Clear selection"
          className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// The bar's own button shape — small, pill, icon+label, and label-hiding on
// the narrowest screens so four actions still fit on a phone.
export function SelectionAction({
  icon: Icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={
        'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ' +
        (danger ? 'text-bad hover:bg-bad/10' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
      }
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
