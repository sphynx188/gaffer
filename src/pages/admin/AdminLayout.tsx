import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useStore } from '../../store'
import { selectMyRole } from '../../store/slices/clubSlice'
import { PageHeader } from '../../components/ui/PageHeader'

// The admin console shell (spec §6.2) — role-gated: any non-admin hitting
// /settings/* bounces to Home, same redirect shape every other dead-end
// route in the app uses. Sub-nav grows by one entry per task (Coaches here;
// Collections/Transfer/Licenses add their own tab in Tasks 9/10/11) rather
// than all four appearing before their routes exist, so every commit stays
// shippable — same reasoning Task 7 applied to the main nav's entry.
// Routes relabeled /admin → /settings in the nav (2026-08-28); this
// component and file stay "Admin*", internal naming only.
const SUB_NAV = [
  { to: '/settings/coaches', label: 'Coaches' },
  { to: '/settings/collections', label: 'Collections' },
  { to: '/settings/transfer', label: 'Transfer' },
  { to: '/settings/licenses', label: 'Licenses' },
]

const tabClass = ({ isActive }: { isActive: boolean }) =>
  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors ' +
  (isActive ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')

export function AdminLayout() {
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div>
      <PageHeader title="Settings" />
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
