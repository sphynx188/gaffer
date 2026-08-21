import type { ReactNode } from 'react'

// Shared page-level header used across every routed page (layout/AppShell.tsx
// mounts each page inside the same padded content column, so this is the one
// place title/description/actions typography is defined — keeps every page
// visually consistent without each page hand-rolling its own <h1>). Title
// carries the display face (index.css's --font-display, Oswald) in the
// touchline redesign — every page opens with the same stadium-signage beat
// — with the motif's broken chalk-line rule underneath in place of a plain
// margin gap.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-wide text-ink uppercase">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="touchline" />
    </div>
  )
}
