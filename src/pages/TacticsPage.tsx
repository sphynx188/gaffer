import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { useStore } from '../store'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'

// `/tactics` is the picker (TACTICS_BOARD_REWORK_PLAN.md Stage 7.1): choose a
// tactic to open in the editor at `/tactics/:tacticId`, or create one and land
// straight in it. The same shape `/design` has taken since the drill rework —
// the board itself no longer lives on this page.
const SKELETON_ROWS = [0, 1, 2]

export function TacticsPage() {
  const navigate = useNavigate()
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const tactics = useStore((s) => s.tactics)
  const tacticsLoading = useStore((s) => s.tacticsLoading)
  const tacticsError = useStore((s) => s.tacticsError)
  const fetchTactics = useStore((s) => s.fetchTactics)
  const createTactic = useStore((s) => s.createTactic)

  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (selectedTeamId) void fetchTactics(selectedTeamId)
  }, [selectedTeamId, fetchTactics])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedTeamId || !name.trim() || submitting) return
    setSubmitting(true)
    const created = await createTactic({ team_id: selectedTeamId, name: name.trim() })
    setSubmitting(false)
    if (created) {
      setName('')
      navigate(`/tactics/${created.id}`)
    }
  }

  return (
    <div>
      <PageHeader title="Tactics" />
      <Card>
        <div className="space-y-4">
          {!selectedTeamId && <EmptyState icon={Shield} message="Select a team to build its tactics." />}

          {selectedTeamId && (
            <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="new-tactic-name" className="block text-xs font-medium text-ink-muted">
                  New tactic name
                </label>
                <input
                  id="new-tactic-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 4-3-3 — Build Up"
                  className="mt-1 w-56 rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
                />
              </div>
              <button
                type="submit"
                disabled={!name.trim() || submitting}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create tactic'}
              </button>
            </form>
          )}

          {tacticsError && <p className="text-sm text-bad">{tacticsError}</p>}

          {selectedTeamId && tacticsLoading && tactics.length === 0 && (
            <div role="status" aria-busy="true" className="space-y-2">
              <span className="sr-only">Loading tactics…</span>
              {SKELETON_ROWS.map((row) => (
                <Skeleton key={row} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}

          {selectedTeamId && !tacticsLoading && tactics.length === 0 && !tacticsError && (
            <EmptyState icon={Shield} message="No tactics yet — create one above." />
          )}

          {tactics.length > 0 && (
            <ul className="space-y-2">
              {tactics.map((tactic) => (
                <li key={tactic.id}>
                  <Link
                    to={`/tactics/${tactic.id}`}
                    className="flex items-center justify-between rounded-lg border border-line px-3 py-3 transition-colors hover:border-line-strong"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{tactic.name}</span>
                      <span className="block truncate text-xs text-ink-faint">
                        {tactic.sides.home.formation} vs {tactic.sides.away.formation} ·{' '}
                        {tactic.scene.entities.length} on the board
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-muted">Open</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
