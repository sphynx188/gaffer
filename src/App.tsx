import { useSession } from './hooks/useSession'
import { Login } from './components/Login'
import { supabase } from './lib/supabase'
import { TeamManagement } from './components/TeamManagement'
import { TeamSwitcher } from './components/TeamSwitcher'
import { PlayerRoster } from './components/PlayerRoster'
import { SessionPlanner } from './components/SessionPlanner'
import { DrillPreview } from './components/design/DrillPreview'
import { DrillLibrary } from './components/design/DrillLibrary'
import { VerticalSliceSpike } from './components/VerticalSliceSpike'
import { OfflineBanner } from './components/OfflineBanner'

// Phase 0.5 Definition of Done: an authenticated empty shell. Phase 1.1
// (team management, gaffer_mvp_build_steps.md) is the first real Phase 1
// screen and lands directly below it. The 0.5.1 vertical slice spike stays
// mounted underneath for now — but no longer builds its own team or session,
// since TeamManagement and SessionPlanner are the real things now. Phase 1.2
// (multi-team switching) adds TeamSwitcher directly below the signed-in
// header: every team-scoped view below it reads the store's `selectedTeamId`
// rather than defaulting to teams[0]. Phase 1.3 (player roster CRUD) adds
// PlayerRoster below TeamManagement — it's the first real per-team roster
// view, also scoped by `selectedTeamId`. Phase 1.5 (weekly session planner)
// adds SessionPlanner below PlayerRoster — the real create/edit +
// week-at-a-glance view for sessions, also scoped by `selectedTeamId`. Phase
// 2a (static pitch renderer) adds DrillPreview below SessionPlanner — the
// first Design-side screen: it renders whichever drill is selected via
// Konva, using the same `selectedTeamId` scope. Phase 2b (drag-and-drop
// persistence) makes that canvas editable — dragging a player/cone/ball
// updates local state live and persists to Supabase on drop. It's the first
// thing to consume the drill data the 0.5.1 spike below still creates. Phase
// 2d (save as reusable / attach to session) replaces the spike's old
// "attach drill to session" step with the real thing: SessionDrillsPanel,
// reached via a "Drills" toggle on each session row inside SessionPlanner
// itself, so nothing new is mounted here — the spike below is trimmed down
// to just team/session/drill creation, since drill *attachment* now has a
// real home. Phase 3.1 (drill library / browse & search) adds DrillLibrary
// below DrillPreview — a simple browse-and-search list over the same
// `drills` state DrillPreview already fetches, so a coach can find a past
// drill by name/pitch format without stepping through the picker dropdown.
// Phase 3.4 (PWA install + app-shell caching) adds OfflineBanner above every
// branch below — it's the UI half of that phase's "no misleading 'saved'
// state while offline" requirement; the service worker itself is configured
// in vite.config.ts.
function App() {
  const { session, loading } = useSession()

  // Phase 3.4 — mounted above every branch (loading/login/signed-in) so
  // "you're offline, nothing you do here is being saved" holds everywhere
  // in the app, not just once a coach is signed in and looking at a plan.
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
    <>
      <OfflineBanner />
      <div className="flex min-h-svh flex-col items-center bg-white px-4 py-8">
        <div className="flex w-full max-w-lg flex-col items-center gap-3 text-center">
          <p className="text-slate-400">Gaffer</p>
          <p className="text-sm text-slate-500 break-words">Signed in as {session.user.email}</p>
          <TeamSwitcher />
          <button
            type="button"
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-slate-500 underline underline-offset-2"
          >
            Sign out
          </button>
        </div>
        <div className="mt-8 w-full max-w-lg">
          <TeamManagement />
        </div>
        <div className="mt-8 w-full max-w-lg">
          <PlayerRoster />
        </div>
        <div className="mt-8 w-full max-w-lg">
          <SessionPlanner />
        </div>
        <div className="mt-8 w-full max-w-lg">
          <DrillPreview />
        </div>
        <div className="mt-8 w-full max-w-lg">
          <DrillLibrary />
        </div>
        <VerticalSliceSpike />
      </div>
    </>
  )
}

export default App
