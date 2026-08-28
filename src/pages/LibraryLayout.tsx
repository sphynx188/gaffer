import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutGrid, List } from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { ToastProvider } from '../components/ui/Toast'
import { useStore } from '../store'
import { selectMyRole } from '../store/slices/clubSlice'
import { useLibraryView, type LibraryView } from '../hooks/useLibraryView'

// The library shell (2026-08-28) — merges the former separate "Drill
// library" and "Tactics" nav entries into one, split by a tab bar, same
// shape as AdminLayout's own sub-nav. Each tab keeps its existing
// filter/grouping logic untouched (DrillLibraryPage/TacticsPage); this is a
// nav consolidation, not a rewrite of either listing. Collections joined
// the tab bar the same day, moved over from /settings — it's still
// admin-only (CollectionsPage carries its own guard), so the tab itself
// only appears for an admin, same belt-and-braces UI polish AppShell's own
// Settings nav item already does.
const SUB_NAV = [
  { to: '/library/drills', label: 'Drills' },
  { to: '/library/tactics', label: 'Tactics' },
]

const ADMIN_SUB_NAV_ITEM = { to: '/library/collections', label: 'Collections' }

const tabClass = ({ isActive }: { isActive: boolean }) =>
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
  (isActive ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')

// Grid/list toggle lives here rather than duplicated on each tab (2026-08-28)
// — it's one Library-wide preference, not a per-type filter, and the state
// needs to survive switching tabs. Handed to whichever tab is routed via
// `useOutletContext`, since DrillLibrary/TacticsPage render several levels
// below this Outlet, not as its direct child. Collections has no cards to
// switch layouts on, so the toggle hides on that tab (see `showViewToggle`
// below) rather than rendering something inert.
export interface LibraryOutletContext {
  view: LibraryView
}

export function LibraryLayout() {
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  const { view, setView } = useLibraryView()
  const location = useLocation()
  const showViewToggle = !location.pathname.startsWith('/library/collections')
  const navItems = isAdmin ? [...SUB_NAV, ADMIN_SUB_NAV_ITEM] : SUB_NAV

  return (
    <div>
      <PageHeader title="Library" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <nav className="flex flex-wrap gap-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={tabClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        {showViewToggle && (
          <div className="flex items-center gap-0.5 rounded-md border border-line p-0.5">
            <button
              type="button"
              onClick={() => setView('grid')}
              aria-pressed={view === 'grid'}
              aria-label="Thumbnail view"
              title="Thumbnail view"
              className={`rounded p-1.5 transition-colors ${view === 'grid' ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:text-ink'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              aria-pressed={view === 'list'}
              aria-label="List view"
              title="List view"
              className={`rounded p-1.5 transition-colors ${view === 'list' ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:text-ink'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      <ToastProvider>
        <Outlet context={{ view } satisfies LibraryOutletContext} />
      </ToastProvider>
    </div>
  )
}
