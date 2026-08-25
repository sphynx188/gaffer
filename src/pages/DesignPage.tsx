import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PenTool } from 'lucide-react'
import { useStore } from '../store'
import type { Drill } from '../store'
import { PITCH_ORIENTATION_LABELS, PITCH_SIZE_LABELS } from '../store'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { CreateDrillForm } from '../components/design/editor/CreateDrillForm'

// `/design` is now the picker (rework plan Stage 5.1): choose a drill to open
// in the editor at `/design/:drillId`, or create one and land straight in it.
const SKELETON_ROWS = [0, 1, 2]

function pitchLabel(drill: Drill): string {
  const size = PITCH_SIZE_LABELS[drill.pitch_size] ?? drill.pitch_size
  const orientation = PITCH_ORIENTATION_LABELS[drill.pitch.orientation] ?? drill.pitch.orientation
  return `${size} · ${orientation}`
}

export function DesignPage() {
  const navigate = useNavigate()
  const selectedTeamId = useStore((s) => s.selectedTeamId)
  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const drillsError = useStore((s) => s.drillsError)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const createDrill = useStore((s) => s.createDrill)

  useEffect(() => {
    if (selectedTeamId) fetchDrills(selectedTeamId)
  }, [selectedTeamId, fetchDrills])

  return (
    <div>
      <PageHeader title="Design" />
      <Card>
        <div className="space-y-4">
          {!selectedTeamId && <EmptyState icon={PenTool} message="Select a team to design its drills." />}

          {selectedTeamId && (
            <CreateDrillForm
              teamId={selectedTeamId}
              onCreate={createDrill}
              onCreated={(created) => navigate(`/design/${created.id}`)}
            />
          )}

          {drillsError && <p className="text-sm text-bad">{drillsError}</p>}

          {selectedTeamId && drillsLoading && drills.length === 0 && (
            <div role="status" aria-busy="true" className="space-y-2">
              <span className="sr-only">Loading drills…</span>
              {SKELETON_ROWS.map((row) => (
                <Skeleton key={row} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          )}

          {selectedTeamId && !drillsLoading && drills.length === 0 && !drillsError && (
            <EmptyState icon={PenTool} message="No drills yet for this team — create one above." />
          )}

          {drills.length > 0 && (
            <ul className="space-y-1 border-t border-line pt-4">
              {drills.map((drill) => (
                <li key={drill.id}>
                  <Link
                    to={`/design/${drill.id}`}
                    className="flex min-h-14 items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-panel-raised"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{drill.name}</span>
                      <span className="block truncate text-xs text-ink-muted">{pitchLabel(drill)}</span>
                    </span>
                    <span className="shrink-0 text-xs text-ink-faint">
                      {drill.keyframes.length} {drill.keyframes.length === 1 ? 'keyframe' : 'keyframes'}
                    </span>
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
