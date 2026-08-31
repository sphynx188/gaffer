import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Copy, Shield } from 'lucide-react'
import { useStore } from '../store'
import { isLicensedDoc } from '../store/slices/clubSlice'
import { SharedTactic } from './SharedTacticPage'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// Read-only in-app viewer for a tactic the coach can see but not edit — a
// collection grant or a license, per club tenancy's visibility model
// (spec §6.3). Mirrors DrillViewPage.tsx exactly: reuses the presentational
// component the public `/t/:token` share page renders, fed by id from the
// store instead of a token fetch.
export function TacticViewPage() {
  const { tacticId } = useParams<{ tacticId: string }>()
  const navigate = useNavigate()
  const selectedClubId = useStore((s) => s.selectedClubId)
  const tactics = useStore((s) => s.tactics)
  const tacticsLoading = useStore((s) => s.tacticsLoading)
  const fetchTactics = useStore((s) => s.fetchTactics)
  const duplicateTactic = useStore((s) => s.duplicateTactic)
  const [duplicating, setDuplicating] = useState(false)

  useEffect(() => {
    void fetchTactics()
  }, [fetchTactics])

  const tactic = tactics.find((t) => t.id === tacticId) ?? null

  const handleDuplicate = async () => {
    if (!tactic) return
    setDuplicating(true)
    const created = await duplicateTactic(tactic.id)
    setDuplicating(false)
    if (created) navigate(`/tactics/${created.id}`)
  }

  if (!tactic) {
    if (tacticsLoading) {
      return (
        <div className="mx-auto max-w-[560px] p-6">
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
        </div>
      )
    }
    return (
      <div className="mx-auto max-w-[560px] space-y-3 p-6">
        <EmptyState icon={Shield} message="That tactic isn't in your library." />
        <Link to="/tactics" className="text-sm font-medium text-accent-ink hover:underline">
          Back to the tactic library
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-svh bg-surface px-4 py-6">
      <div className="mx-auto max-w-[560px] space-y-4">
        <Link to="/tactics" className="text-sm font-medium text-accent-ink hover:underline">
          ← Back to the tactic library
        </Link>
        <SharedTactic tactic={tactic} />
        {isLicensedDoc(tactic, selectedClubId) ? (
          <p className="text-center text-xs text-ink-faint">Licensed to your club — view only.</p>
        ) : (
          <button
            type="button"
            onClick={handleDuplicate}
            disabled={duplicating}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            {duplicating ? 'Duplicating…' : 'Duplicate to my tactics'}
          </button>
        )}
      </div>
    </div>
  )
}
