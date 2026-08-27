import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LibraryGroup } from './buildLibraryGroups'
import type { LibraryView } from '../../hooks/useLibraryView'
import { Badge } from '../ui/Badge'

// Collapsible sections over an already-flattened, already-filtered id set —
// the caller's `renderCard` draws the same card component library filters
// already apply to (grouping happens on top of filtering, not instead of
// it: a filter narrows `docs` before buildLibraryGroups ever sees it — see
// libraryGroups.ts). Shared by both libraries (drill Task 5, tactic Task 6).
// `view` (2026-08-28) only changes the container's layout — grid vs. a
// stacked list — `renderCard` itself decides how each id renders in either
// mode, since a thumbnail card and a compact row share little markup.
export function LibraryGroups({
  groups,
  renderCard,
  view,
}: {
  groups: LibraryGroup[]
  renderCard: (id: string) => ReactNode
  view: LibraryView
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  if (groups.length === 0) return null

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.key] ?? false
        return (
          <section key={group.key}>
            <button
              type="button"
              onClick={() => setCollapsed((c) => ({ ...c, [group.key]: !isCollapsed }))}
              aria-expanded={!isCollapsed}
              className="flex w-full items-center gap-2 py-1 text-left"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
              />
              <h3 className="truncate text-sm font-semibold text-ink">{group.title}</h3>
              {group.kind === 'licensed' && <Badge tone="warn">Licensed</Badge>}
              <span className="text-xs text-ink-faint">{group.ids.length}</span>
            </button>
            {!isCollapsed && (
              <ul className={view === 'grid' ? 'mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'mt-2 space-y-1.5'}>
                {group.ids.map((id) => (
                  <li key={id}>{renderCard(id)}</li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
