import { useEffect, useState, type ComponentType } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ChevronLeft, Home, LibraryBig, LogOut, Menu, Moon, Plus, Settings, Sun, X } from 'lucide-react'
import { useStore } from '../store'
import { selectMyRole } from '../store/slices/clubSlice'
import { useSession } from '../hooks/useSession'
import { useTheme } from '../hooks/useTheme'
import { supabase } from '../lib/supabase'
import { Dropdown } from '../components/ui/Dropdown'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
}

// Club tenancy (2026-08-28, Task 7): one flat nav for every signed-in
// route now — the earlier coach-level/team-level two-tier split (and the
// route-driven TEAM_SCOPED_PATHS switch that chose between them) is gone
// along with the team module it organized. Home/Create/Library
// (2026-08-28, post-launch) joined it: Home is the real landing route now
// (see BrandBlock/BackButton below), Create is a front door to the existing
// drill/tactic creation entry points (see CreatePage.tsx), and Library
// merges the former separate "Drill library"/"Tactics" entries into one —
// the split lives inside LibraryLayout's own tab bar now, not the main nav.
// `end: true` on Home keeps it from reading "active" on every other route,
// since `/` is a prefix of all of them.
const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/create', label: 'Create', icon: Plus },
  { to: '/library', label: 'Library', icon: LibraryBig },
]

// Settings (Task 8, relabeled from "Admin" 2026-08-28): role-gated,
// appended only for a club admin — /settings/* itself also redirects a
// non-admin (AdminLayout's own guard), so this is belt-and-braces UI
// polish, not the actual access control.
const SETTINGS_NAV_ITEM: NavItem = { to: '/settings', label: 'Settings', icon: Settings }

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
// consistent "where am I" anchor. Links to "/", the club Home page
// (2026-08-28) — was the drill library since Task 7, before Home existed.
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
// destination. Hidden on Home ("/") — that's the app's true landing screen
// (2026-08-28; was the drill library before Home existed), with nothing
// behind it to go back to.
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

// Club switcher — the one "where am I" control since Task 7 retired the
// team-scoped breadcrumb selector and TeamSwitcher along with it.
// Single-membership case renders static text rather than a disabled/no-op
// picker — a coach with exactly one club has nothing to switch between,
// and design.md's Dropdown convention is for real choices.
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

// One flat nav since Task 7 (Home / Create / Drill library / Tactics, +
// Settings for a club admin — see NAV_ITEMS/SETTINGS_NAV_ITEM above),
// rendered as a slim sticky top bar plus an icon rail on desktop/tablet, or
// a hamburger-triggered slide-in drawer below `lg`.
export function AppShell() {
  const { session } = useSession()
  const fetchTeams = useStore((s) => s.fetchTeams)
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  const navItems = isAdmin ? [...NAV_ITEMS, SETTINGS_NAV_ITEM] : NAV_ITEMS
  const [navOpen, setNavOpen] = useState(false)
  // The Library's three-pane file-manager layout (2026-08-28) genuinely
  // wants more than the 1152px every other page in the app is built for —
  // a single-column form or report doesn't need the room, but a places
  // rail + list + details rail does, and on a wide monitor the reading-width
  // cap was leaving real, visible margin unused on both sides while the
  // list and details columns were fighting each other for space. Scoped to
  // this one route rather than raising the app-wide cap, since nothing else
  // was designed or asked to change.
  const isLibrary = useLocation().pathname.startsWith('/library')

  // Same reasoning as isLibrary above, for the two editors' canvas/inspector
  // layouts: the reading-width cap left the canvas artificially small with wide
  // margins either side. Scoped to the editor routes specifically — bare
  // `/design` is just the create-and-redirect spinner, `/tactics/new` is the
  // name form, and `/tactics/:id/view` and the card routes are read-only pages
  // that DO want the reading width. The tactics editor joined on 2026-08-30,
  // when it was rebuilt on the drill editor's layout and inherited the same
  // problem the cap causes.
  const editorPath = useLocation().pathname
  const isEditor =
    /^\/design\/[^/]+$/.test(editorPath) || /^\/tactics\/(?!new$)[^/]+$/.test(editorPath)

  // Kept despite the team module being shelved (Task 7): SquadPanel's
  // opposition-team picker (dormant-legal on an old, real-team_id tactic —
  // Task 6 explicitly does not regress it) reads the store's `teams` array
  // directly, and nothing else populates it now that TeamSwitcher — the
  // only other consumer — is gone. Removing this call would silently empty
  // that picker's options, the exact call-site-trap failure mode this
  // whole plan keeps naming; kept on purpose, noted in the Amendment log.
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

  return (
    <div className="min-h-svh bg-surface">
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-panel px-4">
        {/* Back arrow (mobile only) then "Gaffer", always here unchanged
            by route. */}
        <BackButton />
        <BrandBlock />

        {/* Right cluster — club switcher, theme toggle (always visible),
            sign-out (desktop only — mobile gets it in the drawer footer
            instead), hamburger (mobile only). The team-scoped breadcrumb
            selector that used to live here is gone with Task 7 — the club
            switcher is the one "where am I" control now. */}
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
            <ClubSwitcher />
          </div>
          <NavList items={navItems} onNavigate={() => setNavOpen(false)} />
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
          <NavList items={navItems} fadeLabel />
        </aside>
        <div className="pointer-events-none fixed bottom-0 left-14 right-0 top-14 z-10 bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100" />
      </div>

      <main className="lg:pl-16">
        <div
          className={`mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8 ${isLibrary || isEditor ? 'max-w-[96rem]' : 'max-w-6xl'}`}
        >
          <Outlet />
        </div>
      </main>
    </div>
  )
}
