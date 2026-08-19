import type { ReactNode } from 'react'

// Plain white card container — the one visual unit every page's content
// blocks are wrapped in post-redesign (roster list, session week view, drill
// canvas, etc.), giving every page the same rhythm instead of each component
// picking its own ad-hoc spacing when this was a single scrolling column.
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>{children}</div>
  )
}
