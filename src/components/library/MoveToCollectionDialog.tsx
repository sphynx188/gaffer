import { useState } from 'react'
import { Check, Folder } from 'lucide-react'
import type { DrillCollectionOption } from '../../store'
import { Modal } from '../ui/Modal'

// A drill lives in exactly one collection (migration 046), so filing is a
// move, never an add. Lists every drill collection in the club — a coach may
// move their own drill into one they can't open — except Uncategorised.
export function MoveToCollectionDialog({
  open,
  onClose,
  options,
  currentId,
  count,
  onMove,
}: {
  open: boolean
  onClose: () => void
  options: DrillCollectionOption[]
  currentId: string | null
  count: number
  onMove: (collectionId: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const choices = options.filter((o) => !o.is_uncategorised)
  const canSubmit = !submitting && selectedId !== null && selectedId !== currentId

  const handleSubmit = async () => {
    if (!canSubmit || !selectedId) return
    setSubmitting(true)
    await onMove(selectedId)
    setSubmitting(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move to collection"
      description={`${count} drill${count === 1 ? '' : 's'} selected`}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-2 py-1.5 text-sm text-ink-muted hover:text-ink">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Moving…' : 'Move'}
          </button>
        </>
      }
    >
      <ul className="max-h-80 space-y-0.5 overflow-y-auto">
        {choices.map((option) => {
          const selected = selectedId === option.id
          const current = currentId === option.id
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setSelectedId(option.id)}
                aria-pressed={selected}
                className={
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ' +
                  (selected ? 'bg-accent/15 text-accent-ink' : 'text-ink hover:bg-panel-raised')
                }
              >
                <Folder className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                {current && <span className="shrink-0 text-xs text-ink-faint">Current</span>}
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            </li>
          )
        })}
        {choices.length === 0 && <li className="px-2 py-3 text-sm text-ink-faint">No collections yet.</li>}
      </ul>
    </Modal>
  )
}
