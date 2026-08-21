import type { ReactNode } from 'react'

// Shared page-level header used across every routed page (layout/AppShell.tsx
// mounts each page inside the same padded content column, so this is the one
// place title/description/actions typography is defined — keeps every page
// visually consistent without each page hand-rolling its own <h1>).
// newdesign.md's headline scale (28px/600/-0.6px tracking) approximated via
// Tailwind's text-2xl + tracking-tight — hierarchy comes from weight/size
// within one type family, not a switch to a separate display face.
// Generous whitespace does the separating work instead of a rule
// (newdesign.md: "the dark canvas IS the whitespace").
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
    <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
