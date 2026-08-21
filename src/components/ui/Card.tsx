import type { ReactNode } from 'react'

// The one visual unit every page's content blocks are wrapped in (roster
// list, session week view, drill canvas, etc.), giving every page the same
// rhythm instead of each component picking its own ad-hoc spacing. The
// touchline motif (index.css) deliberately stays off Card — it already
// marks the shell header and every PageHeader, and repeating it on every
// panel below that would turn a signature into wallpaper. Plain bordered
// panel, no shadow — the identity carries in type/color, not another rule.
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-panel p-6 ${className}`}>{children}</div>
}
