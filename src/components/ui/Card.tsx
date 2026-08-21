import type { ReactNode } from 'react'

// The one visual unit every page's content blocks are wrapped in (roster
// list, session week view, drill canvas, etc.), giving every page the same
// rhythm instead of each component picking its own ad-hoc spacing.
// newdesign.md's elevation-1 treatment: surface-1 background, a hairline
// border, 12px corners, and the `panel-edge` inset top highlight — never a
// drop shadow, which the reference explicitly avoids on dark surfaces.
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`panel-edge rounded-xl border border-line bg-panel p-6 ${className}`}>{children}</div>
}
