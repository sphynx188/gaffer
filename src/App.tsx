import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './hooks/useSession'
import { useStore } from './store'
import { Login } from './components/Login'
import { ResetPassword } from './components/ResetPassword'
import { CreateClub } from './components/CreateClub'
import { OfflineBanner } from './components/OfflineBanner'
import { AppShell } from './layout/AppShell'
import { HomePage } from './pages/HomePage'
import { CreatePage } from './pages/CreatePage'
import { LibraryLayout } from './pages/LibraryLayout'
import { DesignPage } from './pages/DesignPage'
import { DrillEditorPage } from './pages/DrillEditorPage'
import { DrillLibraryPage } from './pages/DrillLibraryPage'
import { DrillCardPage } from './pages/DrillCardPage'
import { DrillViewPage } from './pages/DrillViewPage'
import { SharedDrillPage } from './pages/SharedDrillPage'
import { TacticsPage } from './pages/TacticsPage'
import { TacticViewPage } from './pages/TacticViewPage'
import { TacticEditorPage } from './pages/TacticEditorPage'
import { TacticCardPage } from './pages/TacticCardPage'
import { SharedTacticPage } from './pages/SharedTacticPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { CoachesPage } from './pages/admin/CoachesPage'
import { CollectionsPage } from './pages/admin/CollectionsPage'
import { TransferPage } from './pages/admin/TransferPage'
import { LicensesPage } from './pages/admin/LicensesPage'

// Redesign: routed with a persistent shell (src/layout/AppShell.tsx) that
// swaps between a coach-level tab set (Dashboard/Teams/Calendar — cross-
// team) and a team-level one (Overview/Roster/Sessions/Attendance/Design/
// Drills — scoped to selectedTeamId) based on which of these routes is
// active, rendered as a slim top bar on desktop/tablet and a hamburger-
// triggered drawer on mobile. Every page still reads/writes the same shared
// Zustand store (src/store) — only the routing/layout differs.
//
// The router now sits ABOVE the auth gate rather than inside the signed-in
// branch (rework plan Stage 10.4). `/d/:token` and `/t/:token` are public
// share pages that have to render for a visitor with no account at all, so
// they can't live behind `useSession` — the second joined the first in
// TACTICS_BOARD_REWORK_PLAN.md Stage 8.2. Everything else still does:
// `<AuthedApp>` is the old gate, unchanged in behaviour, just moved one level
// down. OfflineBanner moved up with it and now covers the share pages too,
// which is if anything more correct — the note applied to "every top-level
// branch" before and still does, there are simply more branches.
function App() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route path="/d/:token" element={<SharedDrillPage />} />
        <Route path="/t/:token" element={<SharedTacticPage />} />
        <Route path="*" element={<AuthedApp />} />
      </Routes>
    </BrowserRouter>
  )
}

function AuthedApp() {
  const { session, loading, isPasswordRecovery, clearPasswordRecovery } = useSession()
  const fetchMemberships = useStore((s) => s.fetchMemberships)
  const memberships = useStore((s) => s.memberships)
  // Tracks the user id the last completed fetch was FOR, not a bare
  // boolean — so "has the first fetch settled" is derived during render
  // (below) instead of toggled imperatively, which is what keeps the effect
  // free of a synchronous setState at its start. Without this, there'd be a
  // brief render where session is truthy but memberships is still
  // clubSlice's initial [], which would flash CreateClub for an instant on
  // every login even for an account that has clubs.
  const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null)
  const userId = session?.user.id ?? null

  // Keyed on the user id, not the whole `session` object — onAuthStateChange
  // hands back a new session object on every token refresh (hourly) even
  // though the signed-in user hasn't changed; re-fetching memberships then
  // would be harmless but pointless.
  useEffect(() => {
    if (!userId) return
    void fetchMemberships().then(() => setFetchedForUserId(userId))
  }, [userId, fetchMemberships])
  const membershipsFetched = userId !== null && fetchedForUserId === userId

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface">
        <p className="text-ink-muted">Loading…</p>
      </div>
    )
  }

  // Checked before the signed-in branch below even though a password-recovery
  // link already leaves `session` non-null — the coach needs to set a new
  // password before landing in the app, not skip straight past this screen.
  if (isPasswordRecovery) {
    return <ResetPassword onDone={clearPasswordRecovery} />
  }

  if (!session) {
    return <Login />
  }

  if (!membershipsFetched) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface">
        <p className="text-ink-muted">Loading…</p>
      </div>
    )
  }

  // Every account needs a club before there's anything club-scoped to show
  // (spec §2.2 — the solo-coach mode is retired; club tenancy is the only
  // mode now). CreateClub renders INSTEAD of the routed app, same shape as
  // the `!session` branch above rendering Login instead of it.
  if (memberships.length === 0) {
    return <CreateClub />
  }

  return (
    <Routes>
      {/* Signed in, a stray /login (bookmark, back button) goes home. */}
      <Route path="login" element={<Navigate to="/" replace />} />
      {/* Outside AppShell on purpose: a page whose whole job is to become a
          sheet of paper has no use for a nav rail (rework plan Stage 10.2;
          the tactic card joined it in TACTICS_BOARD_REWORK_PLAN.md 8.1). */}
      <Route path="drills/:drillId/card" element={<DrillCardPage />} />
      <Route path="tactics/:tacticId/card" element={<TacticCardPage />} />
      <Route element={<AppShell />}>
        {/* Club tenancy (2026-08-28, Task 7): the team module is shelved —
            Dashboard/Teams/Calendar/Overview/Roster/Sessions/Attendance
            routes removed (their pages, nav entries and slices stay wired,
            just unrouted). `/design` stays routed despite being
            historically team-scoped: Task 5 made it the app's only
            create-a-drill entry point (DrillLibrary's "+ New drill" link),
            so it's load-bearing again under a different name than
            "team-scoped". HomePage (2026-08-28, post-launch) is the real
            home route now, replacing the straight-to-/drills redirect;
            CreatePage is a front door to /design and /library/tactics's
            own creation forms, not new creation logic. */}
        <Route index element={<HomePage />} />
        <Route path="create" element={<CreatePage />} />
        <Route path="design" element={<DesignPage />} />
        <Route path="design/:drillId" element={<DrillEditorPage />} />
        {/* Library (2026-08-28): the former separate "Drill library" and
            "Tactics" nav entries merged into one, split by a tab bar
            (LibraryLayout) — each tab keeps its existing page component
            unchanged. Old /drills and /tactics kept as redirects, same
            shape as the /login redirect above, since a fair number of
            in-app links and any external bookmarks still point at them. */}
        <Route path="library" element={<LibraryLayout />}>
          <Route index element={<Navigate to="/library/drills" replace />} />
          <Route path="drills" element={<DrillLibraryPage />} />
          <Route path="tactics" element={<TacticsPage />} />
        </Route>
        <Route path="drills" element={<Navigate to="/library/drills" replace />} />
        <Route path="drills/:drillId/view" element={<DrillViewPage />} />
        <Route path="tactics" element={<Navigate to="/library/tactics" replace />} />
        <Route path="tactics/:tacticId/view" element={<TacticViewPage />} />
        <Route path="tactics/:tacticId" element={<TacticEditorPage />} />
        {/* AdminLayout does its own role gate (redirects non-admins to /) —
            the route itself is open, same shape as every other page here.
            Relabeled /admin → /settings (2026-08-28) for the nav; the
            component/file names underneath stay "Admin*", internal only. */}
        <Route path="settings" element={<AdminLayout />}>
          <Route index element={<Navigate to="/settings/coaches" replace />} />
          <Route path="coaches" element={<CoachesPage />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="transfer" element={<TransferPage />} />
          <Route path="licenses" element={<LicensesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
