import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PenTool } from 'lucide-react'
import { useStore } from '../store'
import { DrillEditor } from '../components/design/editor/DrillEditor'
import { ToastProvider } from '../components/ui/Toast'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// Deep link to one drill (rework plan Stage 5.1). Splitting the editor out of
// `/design` is what lets the library, the session planner and — later — a
// share link point at a specific drill instead of "whatever the picker had
// selected".
export function DrillEditorPage() {
  const { drillId } = useParams<{ drillId: string }>()
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const drillsError = useStore((s) => s.drillsError)
  const fetchDrills = useStore((s) => s.fetchDrills)

  // Landing here directly from a link means the store is empty, so this screen
  // fetches for itself rather than assuming the picker ran first — the same
  // rule every other screen in the app follows.
  useEffect(() => {
    if (selectedTeamId) fetchDrills(selectedTeamId)
  }, [selectedTeamId, fetchDrills])

  const drill = drills.find((d) => d.id === drillId) ?? null

  if (!drill) {
    if (drillsLoading) {
      return (
        <div role="status" aria-busy="true">
          <span className="sr-only">Loading drill…</span>
          <Skeleton className="aspect-[3/2] w-full max-w-[960px] rounded-lg" />
        </div>
      )
    }
    return (
      <div className="space-y-3">
        {drillsError && <p className="text-sm text-bad">{drillsError}</p>}
        <EmptyState icon={PenTool} message="That drill isn't in this team's list." />
        <Link to="/design" className="text-sm font-medium text-accent hover:underline">
          Back to drills
        </Link>
      </div>
    )
  }

  return (
    <ToastProvider>
      <DrillEditor drill={drill} />
    </ToastProvider>
  )
}
