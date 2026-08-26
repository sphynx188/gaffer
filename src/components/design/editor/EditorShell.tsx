import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import type { SaveState } from '../../../store'

// The parts of the editor shell both editors genuinely agree on
// (TACTICS_BOARD_REWORK_PLAN.md Stage 7.1).
//
// The plan's own warning shapes what is here and what isn't: "extract the
// shell only where both editors genuinely agree — a shared shell forced over
// two different toolbars is worse than two toolbars." The two TOP BARS do not
// agree. A drill's carries export, 3D and the tour; a tactic's carries
// Single/Dual, orientation, Add Ball and the panel toggles. So each editor
// composes its own from the small pieces below, and no `EditorTopBar` is
// forced over both.
//
// What they do agree on is the LAYOUT: rail, pitch, inspector in three
// columns; the timeline docked beneath; both side panels becoming sheets and a
// floating dock below `lg`. That is `EditorLayout`, and it is worth extracting
// because it was eighty lines of structure that would otherwise be copied.

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Saved',
  dirty: 'Unsaved changes',
  saving: 'Saving…',
  error: "Couldn't save",
}

const SAVE_TONE: Record<SaveState, string> = {
  saved: 'text-ink-faint',
  dirty: 'text-ink-muted',
  saving: 'text-ink-muted',
  error: 'text-bad',
}

/** The shared icon-button shape every top-bar control uses. */
export const EDITOR_ICON_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted lg:h-9 lg:w-9'

/** A top-bar toggle that reads as pressed — Single/Dual, orientation, panels. */
export const EDITOR_TOGGLE_ON =
  'flex h-11 items-center gap-1.5 rounded-md border border-accent bg-accent px-2 text-xs font-medium text-white transition-colors lg:h-9'
export const EDITOR_TOGGLE_OFF =
  'flex h-11 items-center gap-1.5 rounded-md border border-line px-2 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink lg:h-9'

export function SaveIndicator({ state }: { state: SaveState }) {
  return <span className={'hidden shrink-0 text-xs sm:inline ' + SAVE_TONE[state]}>{SAVE_LABEL[state]}</span>
}

/**
 * The inline, uncontrolled name field.
 *
 * Uncontrolled and keyed on the document: the field is a draft until it is
 * committed, and keying it means switching documents re-mounts it with the new
 * name rather than needing an effect to push the name back into state.
 */
export function EditorNameField({
  documentId,
  name,
  label,
  onCommit,
  anchor,
}: {
  documentId: string
  name: string
  label: string
  onCommit: (name: string) => void
  anchor?: string
}) {
  const commit = (field: HTMLInputElement) => {
    const trimmed = field.value.trim()
    if (!trimmed || trimmed === name) {
      field.value = name
      return
    }
    onCommit(trimmed)
  }

  return (
    <input
      key={documentId}
      data-onboarding-anchor={anchor}
      aria-label={label}
      defaultValue={name}
      onBlur={(e) => commit(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.currentTarget.value = name
          e.currentTarget.blur()
        }
      }}
      className="min-h-11 w-32 min-w-32 shrink-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-base font-semibold tracking-tight text-ink outline-none transition-colors hover:border-line focus:border-accent focus:ring-2 focus:ring-accent/30 lg:min-h-9"
    />
  )
}

interface EditorLayoutProps {
  topBar: ReactNode
  rail: ReactNode
  canvas: ReactNode
  inspector: ReactNode
  timeline: ReactNode
  /** The floating mobile control surface. */
  dock?: ReactNode
  /** Drawers, tours, drag ghosts — anything that positions itself. */
  extras?: ReactNode

  railOpen: boolean
  onRailClose: () => void
  railTitle: string
  inspectorOpen: boolean
  onInspectorClose: () => void
  inspectorTitle: string
  inspectorAnchor?: string

  /** Caps the side panels to the same reserve the canvas uses. */
  maxPanelHeight: number

  /**
   * Board-only mode (Stage 7.5): everything but the pitch goes away. Cheap
   * here, because the layout already knows which pieces are chrome.
   */
  boardOnly?: boolean
}

export function EditorLayout({
  topBar,
  rail,
  canvas,
  inspector,
  timeline,
  dock,
  extras,
  railOpen,
  onRailClose,
  railTitle,
  inspectorOpen,
  onInspectorClose,
  inspectorTitle,
  inspectorAnchor,
  maxPanelHeight,
  boardOnly = false,
}: EditorLayoutProps) {
  return (
    <div className="flex min-h-0 flex-col gap-3">
      {!boardOnly && topBar}

      <div className="flex min-w-0 gap-3">
        {/* Rail — desktop only; below lg it lives in the drawer. */}
        {!boardOnly && <div className="hidden shrink-0 lg:block">{!railOpen && rail}</div>}

        <div className="flex min-w-0 flex-1 flex-col items-center gap-2">{canvas}</div>

        {/* Inspector — desktop only; below lg it's the right-hand sheet.
            Capped and scrolled on the same reserve the canvas uses: without
            it, selecting an entity grew this panel past 800px — taller than
            the pitch — and pushed the docked timeline off the bottom. */}
        {!boardOnly && (
          <div
            data-onboarding-anchor={inspectorAnchor}
            className="hidden w-64 shrink-0 overflow-y-auto rounded-xl border border-line bg-panel p-3 lg:block"
            style={{ maxHeight: maxPanelHeight }}
          >
            {inspector}
          </div>
        )}
      </div>

      {!boardOnly && timeline}

      {/* Space reserved below the timeline so the dock never covers it. */}
      {!boardOnly && dock && (
        <>
          <div className="h-20 lg:hidden" aria-hidden />
          <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-4 lg:hidden">
            <div className="flex items-center gap-1 rounded-full border border-line bg-panel p-1.5">{dock}</div>
          </div>
        </>
      )}

      <Sheet open={railOpen && !boardOnly} side="left" title={railTitle} onClose={onRailClose}>
        {rail}
      </Sheet>
      <Sheet open={inspectorOpen && !boardOnly} side="right" title={inspectorTitle} onClose={onInspectorClose}>
        <div data-onboarding-anchor={inspectorAnchor}>{inspector}</div>
      </Sheet>

      {extras}
    </div>
  )
}

export function DockButton({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 min-w-16 flex-col items-center justify-center gap-0.5 rounded-full px-3 text-[10px] font-medium text-ink-muted"
    >
      {icon}
      {label}
    </button>
  )
}

// The same always-mounted, transform-animated pattern AppShell's mobile drawer
// uses, so every sheet in the app opens and closes the same way.
export function Sheet({
  open,
  side,
  title,
  onClose,
  children,
}: {
  open: boolean
  side: 'left' | 'right'
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className={`fixed inset-0 z-40 lg:hidden ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button
        type="button"
        aria-label={`Close ${title.toLowerCase()}`}
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        // Written out in full rather than composed from `side` — Tailwind
        // scans for complete class names, so `left-0` built from a template
        // string never reaches the stylesheet.
        className={
          'absolute inset-y-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-panel transition-transform duration-200 ' +
          (side === 'left' ? 'left-0 ' : 'right-0 ') +
          (open ? 'translate-x-0' : side === 'left' ? '-translate-x-full' : 'translate-x-full')
        }
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <p className="text-sm font-semibold text-ink">{title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title.toLowerCase()}`}
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-panel-raised"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

/**
 * The export & share drawer — the same always-mounted right-hand shape
 * `DrillDetailsDrawer` and `Sheet` use, so there is one drawer idiom in the
 * editor rather than three.
 *
 * Lived inside `DrillEditor.tsx` until the tactics editor needed the identical
 * drawer for the identical panel (TACTICS_BOARD_REWORK_PLAN.md Stage 8.1).
 * Unlike the top bars, which the plan is explicit about NOT forcing a shell
 * over, the two drawers really are the same thing — so this is moved here
 * rather than copied.
 */
export function ExportDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button
        type="button"
        aria-label="Close export"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        role="dialog"
        aria-label="Export and share"
        className={
          'absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-panel transition-transform duration-200 ' +
          (open ? 'translate-x-0' : 'translate-x-full')
        }
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <p className="text-sm font-semibold text-ink">Export &amp; share</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export"
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-panel-raised"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  )
}
