import { Route, Trash2 } from 'lucide-react'
import { useStore } from '../../../store'
import type { BodyShape, Drill, EntityState, EquipmentType, Marking, PlayerDisplay, SceneEntity } from '../../../store'
import { EQUIPMENT_ADVANCED, EQUIPMENT_CORE, EQUIPMENT_LABELS } from '../../../store'
import { EquipmentIcon } from '../canvas/EquipmentShapes'
import { EQUIPMENT } from '../pitchTheme'
import { formatClock } from '../timeline/cursor'

// The right-hand panel (rework plan Stages 5.2 and 6.5): the drill's keyframes
// when nothing is selected, and the selected thing's properties when something
// is.
//
// Which keyframe matters here: a player's team or number belongs to the entity
// and is the same all drill long, while their facing, body shape and drawn
// route belong to the keyframe the playhead is parked on. The panel only
// offers the second group when there is a keyframe to write it to.

interface PropertiesPanelProps {
  drill: Drill
  selectedIds: string[]
  currentTime: number
  // The keyframe the playhead is parked on, if any, and whether one follows
  // it — Draw Route describes the run *to the next keyframe*, so it has
  // nothing to describe without a successor.
  parkedKeyframeId: string | null
  hasFollowingKeyframe: boolean
  drawingRoute: boolean
  onDrawRoute: () => void
  onClearRoute: () => void
  onSeek: (seconds: number) => void
  onRemoveSelection: () => void
  onDuplicateAlongLine: (entityId: string, count: number) => void
}

const FIELD =
  'w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30'
const ROW = 'flex min-h-11 flex-1 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors lg:min-h-9'
const ON = 'border-accent bg-accent text-white'
const OFF = 'border-line text-ink-muted hover:border-line-strong'

const KIND_LABEL: Record<SceneEntity['kind'], string> = { player: 'Player', ball: 'Ball', equipment: 'Equipment' }

const DISPLAYS: { value: PlayerDisplay; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'dot', label: 'Dot' },
]

const BODY_SHAPES: { value: BodyShape; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'backpedal', label: 'Backpedal' },
  { value: 'shuffle_left', label: 'Shuffle left' },
  { value: 'shuffle_right', label: 'Shuffle right' },
]

// The facing presets the target app offers, in canvas degrees (clockwise from
// east, y growing downward).
const FACINGS: { value: number; label: string }[] = [
  { value: 270, label: 'Up' },
  { value: 0, label: 'Right' },
  { value: 90, label: 'Down' },
  { value: 180, label: 'Left' },
]

const COLOUR_CHOICES = ['', 'orange', 'yellow', 'red', 'blue', 'white']

export function PropertiesPanel(props: PropertiesPanelProps) {
  const { drill, selectedIds, currentTime, onSeek, onRemoveSelection } = props
  const updateEntity = useStore((s) => s.updateEntity)
  const updateMarking = useStore((s) => s.updateMarking)
  const updateKeyframeState = useStore((s) => s.updateKeyframeState)

  const selected = drill.scene.entities.filter((entity) => selectedIds.includes(entity.id))
  const selectedMarkings = drill.scene.markings.filter((marking) => selectedIds.includes(marking.id))
  const parked = drill.keyframes.find((keyframe) => keyframe.id === props.parkedKeyframeId) ?? null

  // Per-keyframe authoring goes through updateKeyframeState, which replaces
  // the whole map — so the patch is merged onto what's already stored rather
  // than written over it.
  const patchState = (entityId: string, patch: Partial<EntityState>) => {
    if (!parked) return
    const current = parked.states[entityId] ?? {}
    updateKeyframeState(drill.id, parked.id, { ...parked.states, [entityId]: { ...current, ...patch } })
  }

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
              const here = Math.abs(keyframe.t - currentTime) < 0.05
              return (
                <li key={keyframe.id}>
                  <button
                    type="button"
                    onClick={() => onSeek(keyframe.t)}
                    className={
                      'flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ' +
                      (here ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
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

  if (selected.length === 0 && selectedMarkings.length === 1) {
    return (
      <Shell count={1} noun="marking" onRemove={onRemoveSelection}>
        <MarkingSection
          marking={selectedMarkings[0]}
          onPatch={(patch) => updateMarking(drill.id, selectedMarkings[0].id, patch)}
        />
      </Shell>
    )
  }

  if (selected.length + selectedMarkings.length > 1) {
    return (
      <Shell count={selected.length + selectedMarkings.length} noun="item" onRemove={onRemoveSelection}>
        <p className="text-xs text-ink-faint">Drag any one of them to move the group, or nudge with the arrow keys.</p>
      </Shell>
    )
  }

  if (selected.length === 0) {
    return (
      <Shell count={selectedMarkings.length} noun="marking" onRemove={onRemoveSelection}>
        <p className="text-xs text-ink-faint">Select a single marking to change how it's drawn.</p>
      </Shell>
    )
  }

  const entity = selected[0]
  const state = parked?.states[entity.id]

  return (
    <Shell count={1} noun={KIND_LABEL[entity.kind].toLowerCase()} onRemove={onRemoveSelection}>
      {entity.kind === 'player' && (
        <>
          <Choice
            label="Display"
            options={DISPLAYS.map((d) => ({ value: d.value, label: d.label }))}
            value={entity.display ?? 'standard'}
            onChange={(value) => updateEntity(drill.id, entity.id, { display: value as PlayerDisplay })}
          />
          <Choice
            label="Team"
            options={[{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]}
            value={entity.team ?? 'A'}
            onChange={(value) => updateEntity(drill.id, entity.id, { team: value })}
          />
          <Field label="Number">
            <input
              type="number"
              min={1}
              value={entity.number ?? ''}
              onChange={(e) => {
                const parsed = Number(e.target.value)
                updateEntity(drill.id, entity.id, { number: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined })
              }}
              className={FIELD}
            />
          </Field>
          <Field label="Label">
            <input
              value={entity.label ?? ''}
              placeholder="e.g. GK"
              onChange={(e) => updateEntity(drill.id, entity.id, { label: e.target.value || undefined })}
              className={FIELD}
            />
          </Field>
          <Swatches
            label="Colour"
            value={entity.color ?? ''}
            onChange={(value) => updateEntity(drill.id, entity.id, { color: value || undefined })}
          />
          <Toggle
            label="Goalkeeper"
            on={entity.goalkeeper === true}
            onToggle={() => updateEntity(drill.id, entity.id, { goalkeeper: !entity.goalkeeper || undefined })}
          />

          <PerKeyframe parked={parked !== null}>
            <Choice
              label="Facing"
              options={FACINGS.map((f) => ({ value: String(f.value), label: f.label }))}
              value={state?.facing !== undefined ? String(state.facing) : ''}
              onChange={(value) => patchState(entity.id, { facing: Number(value) })}
              onClear={state?.facing !== undefined ? () => patchState(entity.id, { facing: undefined }) : undefined}
              clearLabel="From travel"
            />
            <Choice
              label="Body shape"
              options={BODY_SHAPES.map((b) => ({ value: b.value, label: b.label }))}
              value={state?.bodyShape ?? 'auto'}
              onChange={(value) => patchState(entity.id, { bodyShape: value as BodyShape })}
            />
            <div className="space-y-1">
              <p className="text-xs font-medium text-ink-muted">Movement path</p>
              <p className="text-xs text-ink-faint">Draw a custom multi-point run to the next keyframe.</p>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={props.onDrawRoute}
                  disabled={!props.hasFollowingKeyframe}
                  title={
                    props.hasFollowingKeyframe
                      ? 'Tap each point of the run, then tap the last one again to finish'
                      : 'Park the playhead on a keyframe that has another after it'
                  }
                  className={
                    ROW + ' gap-1.5 disabled:opacity-40 disabled:hover:border-line ' +
                    (props.drawingRoute ? ON : OFF)
                  }
                >
                  <Route className="h-3.5 w-3.5" />
                  {props.drawingRoute ? 'Drawing…' : 'Draw route'}
                </button>
                <button
                  type="button"
                  onClick={props.onClearRoute}
                  disabled={!state?.path?.length}
                  className={ROW + ' ' + OFF + ' disabled:opacity-40 disabled:hover:border-line'}
                >
                  Clear
                </button>
              </div>
            </div>
          </PerKeyframe>
        </>
      )}

      {entity.kind === 'equipment' && (
        <>
          <div className="space-y-1">
            <p className="text-xs font-medium text-ink-muted">Type</p>
            <div className="grid grid-cols-2 gap-1">
              {[...EQUIPMENT_CORE, ...EQUIPMENT_ADVANCED].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateEntity(drill.id, entity.id, { equipment: type as EquipmentType })}
                  aria-pressed={(entity.equipment ?? 'cone') === type}
                  className={
                    'flex min-h-11 items-center gap-1.5 rounded-md px-1.5 text-left text-xs transition-colors lg:min-h-9 ' +
                    ((entity.equipment ?? 'cone') === type
                      ? 'bg-accent/15 text-accent'
                      : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
                  }
                >
                  <EquipmentIcon type={type} />
                  <span className="truncate">{EQUIPMENT_LABELS[type]}</span>
                </button>
              ))}
            </div>
          </div>
          <Swatches
            label="Colour"
            value={entity.color ?? ''}
            onChange={(value) => updateEntity(drill.id, entity.id, { color: value || undefined })}
          />
          <Field label={`Rotation — ${Math.round(entity.rotation ?? 0)}°`}>
            <input
              type="range"
              min={0}
              max={350}
              step={10}
              value={entity.rotation ?? 0}
              onChange={(e) => updateEntity(drill.id, entity.id, { rotation: Number(e.target.value) || undefined })}
              className="w-full accent-accent"
            />
          </Field>
          <div className="space-y-1">
            <p className="text-xs font-medium text-ink-muted">Repeat along a line</p>
            <p className="text-xs text-ink-faint">Copies this piece evenly to its right — a cone grid in two taps.</p>
            <div className="flex gap-1.5">
              {[2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => props.onDuplicateAlongLine(entity.id, count)}
                  className={ROW + ' ' + OFF}
                >
                  ×{count}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {entity.kind === 'ball' && <p className="text-xs text-ink-faint">A ball carries nothing beyond its position.</p>}
    </Shell>
  )
}

function MarkingSection({ marking, onPatch }: { marking: Marking; onPatch: (patch: Partial<Omit<Marking, 'id'>>) => void }) {
  const closed = marking.kind === 'zone' || marking.kind === 'rect' || marking.kind === 'circle'
  return (
    <>
      <p className="text-xs text-ink-faint">{marking.kind}</p>
      <Swatches label="Stroke" value={marking.style?.stroke ?? ''} onChange={(value) => onPatch({ style: { ...marking.style, stroke: value || undefined } })} />
      <Toggle
        label="Dashed"
        on={marking.style?.dash === true}
        onToggle={() => onPatch({ style: { ...marking.style, dash: !marking.style?.dash } })}
      />
      <Field label={`Width — ${(marking.style?.width ?? 1).toFixed(1)}×`}>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.5}
          value={marking.style?.width ?? 1}
          onChange={(e) => onPatch({ style: { ...marking.style, width: Number(e.target.value) } })}
          className="w-full accent-accent"
        />
      </Field>
      {closed && (
        <Swatches label="Fill" value={marking.style?.fill ?? ''} onChange={(value) => onPatch({ style: { ...marking.style, fill: value || undefined } })} />
      )}
      {marking.kind === 'text' && (
        <Field label="Text">
          <input value={marking.text ?? ''} onChange={(e) => onPatch({ text: e.target.value })} className={FIELD} />
        </Field>
      )}
    </>
  )
}

// Per-keyframe controls only mean something with a keyframe to write them to.
function PerKeyframe({ parked, children }: { parked: boolean; children: React.ReactNode }) {
  if (!parked) {
    return (
      <p className="border-t border-line pt-3 text-xs text-ink-faint">
        Park the playhead on a keyframe to set facing, body shape or a movement path.
      </p>
    )
  }
  return <div className="space-y-3 border-t border-line pt-3">{children}</div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Choice({
  label,
  options,
  value,
  onChange,
  onClear,
  clearLabel,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  clearLabel?: string
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={ROW + ' ' + (value === option.value ? ON : OFF)}
          >
            {option.label}
          </button>
        ))}
        {onClear && (
          <button type="button" onClick={onClear} className={ROW + ' ' + OFF}>
            {clearLabel ?? 'Clear'}
          </button>
        )}
      </div>
    </div>
  )
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-pressed={on} className={'w-full ' + ROW + ' justify-between ' + (on ? ON : OFF)}>
      {label}
      <span className={'h-2 w-2 rounded-full ' + (on ? 'bg-white' : 'bg-line-strong')} />
    </button>
  )
}

// Named colours rather than a picker: the canvas palette is deliberately
// small (see pitchTheme.ts), and an arbitrary hex would defeat the
// shape-over-palette rule the equipment library is drawn to.
function Swatches({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {COLOUR_CHOICES.map((choice) => (
          <button
            key={choice || 'default'}
            type="button"
            onClick={() => onChange(choice)}
            aria-pressed={value === choice}
            title={choice || 'Default'}
            className={
              'h-9 w-9 rounded-full border-2 transition-colors ' + (value === choice ? 'border-accent' : 'border-line')
            }
            style={choice ? { backgroundColor: EQUIPMENT.named[choice] } : undefined}
          >
            {!choice && <span className="text-xs text-ink-muted">–</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function Shell({
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
