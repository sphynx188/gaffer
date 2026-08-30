import { useState } from 'react'
import { useStore } from '../../store'
import { Modal } from '../ui/Modal'

// The three folder operations a file manager owns, as dialogs raised from
// the sidebar's per-collection "…" menu (2026-08-28). They're what's left of
// CollectionManagerPanel: create/rename/delete/grant used to live in a
// separate panel that a coach toggled open above the list, listed every
// collection again, and made you select one there before you could act on
// it — a second, parallel copy of the navigation the sidebar now is.
// Removing a doc from a collection, its fifth job, is a bulk action on the
// selection instead.

export function TextPromptDialog({
  open,
  onClose,
  title,
  label,
  initialValue = '',
  submitLabel,
  placeholder,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  title: string
  label: string
  initialValue?: string
  submitLabel: string
  placeholder?: string
  onSubmit: (value: string) => Promise<void>
}) {
  const [value, setValue] = useState(initialValue)
  const [submitting, setSubmitting] = useState(false)

  // `initialValue` is read once, at mount: every caller mounts this only
  // while the dialog is open, so there's no reopen to re-seed for.
  const handleSubmit = async () => {
    const trimmed = value.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    await onSubmit(trimmed)
    setSubmitting(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-2 py-1.5 text-sm text-ink-muted hover:text-ink">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!value.trim() || submitting}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Saving…' : submitLabel}
          </button>
        </>
      }
    >
      <label className="block text-xs font-medium text-ink-muted" htmlFor="text-prompt-input">
        {label}
      </label>
      <input
        id="text-prompt-input"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void handleSubmit()
        }}
        placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-md border border-line bg-panel-raised px-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/30"
      />
    </Modal>
  )
}

export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)

  const handleConfirm = async () => {
    if (busy) return
    setBusy(true)
    await onConfirm()
    setBusy(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className="px-2 py-1.5 text-sm text-ink-muted hover:text-ink">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="rounded-md bg-bad px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">{message}</p>
    </Modal>
  )
}

// Per-coach grants on one collection. Reads the store directly rather than
// taking members/access as props — same call shape CollectionManagerPanel
// used, and the dialog is only ever mounted by an admin view.
export function CollectionAccessDialog({
  open,
  onClose,
  collectionId,
  collectionName,
}: {
  open: boolean
  onClose: () => void
  collectionId: string
  collectionName: string
}) {
  const clubMembers = useStore((s) => s.clubMembers)
  const collectionAccess = useStore((s) => s.collectionAccess)
  const grantCollectionAccess = useStore((s) => s.grantCollectionAccess)
  const revokeCollectionAccess = useStore((s) => s.revokeCollectionAccess)

  // Admins already see every collection in the club through RLS, so a grant
  // to one would be a no-op row — only coaches are listed, same as before.
  const coaches = clubMembers.filter((m) => m.role !== 'admin')
  const granted = collectionAccess[collectionId] ?? []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Coach access"
      description={collectionName}
      footer={
        <button type="button" onClick={onClose} className="px-2 py-1.5 text-sm text-ink-muted hover:text-ink">
          Done
        </button>
      }
    >
      {coaches.length === 0 ? (
        <p className="text-sm text-ink-muted">No coaches yet — invite one from Settings.</p>
      ) : (
        <ul className="space-y-1.5">
          {coaches.map((member) => {
            const isGranted = granted.includes(member.user_id)
            return (
              <li
                key={member.user_id}
                className="flex items-center justify-between gap-2 rounded-md border border-line px-2.5 py-1.5"
              >
                <span className="truncate text-sm text-ink">{member.display_name ?? 'Unnamed coach'}</span>
                <button
                  type="button"
                  onClick={() =>
                    isGranted
                      ? revokeCollectionAccess(collectionId, member.user_id)
                      : grantCollectionAccess(collectionId, member.user_id)
                  }
                  aria-pressed={isGranted}
                  className={
                    'shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ' +
                    (isGranted
                      ? 'border-accent bg-accent/15 text-accent-ink'
                      : 'border-line text-ink-muted hover:border-line-strong hover:text-ink')
                  }
                >
                  {isGranted ? 'Granted' : 'Grant'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
