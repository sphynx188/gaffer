import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

// Centered dialog, or a bottom sheet below `sm` (2026-08-28) — the Library's
// file-manager actions (add to collection, rename, delete, share access) all
// need a "commit or cancel" surface, and inlining each of them into the page
// the way the old AddToCollectionBar did meant the list jumped every time
// one appeared. Dismissal matches Dropdown's convention: backdrop click or
// Escape, listened for on the window rather than a blur handler.
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  widthClassName = 'sm:max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  widthClassName?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`panel-edge relative flex max-h-[85svh] w-full flex-col rounded-t-xl border border-line bg-panel shadow-xl sm:rounded-xl ${widthClassName}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}
