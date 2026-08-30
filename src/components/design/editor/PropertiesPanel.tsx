import {
  ChevronUp,
  Footprints,
  Hash,
  Layers,
  Pause,
  Play,
  Plus,
  Repeat,
  Route,
  SkipBack,
  SkipForward,
  Spline,
  Trash2,
} from 'lucide-react'
import type {
  BodyShape,
  EntityState,
  EquipmentType,
  Marking,
  MarkerStyle,
  PlayerDisplay,
  PlayerRole,
  SceneEntity,
  StatusRing,
} from '../../../store'
import { EQUIPMENT_ADVANCED, EQUIPMENT_CORE, EQUIPMENT_LABELS } from '../../../store'
import { EquipmentIcon } from '../canvas/EquipmentShapes'
import { EQUIPMENT } from '../pitchTheme'
import { stepKeyframe } from '../timeline/cursor'
import type { TimelineHost } from '../timeline/TimelineHost'
import { appendKeyframe } from '../timeline/useKeyframeToggle'
import type { TimelinePlayback } from '../timeline/useTimelinePlayback'

// The right-hand panel (rework plan Stages 5.2 and 6.5): the drill's keyframes
// when nothing is selected, and the selected thing's properties when something
// is.
//
// Which keyframe matters here: a player's team or number belongs to the entity
// and is the same all drill long, while their facing, body shape and drawn
// route belong to the keyframe the playhead is parked on. The panel only
// offers the second group when there is a keyframe to write it to.

interface PropertiesPanelProps {
  // Whichever document is being edited — see TimelineHost, which Stage 7.3
  // grew into the shared contract so this panel could serve both editors
  // rather than being forked into a near-identical tactics copy.
  host: TimelineHost
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
  // Teloframe's per-player "Marker Overrides" — scale, marker style, role tag,
  // highlight and status ring (Stage 7.3). Tactics-only: the fields live on the
  // shared SceneEntity, but a drill has no use for a captain's armband or a
  // booking, and switching them on in a shipped editor is not what this stage
  // was asked to do.
  showMarkerOverrides?: boolean

  // The bottom timeline bar's controls, folded into the Keyframes view
  // instead (2026-08-29, first-phase-studio comparison) — a coach's whole
  // keyframe workflow (add/seek/play/preview toggles) now lives in one place
  // rather than split between this panel and a bar under the pitch. All
  // optional and gated together: a host that doesn't pass `playback` gets the
  // plain read-only keyframe list this panel has always had (which is what
  // the tactics editor still gets — this migration is drill-only for now).
  playback?: TimelinePlayback
  onionSkin?: boolean
  onToggleOnionSkin?: () => void
  playerPaths?: boolean
  onTogglePlayerPaths?: () => void
  ghostTrails?: boolean
  onToggleGhostTrails?: () => void
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

// Marker Overrides (Stage 7.3) — Teloframe's "per-player captain, status and
// style tweaks". All five write to the shared SceneEntity fields Stage 1.1
// added; all five are per TACTIC, not per keyframe, because a captain is a
// captain for the whole board.
const MARKER_STYLES: { value: MarkerStyle; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'shield', label: 'Shield' },
  { value: 'jersey', label: 'Jersey' },
]

const STATUS_RINGS: { value: StatusRing; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'captain', label: 'Captain' },
  { value: 'booked', label: 'Booked' },
  { value: 'injured', label: 'Injured' },
  { value: 'sub', label: 'Sub' },
]

const ROLES: PlayerRole[] = ['GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST']

// 0.6x to 1.6x. Below that a marker stops being readable, above it a player
// covers the space two others need.
const SCALE_MIN = 0.6
const SCALE_MAX = 1.6

export function PropertiesPanel(props: PropertiesPanelProps) {
  const { host, selectedIds, currentTime, onSeek, onRemoveSelection } = props
  const { updateEntity, updateMarking, updateKeyframeState } = host

  const selected = host.scene.entities.filter((entity) => selectedIds.includes(entity.id))
  const selectedMarkings = host.scene.markings.filter((marking) => selectedIds.includes(marking.id))
  const parked = host.keyframes.find((keyframe) => keyframe.id === props.parkedKeyframeId) ?? null

  // Per-keyframe authoring goes through updateKeyframeState, which replaces
  // the whole map — so the patch is merged onto what's already stored rather
  // than written over it.
  const patchState = (entityId: string, patch: Partial<EntityState>) => {
    if (!parked) return
    const current = parked.states[entityId] ?? {}
    updateKeyframeState(parked.id, { ...parked.states, [entityId]: { ...current, ...patch } })
  }

  if (selectedIds.length === 0) {
    const { playback } = props
    return (
      <div className="space-y-3">
        <KeyframeList host={host} playback={playback} currentTime={currentTime} onSeek={onSeek} />
        {playback && (
          <TimelineControls
            host={host}
            playback={playback}
            onionSkin={props.onionSkin}
            onToggleOnionSkin={props.onToggleOnionSkin}
            playerPaths={props.playerPaths}
            onTogglePlayerPaths={props.onTogglePlayerPaths}
            ghostTrails={props.ghostTrails}
            onToggleGhostTrails={props.onToggleGhostTrails}
          />
        )}
      </div>
    )
  }

  if (selected.length === 0 && selectedMarkings.length === 1) {
    return (
      <Shell count={1} noun="marking" onRemove={onRemoveSelection}>
        <MarkingSection
          marking={selectedMarkings[0]}
          onPatch={(patch) => updateMarking(selectedMarkings[0].id, patch)}
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
            onChange={(value) => updateEntity(entity.id, { display: value as PlayerDisplay })}
          />
          <Choice
            label="Team"
            options={[{ value: 'A', label: 'A' }, { value: 'B', label: 'B' }]}
            value={entity.team ?? 'A'}
            onChange={(value) => updateEntity(entity.id, { team: value })}
          />
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Number">
                <input
                  type="number"
                  min={1}
                  value={entity.number ?? ''}
                  onChange={(e) => {
                    const parsed = Number(e.target.value)
                    updateEntity(entity.id, { number: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined })
                  }}
                  className={FIELD}
                />
              </Field>
            </div>
            <button
              type="button"
              onClick={() =>
                updateEntity(entity.id, { display: (entity.display ?? 'standard') === 'dot' ? 'standard' : 'dot' })
              }
              aria-pressed={(entity.display ?? 'standard') !== 'dot'}
              title={(entity.display ?? 'standard') === 'dot' ? 'Show number' : 'Hide number'}
              className={
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors ' +
                ((entity.display ?? 'standard') !== 'dot' ? ON : OFF)
              }
            >
              <Hash className="h-4 w-4" />
            </button>
          </div>
          <Field label="Label">
            <input
              value={entity.label ?? ''}
              placeholder="e.g. GK"
              onChange={(e) => updateEntity(entity.id, { label: e.target.value || undefined })}
              className={FIELD}
            />
          </Field>
          <Swatches
            label="Colour"
            value={entity.color ?? ''}
            onChange={(value) => updateEntity(entity.id, { color: value || undefined })}
          />
          <Toggle
            label="Goalkeeper"
            on={entity.goalkeeper === true}
            onToggle={() => updateEntity(entity.id, { goalkeeper: !entity.goalkeeper || undefined })}
          />

          {props.showMarkerOverrides && (
            <div className="space-y-2 border-t border-line pt-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Marker overrides</p>
                <p className="text-[11px] text-ink-faint">Per-player captain, status and style tweaks.</p>
              </div>

              <Field label={`Scale — ${(entity.scale ?? 1).toFixed(2)}×`}>
                <input
                  type="range"
                  min={SCALE_MIN}
                  max={SCALE_MAX}
                  step={0.05}
                  value={entity.scale ?? 1}
                  onChange={(e) => {
                    const next = Number(e.target.value)
                    // 1.0 is the default, so store nothing rather than a value
                    // that means "unchanged" — same rule the other optional
                    // entity fields follow.
                    updateEntity(entity.id, { scale: next === 1 ? undefined : next })
                  }}
                  className="w-full accent-accent"
                />
              </Field>

              <Choice
                label="Marker style"
                options={MARKER_STYLES.map((m) => ({ value: m.value, label: m.label }))}
                value={entity.markerStyle ?? 'circle'}
                onChange={(value) => updateEntity(entity.id, { markerStyle: value as MarkerStyle })}
              />

              <Choice
                label="Role"
                options={ROLES.map((role) => ({ value: role, label: role }))}
                value={entity.role ?? ''}
                onChange={(value) => updateEntity(entity.id, { role: (value || undefined) as PlayerRole })}
              />

              <Field label="Role tag">
                <input
                  value={entity.roleTag ?? ''}
                  placeholder="e.g. Target man"
                  onChange={(e) => updateEntity(entity.id, { roleTag: e.target.value || null })}
                  className={FIELD}
                />
              </Field>

              <Swatches
                label="Highlight"
                value={entity.highlight ?? ''}
                onChange={(value) => updateEntity(entity.id, { highlight: value || null })}
              />

              <Choice
                label="Status ring"
                options={STATUS_RINGS.map((r) => ({ value: r.value, label: r.label }))}
                value={entity.statusRing ?? 'none'}
                onChange={(value) => updateEntity(entity.id, { statusRing: value as StatusRing })}
              />

              {entity.statusRing && entity.statusRing !== 'none' && (
                <Swatches
                  label="Status colour"
                  value={entity.statusColor ?? ''}
                  onChange={(value) => updateEntity(entity.id, { statusColor: value || null })}
                />
              )}

              <button
                type="button"
                onClick={() =>
                  updateEntity(entity.id, {
                    scale: undefined,
                    markerStyle: undefined,
                    roleTag: null,
                    highlight: null,
                    statusRing: undefined,
                    statusColor: null,
                  })
                }
                className="min-h-11 w-full rounded-md border border-line text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink lg:min-h-9"
              >
                Reset overrides
              </button>
            </div>
          )}

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
                  onClick={() => updateEntity(entity.id, { equipment: type as EquipmentType })}
                  aria-pressed={(entity.equipment ?? 'cone') === type}
                  className={
                    'flex min-h-11 items-center gap-1.5 rounded-md px-1.5 text-left text-xs transition-colors lg:min-h-9 ' +
                    ((entity.equipment ?? 'cone') === type
                      ? 'bg-accent/15 text-accent-ink'
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
            onChange={(value) => updateEntity(entity.id, { color: value || undefined })}
          />
          <Field label={`Rotation — ${Math.round(entity.rotation ?? 0)}°`}>
            <input
              type="range"
              min={0}
              max={350}
              step={10}
              value={entity.rotation ?? 0}
              onChange={(e) => updateEntity(entity.id, { rotation: Number(e.target.value) || undefined })}
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

// The bottom timeline bar's playback/preview controls, relocated here
// (2026-08-29) so the keyframe workflow lives in one column instead of
// being split between this panel and a bar under the pitch. Presentational,
// same as TimelineBar was — every action is a playback call or a callback
// the caller passed in.
export function TimelineControls({
  host,
  playback,
  onionSkin,
  onToggleOnionSkin,
  playerPaths,
  onTogglePlayerPaths,
  ghostTrails,
  onToggleGhostTrails,
}: {
  host: TimelineHost
  playback: TimelinePlayback
  onionSkin?: boolean
  onToggleOnionSkin?: () => void
  playerPaths?: boolean
  onTogglePlayerPaths?: () => void
  ghostTrails?: boolean
  onToggleGhostTrails?: () => void
}) {
  const previous = stepKeyframe(host.keyframes, playback.currentTime, -1)
  const next = stepKeyframe(host.keyframes, playback.currentTime, 1)
  const ICON = 'flex h-9 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted'

  return (
    <div className="space-y-2 border-t border-line pt-3">
      <div className="flex items-center justify-center gap-0.5">
        <button type="button" className={ICON} onClick={() => playback.seek(0)} title="Skip to start" aria-label="Skip to start">
          <SkipBack className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={ICON}
          onClick={() => previous && playback.seek(previous.t)}
          disabled={!previous}
          title="Previous keyframe (,)"
          aria-label="Previous keyframe"
        >
          <ChevronUp className="h-4 w-4 -rotate-90" />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          onClick={playback.togglePlay}
          disabled={host.duration <= 0}
          title={playback.playing ? 'Pause (space)' : 'Play (space)'}
          aria-label={playback.playing ? 'Pause' : 'Play'}
        >
          {playback.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          className={ICON}
          onClick={() => next && playback.seek(next.t)}
          disabled={!next}
          title="Next keyframe (.)"
          aria-label="Next keyframe"
        >
          <ChevronUp className="h-4 w-4 rotate-90" />
        </button>
        <button type="button" className={ICON} onClick={() => playback.seek(host.duration)} title="Skip to end" aria-label="Skip to end">
          <SkipForward className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-1.5">
        <button type="button" onClick={playback.cycleSpeed} className={ROW + ' ' + OFF + ' font-mono'} title="Playback speed">
          {playback.speed}×
        </button>
        <button
          type="button"
          onClick={playback.toggleLoop}
          aria-pressed={playback.loop}
          className={ROW + ' gap-1.5 ' + (playback.loop ? ON : OFF)}
          title="Loop"
        >
          <Repeat className="h-3.5 w-3.5" />
          Loop
        </button>
      </div>

      <button
        type="button"
        onClick={() => onToggleOnionSkin?.()}
        aria-pressed={onionSkin}
        className={'w-full ' + ROW + ' justify-between ' + (onionSkin ? ON : OFF)}
        title="Show the keyframes either side at low opacity"
      >
        <span className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          Onion skin
        </span>
        <span className={'h-2 w-2 rounded-full ' + (onionSkin ? 'bg-white' : 'bg-line-strong')} />
      </button>
      {onTogglePlayerPaths && (
        <button
          type="button"
          onClick={onTogglePlayerPaths}
          aria-pressed={playerPaths}
          className={'w-full ' + ROW + ' justify-between ' + (playerPaths ? ON : OFF)}
          title="Show the route each moving player takes (T)"
        >
          <span className="flex items-center gap-1.5">
            <Spline className="h-3.5 w-3.5" />
            Player paths
          </span>
          <span className={'h-2 w-2 rounded-full ' + (playerPaths ? 'bg-white' : 'bg-line-strong')} />
        </button>
      )}
      {onToggleGhostTrails && (
        <button
          type="button"
          onClick={onToggleGhostTrails}
          aria-pressed={ghostTrails}
          className={'w-full ' + ROW + ' justify-between ' + (ghostTrails ? ON : OFF)}
          title="Trail faded copies behind whatever is moving (G)"
        >
          <span className="flex items-center gap-1.5">
            <Footprints className="h-3.5 w-3.5" />
            Ghost trails
          </span>
          <span className={'h-2 w-2 rounded-full ' + (ghostTrails ? 'bg-white' : 'bg-line-strong')} />
        </button>
      )}
    </div>
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

/**
 * The keyframe strip: one row per keyframe, plus the one-click Add.
 *
 * Extracted from the block above on 2026-08-30 so the tactics editor can show
 * the identical list — its timeline moved off the bottom bar and into its
 * right-hand panel, the same move the drill editor made. Nothing here knows
 * which editor it is in: it reads the `TimelineHost` both already supply.
 * `playback` is what gates Add and Delete, since neither means anything
 * without a playhead to seed from.
 */
export function KeyframeList({
  host,
  playback,
  currentTime,
  onSeek,
}: {
  host: TimelineHost
  playback?: TimelinePlayback
  currentTime: number
  onSeek: (seconds: number) => void
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink-muted">Keyframes</p>
        {playback && (
          <button
            type="button"
            onClick={() => appendKeyframe(host, playback)}
            title="Add the next keyframe, starting from where the last one left off"
            className="flex h-7 items-center gap-1 rounded-md border border-dashed border-line px-2 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>
      {host.keyframes.length === 0 && (
        <p className="text-xs text-ink-faint">No keyframes yet — add one above.</p>
      )}
      <ul className="space-y-1">
        {[...host.keyframes]
          .sort((a, b) => a.t - b.t)
          .map((keyframe, index) => {
            const here = Math.abs(keyframe.t - currentTime) < 0.05
            return (
              <li key={keyframe.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSeek(keyframe.t)}
                  className={
                    'flex min-h-11 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ' +
                    (here ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
                  }
                >
                  <span className="font-mono text-xs tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                  <span className="flex-1 truncate">{keyframe.name ?? 'Keyframe'}</span>
                </button>
                {playback && host.keyframes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => host.deleteKeyframe(keyframe.id)}
                    title="Delete this keyframe"
                    aria-label={`Delete keyframe ${index + 1}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-bad/10 hover:text-bad"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            )
          })}
      </ul>
    </>
  )
}
