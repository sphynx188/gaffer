import type { ReactNode } from 'react'

// Shared page-level header used across every routed page (layout/AppShell.tsx
// mounts each page inside the same padded content column, so this is the one
// place title/description/actions typography is defined — keeps every page
// visually consistent without each page hand-rolling its own <h1>).
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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
