import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Eye, FolderPlus, Pause, PenSquare, Play, Trash2 } from 'lucide-react'
import type { Drill } from '../../store'
import {
  DRILL_DIFFICULTY_LABELS,
  DRILL_INTENSITY_LABELS,
  DRILL_PHASE_OF_PLAY_LABELS,
  SESSION_BLOCK_LABELS,
} from '../../store'
import { formatDimensions, presetLabel } from './canvas/pitchPresets'
import { frameAt } from './canvas/interpolate'
import { formatClock } from './timeline/cursor'
import { useTimelinePlayback } from './timeline/useTimelinePlayback'
import { PitchCanvas } from './PitchCanvas'
import { DetailRow, DetailSection, DetailsPane } from '../library/DetailsPane'
import { Badge } from '../ui/Badge'

// The drill half of the Library's details rail (2026-08-28) — the old
// DrillPreviewPanel, moved beside the list instead of below it and given the
// metadata a file manager's inspector shows. The animated playback is
// unchanged from Stage 9.3, including the fresh `useTimelinePlayback` per
// drill (the caller keys this component on drill.id) so a new selection
// never inherits the previous drill's clock.
//
// Rendered at a fixed canvas width because both of its homes are the same
// fixed 24rem (LibraryShell's inline xl column and its below-xl slide-over
// now match). Sized against that minus DetailsPane's own p-3 and this
// component's p-2 wrapper around the canvas.
const CANVAS_WIDTH = 336

export function DrillDetails({
  drill,
  canEdit,
  canFile,
  collectionNames,
  onClose,
  onDuplicate,
  onDelete,
  onAddToCollection,
}: {
  drill: Drill
  canEdit: boolean
  canFile: boolean
  collectionNames: string[]
  onClose: () => void
  onDuplicate: () => Promise<void>
  onDelete: () => void
  onAddToCollection: () => void
}) {
  const [duplicating, setDuplicating] = useState(false)
  const playback = useTimelinePlayback(drill.duration_seconds)

  // Keep demonstrating itself rather than stopping after one pass — the same
  // looping behaviour the preview panel had.
  useEffect(() => {
    playback.toggleLoop()
    // Once per playback instance, which is once per selected drill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const frame = useMemo(
    () => frameAt(drill.scene, drill.keyframes, playback.currentTime),
    [drill.scene, drill.keyframes, playback.currentTime]
  )

  const players =
    drill.min_players != null && drill.max_players != null
      ? drill.min_players === drill.max_players
        ? `${drill.min_players}`
        : `${drill.min_players}–${drill.max_players}`
      : drill.players_recommended != null
        ? `${drill.players_recommended}`
        : drill.min_players != null
          ? `${drill.min_players}+`
          : null
  const ageBand = drill.age_min && drill.age_max ? `${drill.age_min}–${drill.age_max}` : (drill.age_min ?? drill.age_max)

  return (
    <DetailsPane title={drill.name} subtitle={drill.category} onClose={onClose}>
      <div className="flex justify-center rounded-lg bg-panel-raised p-2">
        <PitchCanvas pitch={drill.pitch} frame={frame} maxWidth={CANVAS_WIDTH} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs tabular-nums text-ink-muted">
          {formatClock(playback.currentTime)} / {formatClock(drill.duration_seconds)}
        </span>
        {drill.keyframes.length > 1 && (
          <button
            type="button"
            onClick={playback.togglePlay}
            className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            {playback.playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {playback.playing ? 'Pause' : 'Play'}
          </button>
        )}
      </div>

      {drill.objective && (
        <DetailSection label="Objective">
          <p className="text-xs leading-relaxed text-ink-muted">{drill.objective}</p>
        </DetailSection>
      )}

      <DetailSection label="Details">
        <div className="space-y-1.5">
          {drill.duration_minutes != null && <DetailRow label="Duration">{drill.duration_minutes} min</DetailRow>}
          {players && <DetailRow label="Players">{players}</DetailRow>}
          {ageBand && <DetailRow label="Age">{ageBand}</DetailRow>}
          {drill.difficulty && <DetailRow label="Level">{DRILL_DIFFICULTY_LABELS[drill.difficulty]}</DetailRow>}
          {drill.intensity && <DetailRow label="Intensity">{DRILL_INTENSITY_LABELS[drill.intensity]}</DetailRow>}
          {drill.session_block && <DetailRow label="Block">{SESSION_BLOCK_LABELS[drill.session_block]}</DetailRow>}
          {drill.phase_of_play && <DetailRow label="Phase">{DRILL_PHASE_OF_PLAY_LABELS[drill.phase_of_play]}</DetailRow>}
          <DetailRow label="Pitch">
            {presetLabel(drill.pitch.preset)} ·{' '}
            {formatDimensions(drill.pitch.lengthMeters, drill.pitch.widthMeters, drill.pitch.units ?? 'm')}
          </DetailRow>
          <DetailRow label="Keyframes">{drill.keyframes.length}</DetailRow>
          <DetailRow label="Added">{new Date(drill.created_at).toLocaleDateString()}</DetailRow>
        </div>
      </DetailSection>

      {/* A drill can sit in several collections at once, so where it's filed
          is a list, not a location — the one piece of "where is this?" the
          sidebar can't answer while you're standing somewhere else. */}
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
          to={canEdit ? `/design/${drill.id}` : `/drills/${drill.id}/view`}
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
