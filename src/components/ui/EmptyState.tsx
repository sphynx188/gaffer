import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Shared empty-state block — icon + message + optional next-step link,
// replacing the plain gray-text-only placeholders scattered across pages
// (DrillLibrary, DrillPreview, DashboardPage) with one consistent, slightly
// more deliberate visual treatment instead of each page hand-rolling its own.
export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: ComponentType<{ className?: string }>
  message: ReactNode
  action?: { to: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line py-8 text-center">
      <Icon className="h-6 w-6 text-ink-faint" />
      <p className="text-sm text-ink-muted">{message}</p>
      {action && (
        <Link to={action.to} className="text-sm font-medium text-accent hover:text-accent-hover">
          {action.label}
        </Link>
      )}
    </div>
  )
}
