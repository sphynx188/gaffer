import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useStore } from '../store'
import { TacticEditor } from '../components/tactics/TacticEditor'
import { ToastProvider } from '../components/ui/Toast'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// Deep link to one tactic (TACTICS_BOARD_REWORK_PLAN.md Stage 7.1), mirroring
// DrillEditorPage exactly — same fetch-for-itself rule, same not-found shape.
export function TacticEditorPage() {
  const { tacticId } = useParams<{ tacticId: string }>()
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const tactics = useStore((s) => s.tactics)
  const tacticsLoading = useStore((s) => s.tacticsLoading)
  const tacticsError = useStore((s) => s.tacticsError)
  const fetchTactics = useStore((s) => s.fetchTactics)
  const fetchPlayers = useStore((s) => s.fetchPlayers)
  const fetchCustomFormations = useStore((s) => s.fetchCustomFormations)

  // Landing here directly from a link means the store is empty, so this screen
  // fetches for itself rather than assuming the picker ran first. The roster
  // and the coach's saved formations come too — the squad panel needs both.
  useEffect(() => {
    if (!selectedTeamId) return
    void fetchTactics(selectedTeamId)
    void fetchPlayers(selectedTeamId)
    void fetchCustomFormations()
  }, [selectedTeamId, fetchTactics, fetchPlayers, fetchCustomFormations])

  const tactic = tactics.find((t) => t.id === tacticId) ?? null

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
        <EmptyState icon={Shield} message="That tactic isn't in this team's list." />
        <Link to="/tactics" className="text-sm font-medium text-accent hover:underline">
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
