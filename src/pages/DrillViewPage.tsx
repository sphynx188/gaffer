import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Copy, LibraryBig } from 'lucide-react'
import { useStore } from '../store'
import { isLicensedDoc } from '../store/slices/clubSlice'
import { SharedDrill } from './SharedDrillPage'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// Read-only in-app viewer for a drill the coach can see but not edit — a
// collection grant or a license, per club tenancy's visibility model
// (spec §6.3). Reuses the exact same presentational component the public
// `/d/:token` share page renders (SharedDrillPage.tsx), fed by id from the
// store instead of a token fetch. DrillLibrary routes here for any card
// `canEditDoc` says no to; a direct visit works too regardless of edit
// rights (viewing your own drill read-only isn't harmful, just redundant).
export function DrillViewPage() {
  const { drillId } = useParams<{ drillId: string }>()
  const navigate = useNavigate()
  const selectedClubId = useStore((s) => s.selectedClubId)
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const duplicateDrill = useStore((s) => s.duplicateDrill)
  const [duplicating, setDuplicating] = useState(false)

  useEffect(() => {
    void fetchDrills()
  }, [fetchDrills])

  const drill = drills.find((d) => d.id === drillId) ?? null

  const handleDuplicate = async () => {
    if (!drill) return
    setDuplicating(true)
    const created = await duplicateDrill(drill.id)
    setDuplicating(false)
    if (created) navigate(`/design/${created.id}`)
  }

  if (!drill) {
    if (drillsLoading) {
      return (
        <div className="mx-auto max-w-[560px] p-6">
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-[560px] space-y-3 p-6">
        <EmptyState icon={LibraryBig} message="That drill isn't in your library." />
        <Link to="/drills" className="text-sm font-medium text-accent-ink hover:underline">
          Back to the drill library
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-surface px-4 py-6">
      <div className="mx-auto max-w-[560px] space-y-4">
        <Link to="/drills" className="text-sm font-medium text-accent-ink hover:underline">
          ← Back to the drill library
        </Link>
        <SharedDrill drill={drill} />
        {isLicensedDoc(drill, selectedClubId) ? (
          <p className="text-center text-xs text-ink-faint">Licensed to your club — view only.</p>
        ) : (
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={duplicating}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {duplicating ? 'Duplicating…' : 'Duplicate to my drills'}
          </button>
        )}
      </div>
    </div>
  )
}
