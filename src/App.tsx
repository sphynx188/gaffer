import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './hooks/useSession'
import { Login } from './components/Login'
import { OfflineBanner } from './components/OfflineBanner'
import { AppShell } from './layout/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { RosterPage } from './pages/RosterPage'
import { SessionsPage } from './pages/SessionsPage'
import { AttendancePage } from './pages/AttendancePage'
import { DesignPage } from './pages/DesignPage'
import { DrillLibraryPage } from './pages/DrillLibraryPage'
import { TeamSettingsPage } from './pages/TeamSettingsPage'

// Redesign: this used to be a single scrolling column stacking every screen
// (Team management -> Roster -> Sessions -> Drill preview -> Drill library)
// on top of each other with no navigation at all. It's now a router with a
// persistent shell (src/layout/AppShell.tsx: sidebar on desktop, top bar +
// drawer on mobile) and one route per workflow, so a coach lands on a real
// Dashboard and jumps directly to Roster/Sessions/Attendance/Design/Drill
// library/Teams instead of scrolling past everything else to get there.
// Every page still reads/writes the same shared Zustand store (src/store) —
// only the layout changed, not the data flow.
function App() {
  const { session, loading } = useSession()

  // Mounted above every branch (loading/login/signed-in) so "you're offline,
  // nothing you do here is being saved" holds everywhere in the app, not
  // just once a coach is signed in and looking at a plan.
  if (loading) {
    return (
      <>
        <OfflineBanner />
        <div className="flex min-h-svh items-center justify-center bg-white">
          <p className="text-slate-400">Loading…</p>
        </div>
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
          <Route path="roster" element={<RosterPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="design" element={<DesignPage />} />
          <Route path="drills" element={<DrillLibraryPage />} />
          <Route path="teams" element={<TeamSettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
