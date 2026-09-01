import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useStore } from '../store'
import { canEditDocWith, selectMyRole } from '../store/slices/clubSlice'
import { useSession } from '../hooks/useSession'
import { TacticEditor } from '../components/tactics/TacticEditor'
import { ToastProvider } from '../components/ui/Toast'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// Deep link to one tactic (TACTICS_BOARD_REWORK_PLAN.md Stage 7.1), mirroring
// DrillEditorPage exactly — same fetch-for-itself rule, same not-found shape.
export function TacticEditorPage() {
  const { tacticId } = useParams<{ tacticId: string }>()
  const { session } = useSession()
  const myUserId = session?.user.id ?? null
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  const selectedClubId = useStore((s) => s.selectedClubId)
  const tactics = useStore((s) => s.tactics)
  const tacticsLoading = useStore((s) => s.tacticsLoading)
  const tacticsError = useStore((s) => s.tacticsError)
  const fetchTactics = useStore((s) => s.fetchTactics)
  const fetchCustomFormations = useStore((s) => s.fetchCustomFormations)

  // Landing here directly from a link means the store is empty, so this
  // screen fetches for itself rather than assuming the picker ran first.
  // Club tenancy (2026-08-28): fetchTactics takes no scope argument any
  // more (RLS decides visibility) — un-gated per the plan's Task 6
  // call-site census, or this screen would silently fetch nothing.
  // fetchPlayers dropped entirely (rosters are shelved; Step 2 below hides
  // the UI that consumed it). fetchCustomFormations was ALSO wrongly gated
  // on selectedTeamId before this change even though the plan notes the
  // `formation` table is owner_id-scoped, not team-scoped — un-gating it
  // here too is the same fix applied consistently, not a separate one.
  useEffect(() => {
    void fetchTactics()
    void fetchCustomFormations()
  }, [fetchTactics, fetchCustomFormations])

  const tactic = tactics.find((t) => t.id === tacticId) ?? null

  // Same guard as DrillEditorPage.tsx — see its comment for why this has to
  // be an actual redirect rather than just the library's own links steering
  // people the right way: the editor's export drawer generates PNG/GIF/the
  // print Card entirely client-side, which RLS can't touch.
  if (tactic && !canEditDocWith(tactic, { selectedClubId, isAdmin, userId: myUserId })) {
    return <Navigate to={`/tactics/${tactic.id}/view`} replace />
  }

  if (!tactic) {
    if (tacticsLoading) {
      return (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading tactic…</span>
          <Skeleton className="aspect-[3/2] w-full max-w-[960px] rounded-lg" />
        </div>
      )
    }
    return (
      <div className="space-y-3">
        {tacticsError && <p className="text-sm text-bad">{tacticsError}</p>}
        <EmptyState icon={Shield} message="That tactic isn't in your library." />
        <Link to="/tactics" className="text-sm font-medium text-accent-ink hover:underline">
          Back to tactics
        </Link>
      </div>
    )
  }

  return (
    <ToastProvider>
      <TacticEditor tactic={tactic} />
    </ToastProvider>
  )
}
