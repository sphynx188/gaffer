import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './hooks/useSession'
import { Login } from './components/Login'
import { ResetPassword } from './components/ResetPassword'
import { OfflineBanner } from './components/OfflineBanner'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { TeamOverviewPage } from './pages/TeamOverviewPage'
import { RosterPage } from './pages/RosterPage'
import { SessionsPage } from './pages/SessionsPage'
import { AttendancePage } from './pages/AttendancePage'
import { DesignPage } from './pages/DesignPage'
import { DrillEditorPage } from './pages/DrillEditorPage'
import { DrillLibraryPage } from './pages/DrillLibraryPage'
import { DrillCardPage } from './pages/DrillCardPage'
import { SharedDrillPage } from './pages/SharedDrillPage'
import { TeamSettingsPage } from './pages/TeamSettingsPage'
import { CalendarPage } from './pages/CalendarPage'
import { TacticsPage } from './pages/TacticsPage'
import { TacticEditorPage } from './pages/TacticEditorPage'
import { TacticCardPage } from './pages/TacticCardPage'
import { SharedTacticPage } from './pages/SharedTacticPage'
import { LandingPage } from './pages/landing/LandingPage'

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
    // Signed-out visitors get the marketing site (landing-page spec,
    // 2026-08-26): landing at `/`, the real sign-in/sign-up screen at
    // `/login`, everything else back to `/`. Share pages never reach here —
    // they're routed above the gate in App().
    return (
      <Routes>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<Login />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
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
        <Route index element={<DashboardPage />} />
        <Route path="overview" element={<TeamOverviewPage />} />
        <Route path="roster" element={<RosterPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="design" element={<DesignPage />} />
        <Route path="design/:drillId" element={<DrillEditorPage />} />
        <Route path="drills" element={<DrillLibraryPage />} />
        <Route path="tactics" element={<TacticsPage />} />
        <Route path="tactics/:tacticId" element={<TacticEditorPage />} />
        <Route path="teams" element={<TeamSettingsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default App
