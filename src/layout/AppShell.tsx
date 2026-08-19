import { useEffect, useState, type ComponentType } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  PenTool,
  Settings,
  Users,
  X,
} from 'lucide-react'
import { useStore } from '../store'
import { useSession } from '../hooks/useSession'
import { supabase } from '../lib/supabase'
import { TeamSwitcher } from '../components/TeamSwitcher'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/roster', label: 'Roster', icon: Users },
  { to: '/sessions', label: 'Sessions', icon: CalendarDays },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/design', label: 'Design', icon: PenTool },
  { to: '/drills', label: 'Drill library', icon: LibraryBig },
  { to: '/teams', label: 'Teams', icon: Settings },
]

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
  (isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={navLinkClass} onClick={onNavigate}>
          <Icon className="h-4 w-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function SignOutFooter({ email }: { email?: string }) {
  return (
    <div className="border-t border-slate-200 px-5 py-4">
      {email && <p className="truncate text-xs text-slate-400">{email}</p>}
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </div>
  )
}

// Phase "Redesign" — replaces the old single-scroll App.tsx layout (every
// screen stacked vertically in one max-w-lg column) with real navigation:
// a persistent sidebar on desktop (chosen as the primary target — session/
// roster planning is a sit-down task) that collapses to a top bar + slide-in
// drawer below the `lg` breakpoint for the pitch-side phone case. Every
// routed page (src/pages/*) renders inside the padded <Outlet /> column
// below, so page components never need to manage their own max-width/centering.
export function AppShell() {
  const { session } = useSession()
  const fetchTeams = useStore((s) => s.fetchTeams)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Sidebar (and TeamSwitcher inside it) needs the team list the moment the
  // shell mounts, regardless of which route the coach lands on first — this
  // used to be guaranteed by TeamManagement always being mounted in the old
  // single-column App.tsx; now that it's its own route, the shell itself
  // owns this one fetch.
  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  return (
    <div className="min-h-svh bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-slate-200 px-5">
          <span className="text-lg font-bold tracking-tight text-slate-900">Gaffer</span>
        </div>
        <div className="border-b border-slate-200 px-5 py-4">
          <TeamSwitcher />
        </div>
        <NavList />
        <SignOutFooter email={session?.user.email} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <span className="text-lg font-bold tracking-tight text-slate-900">Gaffer</span>
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/30"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-4">
              <span className="text-lg font-bold tracking-tight text-slate-900">Gaffer</span>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="border-b border-slate-200 px-4 py-3">
              <TeamSwitcher />
            </div>
            <NavList onNavigate={() => setMobileNavOpen(false)} />
            <SignOutFooter email={session?.user.email} />
          </div>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
