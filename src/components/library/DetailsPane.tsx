import type { ReactNode } from 'react'
import { X } from 'lucide-react'

// The details rail (2026-08-28) — what the old DrillPreviewPanel becomes.
// The panel used to render *below* the whole list, so selecting a drill
// halfway down meant scrolling past everything to reach its preview and then
// scrolling back to pick another. Here it sits beside the list at xl and
// slides over it below that, which is what makes clicking through several
// drills in a row a usable way to find one.
export function DetailsPane({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string | null
  onClose: () => void
  children: ReactNode
}) {
  return (
    <div className="panel-edge rounded-xl border border-line bg-panel">
      <div className="flex items-start justify-between gap-2 border-b border-line px-3 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{title}</p>
          {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          title="Close details"
          className="-mr-1 shrink-0 rounded-md p-1.5 text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 p-3">{children}</div>
    </div>
  )
}

// A label/value line. Values that aren't recorded are dropped by the caller
// rather than rendered as "—": in a narrow rail, eight empty rows bury the
// two that say something.
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="shrink-0 text-ink-faint">{label}</span>
      <span className="min-w-0 truncate text-right text-ink">{children}</span>
    </div>
  )
}

export function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      {children}
    </div>
  )
}
