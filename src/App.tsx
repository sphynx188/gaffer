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
import { TeamSettingsPage } from './pages/TeamSettingsPage'
import { CalendarPage } from './pages/CalendarPage'
import { TacticsPage } from './pages/TacticsPage'

// Redesign: routed with a persistent shell (src/layout/AppShell.tsx) that
// swaps between a coach-level tab set (Dashboard/Teams/Calendar — cross-
// team) and a team-level one (Overview/Roster/Sessions/Attendance/Design/
// Drills — scoped to selectedTeamId) based on which of these routes is
// active, rendered as a slim top bar on desktop/tablet and a hamburger-
// triggered drawer on mobile. Every page still reads/writes the same shared
// Zustand store (src/store) — only the routing/layout differs.
function App() {
  const { session, loading, isPasswordRecovery, clearPasswordRecovery } = useSession()

  // Mounted above every branch (loading/login/signed-in) so "you're offline,
  // nothing you do here is being saved" holds everywhere in the app, not
  // just once a coach is signed in and looking at a plan.
  if (loading) {
    return (
      <>
        <OfflineBanner />
        <div className="flex min-h-svh items-center justify-center bg-surface">
          <p className="text-ink-muted">Loading…</p>
        </div>
      </>
    )
  }

  // Checked before the signed-in branch below even though a password-recovery
  // link already leaves `session` non-null — the coach needs to set a new
  // password before landing in the app, not skip straight past this screen.
  if (isPasswordRecovery) {
    return (
      <>
        <OfflineBanner />
        <ResetPassword onDone={clearPasswordRecovery} />
      </>
    )
  }

  if (!session) {
    return (
      <>
        <OfflineBanner />
        <Login />
      </>
    )
  }

  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
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
          <Route path="teams" element={<TeamSettingsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
