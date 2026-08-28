import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Eye, FolderPlus, PenSquare, Shield, Trash2 } from 'lucide-react'
import type { Tactic } from '../../store'
import { DRILL_PHASE_OF_PLAY_LABELS } from '../../store'
import { formationLabel } from './formationLabel'
import { formatClock } from '../design/timeline/cursor'
import { DetailRow, DetailSection, DetailsPane } from '../library/DetailsPane'
import { Badge } from '../ui/Badge'

// The tactic half of the Library's details rail (2026-08-28). No animated
// playback here, unlike DrillDetails: a tactic's phases are organisational
// bands over the keyframe track rather than a drill's continuous movement,
// and the board reads as a still. The thumbnail is the preview.
export function TacticDetails({
  tactic,
  canEdit,
  canFile,
  collectionNames,
  onClose,
  onDuplicate,
  onDelete,
  onAddToCollection,
}: {
  tactic: Tactic
  canEdit: boolean
  canFile: boolean
  collectionNames: string[]
  onClose: () => void
  onDuplicate: () => Promise<void>
  onDelete: () => void
  onAddToCollection: () => void
}) {
  const [duplicating, setDuplicating] = useState(false)
  const players = tactic.scene.entities.filter((e) => e.kind === 'player').length

  return (
    <DetailsPane
      title={tactic.name}
      subtitle={`${formationLabel(tactic.sides.home.formation)} v ${formationLabel(tactic.sides.away.formation)}`}
      onClose={onClose}
    >
      <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-panel-raised">
        {tactic.thumbnail_url ? (
          <img src={tactic.thumbnail_url} alt={`${tactic.name} board`} className="h-full w-full object-cover" />
        ) : (
          <Shield className="h-6 w-6 text-ink-faint" />
        )}
      </div>

      {tactic.description && (
        <DetailSection label="Description">
          <p className="text-xs leading-relaxed text-ink-muted">{tactic.description}</p>
        </DetailSection>
      )}

      <DetailSection label="Details">
        <div className="space-y-1.5">
          <DetailRow label="Home">{formationLabel(tactic.sides.home.formation)}</DetailRow>
          <DetailRow label="Away">{formationLabel(tactic.sides.away.formation)}</DetailRow>
          {tactic.phase_of_play && <DetailRow label="Phase">{DRILL_PHASE_OF_PLAY_LABELS[tactic.phase_of_play]}</DetailRow>}
          <DetailRow label="On the board">{players}</DetailRow>
          <DetailRow label="Phases">{tactic.phases.length}</DetailRow>
          <DetailRow label="Duration">{formatClock(tactic.duration_seconds)}</DetailRow>
          <DetailRow label="Added">{new Date(tactic.created_at).toLocaleDateString()}</DetailRow>
        </div>
      </DetailSection>

      <DetailSection label="In collections">
        {collectionNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {collectionNames.map((name) => (
              <Badge key={name} tone="neutral">
                {name}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-ink-faint">Not in any collection.</p>
        )}
      </DetailSection>

      <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
        <Link
          to={canEdit ? `/tactics/${tactic.id}` : `/tactics/${tactic.id}/view`}
          className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          {canEdit ? <PenSquare className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {canEdit ? 'Open' : 'View'}
        </Link>
        <button
          type="button"
          onClick={async () => {
            setDuplicating(true)
            await onDuplicate()
            setDuplicating(false)
          }}
          disabled={duplicating}
          className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
        >
          <Copy className="h-3.5 w-3.5" />
          {duplicating ? 'Duplicating…' : 'Duplicate'}
        </button>
        {canFile && (
          <button
            type="button"
            onClick={onAddToCollection}
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            File
          </button>
        )}
        {canEdit && (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-semibold text-bad transition-colors hover:border-bad/40 hover:bg-bad/5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        )}
      </div>
    </DetailsPane>
  )
}
