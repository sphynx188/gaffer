import { NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'

// The library shell (2026-08-28) — merges the former separate "Drill
// library" and "Tactics" nav entries into one, split by a tab bar, same
// shape as AdminLayout's own sub-nav. Each tab keeps its existing
// filter/grouping logic untouched (DrillLibraryPage/TacticsPage); this is a
// nav consolidation, not a rewrite of either listing.
const SUB_NAV = [
  { to: '/library/drills', label: 'Drills' },
  { to: '/library/tactics', label: 'Tactics' },
]

const tabClass = ({ isActive }: { isActive: boolean }) =>
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
  (isActive ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')

export function LibraryLayout() {
  return (
    <div>
      <PageHeader title="Library" />
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-line pb-3">
        {SUB_NAV.map((item) => (
          <NavLink key={item.to} to={item.to} className={tabClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
