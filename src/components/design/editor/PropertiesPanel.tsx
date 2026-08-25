import { Trash2 } from 'lucide-react'
import { useStore } from '../../../store'
import type { Drill, SceneEntity } from '../../../store'
import { formatClock } from '../timeline/cursor'

// The right-hand panel (rework plan Stage 5.2): the drill's keyframes when
// nothing is selected, and the selected entity's properties when something is.
//
// The property set here is what the data model actually carries today — team,
// number and label. Stage 6 adds the rest (display style, individual colour,
// goalkeeper, facing, body shape, Draw Route) along with the panels that
// author them.

interface PropertiesPanelProps {
  drill: Drill
  selectedIds: string[]
  currentTime: number
  onSeek: (seconds: number) => void
  onRemoveSelection: () => void
}

const FIELD =
  'w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30'

const KIND_LABEL: Record<SceneEntity['kind'], string> = {
  player: 'Player',
  ball: 'Ball',
  equipment: 'Equipment',
}

const EQUIPMENT_LABEL: Record<string, string> = {
  cone: 'Agility pole',
  witches_hat: "Witches' hat",
  mannequin: 'Mannequin',
}

export function PropertiesPanel({ drill, selectedIds, currentTime, onSeek, onRemoveSelection }: PropertiesPanelProps) {
  const updateEntity = useStore((s) => s.updateEntity)

  const selected = drill.scene.entities.filter((entity) => selectedIds.includes(entity.id))
  const selectedMarkings = drill.scene.markings.filter((marking) => selectedIds.includes(marking.id))

  if (selectedIds.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-ink-muted">Keyframes</p>
        {drill.keyframes.length === 0 && (
          <p className="text-xs text-ink-faint">No keyframes yet — add one from the timeline.</p>
        )}
        <ul className="space-y-1">
          {[...drill.keyframes]
            .sort((a, b) => a.t - b.t)
            .map((keyframe, index) => {
              const parked = Math.abs(keyframe.t - currentTime) < 0.05
              return (
                <li key={keyframe.id}>
                  <button
                    type="button"
                    onClick={() => onSeek(keyframe.t)}
                    className={
                      'flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ' +
                      (parked ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
                    }
                  >
                    <span className="font-mono text-xs tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                    <span className="flex-1 truncate">{keyframe.name ?? 'Keyframe'}</span>
                    <span className="font-mono text-xs tabular-nums text-ink-faint">{formatClock(keyframe.t)}</span>
                  </button>
                </li>
              )
            })}
        </ul>
      </div>
    )
  }

  if (selected.length === 0 && selectedMarkings.length > 0) {
    return (
      <SelectionShell count={selectedMarkings.length} noun="marking" onRemove={onRemoveSelection}>
        <p className="text-xs text-ink-faint">
          Stroke, dash, width and fill are authored in the markings stage.
        </p>
      </SelectionShell>
    )
  }

  if (selected.length > 1) {
    return (
      <SelectionShell count={selected.length} noun="item" onRemove={onRemoveSelection}>
        <p className="text-xs text-ink-faint">
          Drag any one of them to move the group, or nudge with the arrow keys.
        </p>
      </SelectionShell>
    )
  }

  const entity = selected[0]
  return (
    <SelectionShell count={1} noun={KIND_LABEL[entity.kind].toLowerCase()} onRemove={onRemoveSelection}>
      {entity.kind === 'player' && (
        <>
          <div>
            <label htmlFor="entity-team" className="block text-xs font-medium text-ink-muted">
              Team
            </label>
            <div className="mt-1 flex gap-1.5">
              {['A', 'B'].map((team) => (
                <button
                  key={team}
                  type="button"
                  onClick={() => updateEntity(drill.id, entity.id, { team })}
                  aria-pressed={entity.team === team}
                  className={
                    'min-h-11 flex-1 rounded-md border px-2 text-sm font-medium transition-colors lg:min-h-9 ' +
                    (entity.team === team
                      ? 'border-accent bg-accent text-white'
                      : 'border-line text-ink-muted hover:border-line-strong')
                  }
                >
                  {team}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="entity-number" className="block text-xs font-medium text-ink-muted">
              Number
            </label>
            <input
              id="entity-number"
              type="number"
              min={1}
              value={entity.number ?? ''}
              onChange={(e) => {
                const parsed = Number(e.target.value)
                updateEntity(drill.id, entity.id, {
                  number: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                })
              }}
              className={'mt-1 ' + FIELD}
            />
          </div>
          <div>
            <label htmlFor="entity-label" className="block text-xs font-medium text-ink-muted">
              Label
            </label>
            <input
              id="entity-label"
              value={entity.label ?? ''}
              placeholder="e.g. GK"
              onChange={(e) => updateEntity(drill.id, entity.id, { label: e.target.value || undefined })}
              className={'mt-1 ' + FIELD}
            />
          </div>
        </>
      )}

      {entity.kind === 'equipment' && (
        <p className="text-xs text-ink-faint">{EQUIPMENT_LABEL[entity.equipment ?? 'cone'] ?? entity.equipment}</p>
      )}

      {entity.kind === 'ball' && <p className="text-xs text-ink-faint">A ball carries nothing beyond its position.</p>}
    </SelectionShell>
  )
}

function SelectionShell({
  count,
  noun,
  onRemove,
  children,
}: {
  count: number
  noun: string
  onRemove: () => void
  children: React.ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-muted">
          {count === 1 ? `1 ${noun} selected` : `${count} ${noun}s selected`}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="flex min-h-11 items-center gap-1.5 rounded-md border border-line px-2 text-xs font-medium text-ink-muted transition-colors hover:border-bad hover:text-bad lg:min-h-9"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>
      {children}
    </div>
  )
}
