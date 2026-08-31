import { useEffect } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { PenTool } from 'lucide-react'
import { useStore } from '../store'
import { selectMyRole } from '../store/slices/clubSlice'
import { useSession } from '../hooks/useSession'
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
  const { session } = useSession()
  const myUserId = session?.user.id ?? null
  const isAdmin = useStore((s) => selectMyRole(s) === 'admin')
  const selectedClubId = useStore((s) => s.selectedClubId)
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const drillsError = useStore((s) => s.drillsError)
  const fetchDrills = useStore((s) => s.fetchDrills)

  // Landing here directly from a link means the store is empty, so this screen
  // fetches for itself rather than assuming the picker ran first — the same
  // rule every other screen in the app follows. Club tenancy (2026-08-28):
  // no scope argument any more (RLS decides visibility) — this call-site was
  // previously gated on `selectedTeamId`, which stops being set once the
  // team module is shelved (Task 7); un-gated here per the plan's Task 5
  // call-site census, or this screen would silently fetch nothing and
  // render empty for every drill, editable or not.
  useEffect(() => {
    void fetchDrills()
  }, [fetchDrills])

  const drill = drills.find((d) => d.id === drillId) ?? null

  // The library only ever LINKS a non-editable drill to `/drills/:id/view`
  // (canEditDoc) — this is what actually enforces it against typing
  // `/design/:id` in directly. It matters beyond tidiness: the editor's
  // export drawer renders PNG/GIF/the print Card entirely client-side off
  // data already in the browser, which RLS's write policies do nothing to
  // stop — a licensed-in (or any not-mine) drill reaching this far would
  // still be fully "downloadable" even though the UI never offers it.
  // `club_id === selectedClubId` is a hard precondition, not just one half
  // of an OR — see clubSlice's canEditDoc comment: without it, a drill this
  // coach created stays "theirs to edit" (and export) even after their own
  // club licenses it out to one they also belong to.
  if (drill && !(drill.club_id === selectedClubId && (isAdmin || drill.created_by === myUserId))) {
    return <Navigate to={`/drills/${drill.id}/view`} replace />
  }

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
        <EmptyState icon={PenTool} message="That drill isn't in your library." />
        <Link to="/drills" className="text-sm font-medium text-accent-ink hover:underline">
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
