import { useEffect, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  Moon,
  PenTool,
  Settings,
  Shield,
  Sun,
  Users,
  X,
} from 'lucide-react'
import { useStore } from '../store'
import { useSession } from '../hooks/useSession'
import { useTheme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import { TeamSwitcher } from '../components/TeamSwitcher'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
}

// Routes that operate on the currently selected team — visiting any of
// these shows the team-level tab set (Overview/Roster/.../Drills) instead
// of the coach-level one (Dashboard/Teams/Calendar). Driven purely by the
// route, not `selectedTeamId` (which persists across visits to `/`), so
// landing on the coach-level Dashboard always shows coach-level tabs even
// if a team was already selected from a previous session.
const TEAM_SCOPED_PATHS = ['/overview', '/roster', '/sessions', '/attendance', '/design', '/drills', '/tactics']

const NAV_ITEMS_COACH: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/teams', label: 'Teams', icon: Settings },
  { to: '/calendar', label: 'Calendar', icon: CalendarClock },
]

const NAV_ITEMS_TEAM: NavItem[] = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/roster', label: 'Roster', icon: Users },
  { to: '/sessions', label: 'Sessions', icon: CalendarDays },
  { to: '/attendance', label: 'Attendance', icon: ClipboardCheck },
  { to: '/design', label: 'Design', icon: PenTool },
  { to: '/drills', label: 'Drill library', icon: LibraryBig },
  { to: '/tactics', label: 'Tactics', icon: Shield },
]

const navLinkClass = (direction: 'row' | 'col') => ({ isActive }: { isActive: boolean }) =>
  (direction === 'row'
    ? 'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors '
    : 'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ') +
  (isActive ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')

// direction="row" is the desktop/tablet top-bar tab strip; direction="col"
// is the mobile drawer's vertical list — same items, same active styling,
// just laid out differently.
function NavList({
  items,
  direction = 'col',
  onNavigate,
}: {
  items: NavItem[]
  direction?: 'row' | 'col'
  onNavigate?: () => void
}) {
  return (
    <nav className={direction === 'row' ? 'flex items-center gap-1' : 'flex-1 space-y-1 px-3 py-4'}>
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={navLinkClass(direction)} onClick={onNavigate} title={label}>
          <Icon className="h-4 w-4 shrink-0" />
          {direction === 'col' ? label : <span className="hidden xl:inline">{label}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

// Always the "Gaffer" wordmark, on every route — the one persistent,
// consistent "where am I" anchor and the way back to the coach-level
// Dashboard from any team-scoped page. Previously swapped for the
// selected team's name + a back chevron on team-scoped routes; the team
// name now sits next to it instead (see the header's left-side cluster in
// AppShell), so this never changes shape between contexts.
function BrandBlock() {
  return (
    <Link to="/" className="shrink-0 text-lg font-semibold tracking-tight text-ink">
      Gaffer
    </Link>
  )
}

// Sun = "switch to light" (shown while dark is active), Moon = "switch to
// dark" (shown while light is active) — the icon always represents the
// mode a click switches TO, not the current mode.
function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme()
  const switchingTo = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${switchingTo} mode`}
      title={`Switch to ${switchingTo} mode`}
      className="rounded-md p-2 text-ink-muted hover:bg-panel-raised hover:text-ink"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  )
}

function SignOutFooter({ email }: { email?: string }) {
  return (
    <div className="border-t border-line px-5 py-4">
      {email && <p className="truncate text-xs text-ink-faint">{email}</p>}
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sign out
      </button>
    </div>
  )
}

// FM-style two-tier nav: a coach-level context (Dashboard/Teams/Calendar)
// and a team-level context (Overview/Roster/Sessions/Attendance/Design/
// Drills) for whichever team is selected, swapped based on the current
// route (see TEAM_SCOPED_PATHS above). Desktop/tablet renders both the
// brand block and the active tab set in one slim sticky top bar — no
// permanent sidebar reserving screen width. Below `lg`, the tab strip and
// team switcher collapse behind a hamburger-triggered slide-in drawer,
// since a row of up to six tabs doesn't fit a phone-width top bar.
export function AppShell() {
  const { session } = useSession()
  const fetchTeams = useStore((s) => s.fetchTeams)
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  // Top bar (and TeamSwitcher inside it) needs the team list the moment the
  // shell mounts, regardless of which route the coach lands on first.
  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  useEffect(() => {
    if (!navOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navOpen])

  const inTeamContext = TEAM_SCOPED_PATHS.some((p) => location.pathname.startsWith(p))
  const activeItems = inTeamContext ? NAV_ITEMS_TEAM : NAV_ITEMS_COACH

  return (
    <div className="min-h-svh bg-surface">
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-panel px-4">
        {/* Left cluster — "Gaffer" is always here, unchanged by route; the
            selected team's name (previously shown on the right, in the
            desktop-only TeamSwitcher) sits right next to it on
            team-scoped routes, so this is the one place a team name ever
            appears in the header. */}
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <BrandBlock />
          {inTeamContext && (
            <div className="min-w-0 max-w-28 border-l border-line pl-2 sm:max-w-40">
              <TeamSwitcher compact />
            </div>
          )}
        </div>

        {/* Desktop/tablet: full tab strip, in the bar itself */}
        <div className="hidden flex-1 items-center lg:flex">
          <NavList items={activeItems} direction="row" />
        </div>

        {/* Theme toggle is always visible (mobile + desktop); sign-out
            only in the bar on desktop (mobile gets it in the drawer
            footer) and the hamburger only collapses the nav on mobile. */}
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggleButton />
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            aria-label="Sign out"
            title={session?.user.email ? `Sign out (${session.user.email})` : 'Sign out'}
            className="hidden rounded-md p-2 text-ink-muted hover:bg-panel-raised hover:text-ink lg:inline-flex"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            className="rounded-md p-2 text-ink-muted hover:bg-panel-raised lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer — always mounted (not conditionally rendered) so the
          transform/opacity transitions below can animate open and closed. */}
      <div className={`fixed inset-0 z-50 lg:hidden ${navOpen ? '' : 'pointer-events-none'}`} aria-hidden={!navOpen}>
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
          className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${navOpen ? 'opacity-100' : 'opacity-0'}`}
        />
        <div
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-panel shadow-xl transition-transform duration-200 ${navOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
            <BrandBlock />
            <button
              type="button"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
              className="rounded-md p-2 text-ink-muted hover:bg-panel-raised"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="border-b border-line px-4 py-3">
            <TeamSwitcher />
          </div>
          <NavList items={activeItems} direction="col" onNavigate={() => setNavOpen(false)} />
          <SignOutFooter email={session?.user.email} />
        </div>
      </div>

      <main>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
