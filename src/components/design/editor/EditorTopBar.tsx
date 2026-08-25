import { Box, ChevronLeft, Download, Redo2, Undo2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../../../store'
import type { Drill, SaveState } from '../../../store'

// Back, the drill's name, undo/redo, and what the autosave is doing
// (rework plan Stage 5.2). Export opens the export & share drawer as of Stage
// 10; the 2D/3D toggle stays disabled, since the plan asks for it to be
// present-but-disabled until Stage 11 decides whether 3D happens at all.

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

const ICON_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted lg:h-9 lg:w-9'

export function EditorTopBar({ drill, onExport }: { drill: Drill; onExport: () => void }) {
  const updateDrill = useStore((s) => s.updateDrill)
  const saveState = useStore((s) => s.saveState)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const canUndo = useStore((s) => s.canUndo(drill.id))
  const canRedo = useStore((s) => s.canRedo(drill.id))

  // Uncontrolled and keyed on the drill: the field is a draft until it's
  // committed, and keying it means switching drills re-mounts it with the new
  // name rather than needing an effect to push the name back into state.
  const commitName = (field: HTMLInputElement) => {
    const trimmed = field.value.trim()
    if (!trimmed || trimmed === drill.name) {
      field.value = drill.name
      return
    }
    void updateDrill(drill.id, { name: trimmed })
  }

  return (
    <div className="flex items-center gap-1 border-b border-line pb-3">
      <Link to="/design" aria-label="Back to drills" title="Back to drills" className={ICON_BUTTON}>
        <ChevronLeft className="h-5 w-5" />
      </Link>

      <input
        key={drill.id}
        aria-label="Drill name"
        defaultValue={drill.name}
        onBlur={(e) => commitName(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') {
            e.currentTarget.value = drill.name
            e.currentTarget.blur()
          }
        }}
        className="min-h-11 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-base font-semibold tracking-tight text-ink outline-none transition-colors hover:border-line focus:border-accent focus:ring-2 focus:ring-accent/30 lg:min-h-9"
      />

      <span className={'hidden shrink-0 text-xs sm:inline ' + SAVE_TONE[saveState]}>{SAVE_LABEL[saveState]}</span>

      <button
        type="button"
        onClick={() => undo(drill.id)}
        disabled={!canUndo}
        className={ICON_BUTTON}
        aria-label="Undo"
        title="Undo"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => redo(drill.id)}
        disabled={!canRedo}
        className={ICON_BUTTON}
        aria-label="Redo"
        title="Redo"
      >
        <Redo2 className="h-4 w-4" />
      </button>
      <button type="button" onClick={onExport} className={ICON_BUTTON} aria-label="Export" title="Export & share">
        <Download className="h-4 w-4" />
      </button>
      <button type="button" disabled className={ICON_BUTTON} aria-label="3D view" title="3D view — not built yet">
        <Box className="h-4 w-4" />
      </button>
    </div>
  )
}
