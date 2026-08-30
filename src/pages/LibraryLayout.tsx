import { NavLink, Outlet } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { ToastProvider } from '../components/ui/Toast'
import { useLibraryView, type LibraryView } from '../hooks/useLibraryView'

// The library shell (2026-08-28) — merges the former separate "Drill
// library" and "Tactics" nav entries into one, split by a tab bar. Each tab
// is its own file manager over its own kind of document (see
// components/library/), sharing the places rail, the sortable list, the
// selection bar and the details rail; only the columns and the details
// content differ.
//
// Collections briefly lived here as a third tab (also 2026-08-28), then
// folded back INTO Drills/Tactics the same day — and are now the folders in
// each tab's own sidebar rather than anything with a tab or a panel of its
// own. So still two tabs.
const SUB_NAV = [
  { to: '/library/drills', label: 'Drills' },
  { to: '/library/tactics', label: 'Tactics' },
]

const tabClass = ({ isActive }: { isActive: boolean }) =>
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
  (isActive ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')

// Grid/list is one Library-wide preference rather than a per-tab filter, so
// the state lives here and survives switching tabs. The control itself moved
// down into each tab's toolbar (2026-08-28) where it sits beside search and
// sort — the three things that decide how the list reads belong together,
// and a lone toggle stranded up here beside the tabs read as if it applied
// to the tabs. Handed down via `useOutletContext` since the tabs render
// several levels below this Outlet.
export interface LibraryOutletContext {
  view: LibraryView
  setView: (view: LibraryView) => void
}

export function LibraryLayout() {
  const { view, setView } = useLibraryView()

  return (
    <div>
      <PageHeader title="Library" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <nav className="flex flex-wrap gap-1">
          {SUB_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={tabClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <ToastProvider>
        <Outlet context={{ view, setView } satisfies LibraryOutletContext} />
      </ToastProvider>
    </div>
  )
}
