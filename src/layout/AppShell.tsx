import { useEffect, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
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
import { Dropdown } from '../components/ui/Dropdown'

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

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
  (isActive ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')

// One icon+label list, shared by the mobile drawer and the desktop rail —
// both are panels showing the same items, just at different widths. The
// drawer is always full-width, so its label always renders plainly.
//
// The rail is narrower at rest and only grows to full width on hover/focus
// (see the `<aside>` below), so `fadeLabel` wraps its label in a span that's
// `opacity-0` until an ancestor `.group` is hovered/focus-within. This is
// necessary, not decorative: the label's text still overflows past the
// rail's resting 64px width regardless of opacity (overflow-hidden on the
// rail clips it either way) — without fading it too, the sliver that falls
// *inside* the visible 64px shows as a stray fragment of the first letter
// rather than a clean icon-only rail.
function NavList({
  items,
  onNavigate,
  fadeLabel = false,
}: {
  items: NavItem[]
  onNavigate?: () => void
  fadeLabel?: boolean
}) {
  return (
    <nav className="flex-1 space-y-1 px-3 py-4">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={navLinkClass} onClick={onNavigate} title={label}>
          <Icon className="h-4 w-4 shrink-0" />
          {fadeLabel ? (
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
              {label}
            </span>
          ) : (
            label
          )}
        </NavLink>
      ))}
    </nav>
  )
}

// Always the "Gaffer" wordmark, on every route — the one persistent,
// consistent "where am I" anchor and the way back to the coach-level
// Dashboard from any team-scoped page. Previously swapped for the
// selected team's name + a back chevron on team-scoped routes; the team
// name lives in the header's right-side cluster instead now (see
// AppShell), so this never changes shape between contexts.
function BrandBlock() {
  return (
    <Link to="/" className="shrink-0 text-lg font-semibold tracking-tight text-ink">
      Gaffer
    </Link>
  )
}

// Mobile-only browser-history back arrow — the hamburger drawer's nav
// links are the only way to move between screens on mobile (no persistent
// tab strip like desktop has), so getting back to whatever screen a coach
// was just on otherwise means reopening the drawer and finding it again.
// Plain `navigate(-1)`: every nav-link tap and every programmatic
// `navigate()` call elsewhere in the app (team pick, session-click
// deep-links, etc.) already pushes a real history entry, so this always
// lands on the actual previous screen rather than a fixed "up one level"
// destination. Hidden on the coach Dashboard ("/") — that's the app's
// true landing screen, with nothing behind it to go back to.
function BackButton() {
  const navigate = useNavigate()
  const location = useLocation()
  if (location.pathname === '/') return null
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      aria-label="Back"
      title="Back"
      className="-ml-1.5 rounded-md p-2 text-ink-muted hover:bg-panel-raised hover:text-ink lg:hidden"
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
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

// Club switcher — mount point only for now (Task 4); TeamSwitcher stays in
// place alongside it until Task 7's full nav rework retires the team-scoped
// shell entirely. Single-membership case renders static text rather than a
// disabled/no-op picker — a coach with exactly one club has nothing to
// switch between, and design.md's Dropdown convention is for real choices.
function ClubSwitcher() {
  const memberships = useStore((s) => s.memberships)
  const selectedClubId = useStore((s) => s.selectedClubId)
  const selectClub = useStore((s) => s.selectClub)

  if (memberships.length === 0) return null
  if (memberships.length === 1) {
    return <span className="truncate text-sm text-ink-muted">{memberships[0].club.name}</span>
  }
  return (
    <Dropdown
      value={selectedClubId ?? ''}
      onChange={selectClub}
      options={memberships.map((m) => ({ value: m.club_id, label: m.club.name }))}
      ariaLabel="Select club"
      placeholder="Select club"
      triggerClassName="max-w-40"
    />
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
  // The Dashboard ("/") is cross-team by design (see its own header
  // comment in DashboardPage.tsx) and isn't in TEAM_SCOPED_PATHS, but a
  // coach landing there right after logging in still wants to see/set
  // which team they're working on — the switcher shouldn't be something
  // you only discover once you've already clicked into a team-scoped
  // page. Every other coach-level route (Teams, Calendar) stays as-is.
  const showTeamSelector = inTeamContext || location.pathname === '/'

  return (
    <div className="min-h-svh bg-surface">
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-panel px-4">
        {/* Back arrow (mobile only) then "Gaffer", always here unchanged
            by route. */}
        <BackButton />
        <BrandBlock />

        {/* Breadcrumb-style team selector — desktop only, team-scoped
            routes plus the Dashboard (see `showTeamSelector` above).
            This is a deliberate reversal of an earlier decision (see
            design.md's Navigation shell section): a version of this
            exact placement was tried, then walked back in favor of
            top-right, specifically because it was competing with
            "Gaffer" for the same "where am I" role. Moved back here at
            explicit instruction, with a concrete visual reference (an
            org-switcher breadcrumb) to build from. */}
        {showTeamSelector && (
          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-line" aria-hidden="true">
              /
            </span>
            <div className="max-w-40">
              <TeamSwitcher compact />
            </div>
          </div>
        )}

        {/* Right cluster — club switcher (Task 4 mount point; full nav
            rework lands in Task 7), theme toggle (always visible), sign-out
            (desktop only — mobile gets it in the drawer footer instead),
            hamburger (mobile only). */}
        <div className="ml-auto flex items-center gap-3">
          <ClubSwitcher />
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
          <NavList items={activeItems} onNavigate={() => setNavOpen(false)} />
          <SignOutFooter email={session?.user.email} />
        </div>
      </div>

      {/* Desktop primary nav — a narrow icon rail that's always visible
          (unlike the earlier off-canvas version, the icons themselves are
          the permanent "navigation lives here" cue, not something you have
          to discover by hovering blind), and widens in place to reveal
          labels when the cursor is on it. This is a fixed element sitting
          outside document flow — growing its own `width` on hover doesn't
          reflow anything; it just paints over more of the content to its
          right, which is why `<main>` only needs to reserve space for the
          narrow resting width (`lg:pl-16`), not the expanded one. The rail
          itself rests at `w-14` (56px), a touch narrower than that 64px
          reservation, so there's a thin sliver of plain background between
          the rail's own border and where `<main>`'s content starts —
          deliberate, so the rail reads as its own floating strip rather
          than a panel flush against the content next to it.

          At narrower desktop/tablet widths the expanded rail can cover a
          large slice of `<main>` without covering all of it —
          neither "out of the way" nor "clearly in front," just an ugly
          partial overlap with clipped text behind it. Fixed the same way
          the mobile drawer already handles the same problem: a `backdrop`
          sibling dims whatever's behind the rail while it's expanded, so
          the overlap reads as an intentional flyout rather than a layout
          glitch. A wrapping `.group` div (not on the `<aside>` itself, like
          before) covers both the rail and the backdrop so one hover/focus
          state drives both — the backdrop is `pointer-events-none`, so it
          never itself becomes the hover target; only the rail's own links
          can, which keeps the two in sync with no JS state. The wrapper is
          a plain `<div>`; both children are `fixed`, so it takes up no
          space of its own and doesn't disturb layout.

          The labels don't need separate icon-only vs. icon+label markup
          either. `NavList` always renders both; at the resting `w-14` the
          label simply overflows past the link's own box and gets clipped
          by this element's `overflow-hidden` before it can spill into the
          page, and at the expanded `w-52` there's room for it to render
          normally. One `NavList`, two widths, CSS does the rest.

          Below `lg` none of this renders: phones and tablets get the
          hamburger drawer instead. */}
      <div className="group hidden lg:block">
        <aside className="fixed bottom-0 left-0 top-14 z-20 flex w-14 flex-col overflow-hidden border-r border-line bg-panel transition-[width] duration-200 ease-out group-hover:w-52 group-focus-within:w-52">
          <NavList items={activeItems} fadeLabel />
        </aside>
        <div className="pointer-events-none fixed bottom-0 left-14 right-0 top-14 z-10 bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />
      </div>

      <main className="lg:pl-16">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
