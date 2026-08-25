import { useEffect, useState, type FormEvent } from 'react'
import { Camera, Plus, X } from 'lucide-react'
import { useStore } from '../../../store'
import type { Drill, DrillCoaching, DrillUpdateInput } from '../../../store'
import {
  DRILL_DIFFICULTIES,
  DRILL_DIFFICULTY_LABELS,
  DRILL_INTENSITIES,
  DRILL_INTENSITY_LABELS,
  DRILL_PHASES_OF_PLAY,
  DRILL_PHASE_OF_PLAY_LABELS,
  SESSION_BLOCKS,
  SESSION_BLOCK_LABELS,
} from '../../../store'
import { formatDimensions, presetLabel } from '../canvas/pitchPresets'
import { PitchPanel } from './PitchPanel'
import { equipmentSummary } from './equipmentSummary'

// The Drill Details drawer (rework plan Stage 8.2): Basic Info · Pitch ·
// Coaching · Settings. The target app has seven tabs; Variants, Effectiveness
// and Explain are in the plan's "Not planned" list, so this is four.
//
// Every field commits on blur through `updateDrill`, which is a plain column
// patch — metadata isn't canvas content, so it deliberately doesn't go near
// the undo stack or the 800ms autosave debounce that scene edits use. Inputs
// are uncontrolled and keyed on the drill, the same convention EditorTopBar's
// name field uses: the field is a draft until it's committed, and switching
// drills re-mounts it with the new value rather than needing an effect to push
// state back into it.

type Tab = 'basic' | 'pitch' | 'coaching' | 'settings'

const TABS: { id: Tab; label: string }[] = [
  { id: 'basic', label: 'Basic info' },
  { id: 'pitch', label: 'Pitch' },
  { id: 'coaching', label: 'Coaching' },
  { id: 'settings', label: 'Settings' },
]

const FIELD =
  'w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30'
const CHIP = 'min-h-11 rounded-md border px-2 text-xs font-medium transition-colors lg:min-h-8'
const ON = 'border-accent bg-accent text-white'
const OFF = 'border-line text-ink-muted hover:border-line-strong'

interface DrillDetailsDrawerProps {
  drill: Drill
  open: boolean
  onClose: () => void
  // Captures the live Konva stage and uploads it (Stage 8.5). Owned by the
  // editor, since the drawer has no access to the stage.
  onCaptureThumbnail: () => void
  capturing: boolean
}

export function DrillDetailsDrawer({ drill, open, onClose, onCaptureThumbnail, capturing }: DrillDetailsDrawerProps) {
  const updateDrill = useStore((s) => s.updateDrill)
  const setDrillPitch = useStore((s) => s.setDrillPitch)
  const [tab, setTab] = useState<Tab>('basic')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const patch = (next: DrillUpdateInput) => void updateDrill(drill.id, next)
  const coaching = drill.coaching ?? {}
  const patchCoaching = (next: Partial<DrillCoaching>) => patch({ coaching: { ...coaching, ...next } })

  return (
    // Always mounted and transform-animated, the same shape AppShell's mobile
    // drawer and the editor's own tool/props sheets use.
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <button
        type="button"
        aria-label="Close drill details"
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        role="dialog"
        aria-label="Drill details"
        className={
          'absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-panel transition-transform duration-200 ' +
          (open ? 'translate-x-0' : 'translate-x-full')
        }
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <p className="text-sm font-semibold text-ink">Drill details</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drill details"
            className="flex h-11 w-11 items-center justify-center rounded-md text-ink-muted hover:bg-panel-raised"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line px-3 py-2">
          {TABS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTab(option.id)}
              aria-pressed={tab === option.id}
              className={
                'min-h-11 shrink-0 rounded-md px-3 text-sm font-medium transition-colors lg:min-h-9 ' +
                (tab === option.id ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
              }
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'basic' && (
            <div key={drill.id} className="space-y-3">
              <TextField
                id="details-name"
                label="Name"
                defaultValue={drill.name}
                // The one field that can't be blanked — a nameless drill is
                // unfindable in every list that shows it.
                onCommit={(value) => value && patch({ name: value })}
              />
              <TextField
                id="details-objective"
                label="Objective"
                placeholder="e.g. Play out under a high press"
                defaultValue={drill.objective}
                onCommit={(value) => patch({ objective: value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  id="details-duration"
                  label="Duration (min)"
                  defaultValue={drill.duration_minutes}
                  onCommit={(value) => patch({ duration_minutes: value })}
                />
                <NumberField
                  id="details-players"
                  label="Players"
                  defaultValue={drill.players_recommended}
                  onCommit={(value) => patch({ players_recommended: value })}
                />
              </div>
              <TextField
                id="details-category"
                label="Category"
                placeholder="e.g. Rondo"
                defaultValue={drill.category}
                onCommit={(value) => patch({ category: value })}
              />
              <div className="grid grid-cols-2 gap-2">
                <TextField
                  id="details-age-min"
                  label="Age from"
                  placeholder="U8"
                  defaultValue={drill.age_min}
                  onCommit={(value) => patch({ age_min: value })}
                />
                <TextField
                  id="details-age-max"
                  label="Age to"
                  placeholder="U12"
                  defaultValue={drill.age_max}
                  onCommit={(value) => patch({ age_max: value })}
                />
              </div>
              <TextField
                id="details-description"
                label="Description"
                placeholder="What happens, in a sentence or two."
                defaultValue={drill.description}
                rows={3}
                onCommit={(value) => patch({ description: value })}
              />

              <div className="space-y-2 border-t border-line pt-3">
                <p className="text-xs font-medium text-ink-muted">Thumbnail</p>
                {drill.thumbnail_url ? (
                  <img
                    src={drill.thumbnail_url}
                    alt={`${drill.name} board`}
                    className="w-full rounded-md border border-line bg-panel-raised"
                  />
                ) : (
                  <p className="text-xs text-ink-faint">
                    Captured automatically the first time a drill with something on the pitch saves.
                  </p>
                )}
                <button
                  type="button"
                  onClick={onCaptureThumbnail}
                  disabled={capturing}
                  className="flex min-h-11 items-center gap-1.5 rounded-md border border-line px-3 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-50 lg:min-h-9"
                >
                  <Camera className="h-4 w-4" />
                  {capturing ? 'Capturing…' : 'Capture current view'}
                </button>
              </div>
            </div>
          )}

          {tab === 'pitch' && (
            <PitchPanel pitch={drill.pitch} onChange={(next) => setDrillPitch(drill.id, next)} />
          )}

          {tab === 'coaching' && (
            <div key={drill.id} className="space-y-4">
              <TextField
                id="details-setup"
                label="Setup instructions"
                placeholder="How to lay the practice out before the session."
                defaultValue={coaching.setup ?? null}
                rows={3}
                onCommit={(value) => patchCoaching({ setup: value ?? undefined })}
              />
              <ListBuilder
                id="points"
                label="Coaching points"
                placeholder="e.g. First touch across the body"
                items={coaching.points}
                onChange={(items) => patchCoaching({ points: items })}
              />
              <ListBuilder
                id="progressions"
                label="Progressions"
                hint="Make it harder"
                placeholder="e.g. One-touch finish only"
                items={coaching.progressions}
                onChange={(items) => patchCoaching({ progressions: items })}
              />
              <ListBuilder
                id="regressions"
                label="Regressions"
                hint="Make it easier"
                placeholder="e.g. Add a neutral player"
                items={coaching.regressions}
                onChange={(items) => patchCoaching({ regressions: items })}
              />
              <ListBuilder
                id="mistakes"
                label="Common mistakes"
                placeholder="e.g. Support angles too flat"
                items={coaching.mistakes}
                onChange={(items) => patchCoaching({ mistakes: items })}
              />
            </div>
          )}

          {tab === 'settings' && (
            <div key={drill.id} className="space-y-4">
              <ChipChoice
                label="Difficulty"
                options={DRILL_DIFFICULTIES.map((value) => ({ value, label: DRILL_DIFFICULTY_LABELS[value] }))}
                value={drill.difficulty}
                onChange={(value) => patch({ difficulty: value })}
              />
              <ChipChoice
                label="Intensity"
                options={DRILL_INTENSITIES.map((value) => ({ value, label: DRILL_INTENSITY_LABELS[value] }))}
                value={drill.intensity}
                onChange={(value) => patch({ intensity: value })}
              />
              <ChipChoice
                label="Phase of play"
                options={DRILL_PHASES_OF_PLAY.map((value) => ({ value, label: DRILL_PHASE_OF_PLAY_LABELS[value] }))}
                value={drill.phase_of_play}
                onChange={(value) => patch({ phase_of_play: value })}
              />
              <ChipChoice
                label="Session block"
                options={SESSION_BLOCKS.map((value) => ({ value, label: SESSION_BLOCK_LABELS[value] }))}
                value={drill.session_block}
                onChange={(value) => patch({ session_block: value })}
              />

              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  id="details-min-players"
                  label="Min players"
                  defaultValue={drill.min_players}
                  onCommit={(value) => patch({ min_players: value })}
                />
                <NumberField
                  id="details-max-players"
                  label="Max players"
                  defaultValue={drill.max_players}
                  onCommit={(value) => patch({ max_players: value })}
                />
              </div>
              <NumberField
                id="details-setup-minutes"
                label="Setup time (min)"
                defaultValue={drill.setup_minutes}
                onCommit={(value) => patch({ setup_minutes: value })}
              />
              <TextField
                id="details-subcategory"
                label="Subcategory"
                placeholder="e.g. 4v2 positional"
                defaultValue={drill.subcategory}
                onCommit={(value) => patch({ subcategory: value })}
              />
              <TextField
                id="details-outcome"
                label="Learning outcome"
                placeholder="What a player should be able to do afterwards."
                defaultValue={drill.learning_outcome}
                rows={2}
                onCommit={(value) => patch({ learning_outcome: value })}
              />
              <TextField
                id="details-video"
                label="Video demo URL"
                placeholder="https://…"
                defaultValue={drill.video_url}
                onCommit={(value) => patch({ video_url: value })}
              />

              <Derived drill={drill} coaching={coaching} onOverride={(value) => patchCoaching({ equipment: value })} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// The two things Details never asks a coach to type, because it already knows
// them: what's on the board (Stage 8.3) and how big the pitch is (Stage 8.4).
function Derived({
  drill,
  coaching,
  onOverride,
}: {
  drill: Drill
  coaching: DrillCoaching
  onOverride: (value: string | undefined) => void
}) {
  const derived = equipmentSummary(drill.scene)
  const overridden = coaching.equipment !== undefined

  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="space-y-1">
        <p className="text-xs font-medium text-ink-muted">Field size</p>
        <p className="text-sm text-ink">
          {presetLabel(drill.pitch.preset)} ·{' '}
          {formatDimensions(drill.pitch.lengthMeters, drill.pitch.widthMeters, drill.pitch.units ?? 'm')}
        </p>
        <p className="text-xs text-ink-faint">Follows the pitch — change it on the Pitch tab.</p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-ink-muted">Equipment</p>
        {overridden ? (
          <textarea
            key={`${drill.id}-equipment-override`}
            aria-label="Equipment override"
            defaultValue={coaching.equipment}
            rows={2}
            onBlur={(e) => onOverride(e.currentTarget.value.trim())}
            className={FIELD}
          />
        ) : (
          <p className="text-sm text-ink">{derived || 'Nothing on the board yet.'}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-ink-faint">
            {overridden ? `On the board: ${derived || 'nothing'}.` : 'Counted from what is on the board.'}
          </p>
          <button
            type="button"
            onClick={() => onOverride(overridden ? undefined : derived)}
            className="shrink-0 text-xs font-medium text-accent hover:underline"
          >
            {overridden ? 'Use the board' : 'Override'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Add/remove list, modelled on PlayerNotes.tsx's form — an input, a submit
// that clears it, and one row per entry. Unlike notes these are editable in
// the sense that they can be removed; nothing here is a permanent record.
function ListBuilder({
  id,
  label,
  hint,
  placeholder,
  items,
  onChange,
}: {
  id: string
  label: string
  hint?: string
  placeholder: string
  items: string[] | undefined
  onChange: (items: string[]) => void
}) {
  const [draft, setDraft] = useState('')
  const list = items ?? []

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const value = draft.trim()
    if (!value) return
    onChange([...list, value])
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-ink-muted">
        {label}
        {hint && <span className="ml-1.5 font-normal text-ink-faint">{hint}</span>}
      </p>
      {list.length > 0 && (
        <ul className="space-y-1">
          {list.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="flex items-start gap-2 rounded-md border border-line px-2 py-1.5"
            >
              <span className="flex-1 whitespace-pre-wrap text-sm text-ink">{item}</span>
              <button
                type="button"
                onClick={() => onChange(list.filter((_, i) => i !== index))}
                aria-label={`Remove "${item}"`}
                className="shrink-0 text-ink-faint transition-colors hover:text-bad"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <label htmlFor={`details-${id}`} className="sr-only">
          Add to {label.toLowerCase()}
        </label>
        <input
          id={`details-${id}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className={FIELD}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label={`Add to ${label.toLowerCase()}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-40 lg:h-9 lg:w-9"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </div>
  )
}

// Clicking the selected chip again clears the field — every one of these is
// optional, and a coach who picked "High" by mistake needs a way back to
// "not recorded" that isn't a second control taking up a row.
function ChipChoice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | null
  onChange: (value: T | null) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const on = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(on ? null : option.value)}
              aria-pressed={on}
              className={CHIP + ' ' + (on ? ON : OFF)}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function TextField({
  id,
  label,
  placeholder,
  defaultValue,
  rows,
  onCommit,
}: {
  id: string
  label: string
  placeholder?: string
  defaultValue: string | null
  rows?: number
  onCommit: (value: string | null) => void
}) {
  // An emptied field commits null, not '' — "not recorded" is a different
  // thing from "recorded as nothing", which is why every metadata column is
  // nullable (migration 016).
  const commit = (raw: string) => {
    const trimmed = raw.trim()
    if (trimmed === (defaultValue ?? '')) return
    onCommit(trimmed || null)
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted">
        {label}
      </label>
      {rows ? (
        <textarea
          id={id}
          rows={rows}
          defaultValue={defaultValue ?? ''}
          placeholder={placeholder}
          onBlur={(e) => commit(e.currentTarget.value)}
          className={FIELD}
        />
      ) : (
        <input
          id={id}
          type="text"
          defaultValue={defaultValue ?? ''}
          placeholder={placeholder}
          onBlur={(e) => commit(e.currentTarget.value)}
          className={FIELD}
        />
      )}
    </div>
  )
}

function NumberField({
  id,
  label,
  defaultValue,
  onCommit,
}: {
  id: string
  label: string
  defaultValue: number | null
  onCommit: (value: number | null) => void
}) {
  const commit = (raw: string) => {
    const trimmed = raw.trim()
    const next = trimmed === '' ? null : Math.max(0, Math.round(Number(trimmed)))
    if (next !== null && !Number.isFinite(next)) return
    if (next === defaultValue) return
    onCommit(next)
  }

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={0}
        defaultValue={defaultValue ?? ''}
        onBlur={(e) => commit(e.currentTarget.value)}
        className={FIELD + ' tabular-nums'}
      />
    </div>
  )
}
