import { useSession } from './hooks/useSession'
import { Login } from './components/Login'
import { supabase } from './lib/supabase'

// Phase 0.5 Definition of Done: an authenticated empty shell. Team/session/
// drill screens start landing here from Phase 0.5.1 onward.
function App() {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-white">
        <p className="text-slate-400">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 bg-white">
      <p className="text-slate-400">Gaffer</p>
      <p className="text-sm text-slate-500">Signed in as {session.user.email}</p>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="text-sm text-slate-500 underline underline-offset-2"
      >
        Sign out
      </button>
    </div>
  )
}

export default App
