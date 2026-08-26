import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store'
import type { Drill, SessionWithRelations, Tactic } from '../store'
import { SESSION_BLOCK_LABELS } from '../store'
import { formatDimensions, presetLabel } from './design/canvas/pitchPresets'
import { formatClock } from './design/timeline/cursor'
import { FORMATIONS } from './tactics/formations'
import { NumberChip } from './ui/NumberChip'
import { Badge } from './ui/Badge'
import { Dropdown } from './ui/Dropdown'

// The session line-up (TACTICS_BOARD_REWORK_PLAN.md Stage 9.4). Was
// `SessionDrillsPanel`; it now holds drills AND tactics in ONE ordered list,
// which is the plan's explicit instruction and its reasoning: "a session block
// is a sequence of things you do, and splitting the UI by storage table would
// be an implementation detail leaking into the coach's workflow."
//
// Still the same expandable-panel-inside-a-SessionRow pattern AvailabilityPanel
// established, mounted from SessionPlanner.
//
// ── How this stays clean rather than turning into a tangle ────────────────
// The plan's own execution note suggests "a small discriminated-union row
// type before touching the component", and that is exactly what carries the
// weight. Both join tables are normalised into `SessionItem` ONCE, at the top
// of the panel. Everything downstream — sorting, numbering, reordering, the
// row component, the totals — reads `SessionItem` and never asks which table
// a row came from. The only places that branch on `kind` are the three
// dispatch helpers below (`saveItem`, `removeItem`, and the row's
// loading/error selector) and the attach form's submit. Four branches in the
// whole file, all of them one line.
//
// ── One order_index sequence, shared across two tables ────────────────────
// `session_drills` and `session_tactics` each have their own `order_index`
// column, but the coach sees one list, so the two are treated as ONE
// contiguous sequence: a new attachment lands at `items.length`, reordering
// swaps indices between adjacent items regardless of type, and a detach
// RENUMBERS what's left.
//
// The renumber is not tidiness. Without it, removing the middle of 0,1,2
// leaves 0,2 — and the next attach, landing at `items.length` = 2, collides
// with the existing 2 and the merge order becomes ambiguous. Keeping the
// sequence gapless is what makes "position in the list" a well-defined thing
// across two tables. It is also what Stage 9's Verify step checks.

interface AttachmentFormValues {
  planned_duration_minutes: number | null
  notes: string | null
}

type SessionItemKind = 'drill' | 'tactic'

/**
 * One row of the line-up, with the storage table normalised away.
 *
 * `id` is the JOIN row's id (`session_drills.id` / `session_tactics.id`), not
 * the drill's or tactic's — every action in this panel is per-attachment and
 * must never touch the underlying document.
 */
interface SessionItem {
  kind: SessionItemKind
  id: string
  orderIndex: number
  plannedMinutes: number | null
  notes: string | null
  /** The document's name, or a fallback when it isn't in the store. */
  title: string
  /** The document's OWN recorded fit — not this attachment's planned minutes. */
  badges: string[]
  /** Deep link to open the document, or null when it couldn't be resolved. */
  href: string | null
}

const KIND_LABEL: Record<SessionItemKind, string> = { drill: 'Drill', tactic: 'Tactic' }

// The preset's name plus its real dimensions — more use to a coach picking a
// drill for a session than "half pitch · portrait" was (drill rework 7.6).
function pitchLabel(drill: Drill): string {
  const { pitch } = drill
  return `${presetLabel(pitch.preset)} · ${formatDimensions(pitch.lengthMeters, pitch.widthMeters, pitch.units ?? 'm')}`
}

// A drill's own recorded duration and session-block fit are more use when
// slotting it into a session than the pitch format is — falls back to
// `pitchLabel` for the drills that predate that metadata, so the picker never
// goes from informative to blank (drill rework 9.4).
function drillPickerLabel(drill: Drill): string {
  const parts = [
    drill.duration_minutes != null ? `${drill.duration_minutes} min` : null,
    drill.session_block ? SESSION_BLOCK_LABELS[drill.session_block] : null,
  ].filter((part): part is string => part != null)
  return `${drill.name} (${parts.length > 0 ? parts.join(' · ') : pitchLabel(drill)})`
}

function formationLabel(key: string): string {
  return FORMATIONS.find((f) => f.key === key)?.label ?? key
}

// The tactic equivalent: the shape pair is what a coach identifies a tactic
// by, and the clock is the only duration a tactic has (it carries no
// `duration_minutes` — light metadata by design, decided 2026-08-26).
function tacticPickerLabel(tactic: Tactic): string {
  const shape = `${formationLabel(tactic.sides.home.formation)} v ${formationLabel(tactic.sides.away.formation)}`
  return `${tactic.name} (${shape})`
}

export function SessionItemsPanel({ session }: { session: SessionWithRelations }) {
  const drills = useStore((s) => s.drills)
  const tactics = useStore((s) => s.tactics)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const fetchTactics = useStore((s) => s.fetchTactics)

  const attachDrillToSession = useStore((s) => s.attachDrillToSession)
  const updateSessionDrill = useStore((s) => s.updateSessionDrill)
  const detachDrillFromSession = useStore((s) => s.detachDrillFromSession)
  const attachTacticToSession = useStore((s) => s.attachTacticToSession)
  const updateSessionTactic = useStore((s) => s.updateSessionTactic)
  const detachTacticFromSession = useStore((s) => s.detachTacticFromSession)

  const attachLoading = useStore(
    (s) => (s.sessionDrillAttachLoading[session.id] ?? false) || (s.sessionTacticAttachLoading[session.id] ?? false)
  )
  const attachError = useStore(
    (s) => s.sessionDrillAttachError[session.id] ?? s.sessionTacticAttachError[session.id] ?? null
  )

  // Scoped by the SESSION's team_id, not the currently-selected team — the
  // reasoning AvailabilityPanel documents for its roster lookup. `fetchDrills`
  // already applies the "this team OR nobody's team" filter, so coach-owned
  // drills show up regardless of which team is selected elsewhere; a tactic is
  // always team-scoped and has no such case.
  useEffect(() => {
    fetchDrills(session.team_id)
    void fetchTactics(session.team_id)
  }, [session.team_id, fetchDrills, fetchTactics])

  const drillsById = useMemo(() => new Map(drills.map((d) => [d.id, d])), [drills])
  const tacticsById = useMemo(() => new Map(tactics.map((t) => [t.id, t])), [tactics])

  // The one normalisation. Both tables in, one ordered list out.
  const items = useMemo<SessionItem[]>(() => {
    const fromDrills = session.session_drills.map((row): SessionItem => {
      const drill = drillsById.get(row.drill_id)
      return {
        kind: 'drill',
        id: row.id,
        orderIndex: row.order_index,
        plannedMinutes: row.planned_duration_minutes,
        notes: row.notes,
        title: drill ? `${drill.name} (${pitchLabel(drill)})` : 'Unknown drill',
        badges: [
          drill?.duration_minutes != null ? `${drill.duration_minutes} min` : null,
          drill?.session_block ? SESSION_BLOCK_LABELS[drill.session_block] : null,
        ].filter((b): b is string => b != null),
        href: drill ? `/design/${drill.id}` : null,
      }
    })

    const fromTactics = session.session_tactics.map((row): SessionItem => {
      const tactic = tacticsById.get(row.tactic_id)
      return {
        kind: 'tactic',
        id: row.id,
        orderIndex: row.order_index,
        plannedMinutes: row.planned_duration_minutes,
        notes: row.notes,
        title: tactic
          ? `${tactic.name} (${formationLabel(tactic.sides.home.formation)} v ${formationLabel(tactic.sides.away.formation)})`
          : 'Unknown tactic',
        badges: [
          tactic ? formatClock(tactic.duration_seconds) : null,
          tactic && tactic.phases.length > 0
            ? `${tactic.phases.length} phase${tactic.phases.length === 1 ? '' : 's'}`
            : null,
        ].filter((b): b is string => b != null),
        href: tactic ? `/tactics/${tactic.id}` : null,
      }
    })

    // Ties break drill-before-tactic. They shouldn't happen — the sequence is
    // kept gapless precisely so they can't — but a stable, stated rule beats
    // an order that depends on array identity if one ever slips through.
    return [...fromDrills, ...fromTactics].sort(
      (a, b) => a.orderIndex - b.orderIndex || a.kind.localeCompare(b.kind)
    )
  }, [session.session_drills, session.session_tactics, drillsById, tacticsById])

  const [addKind, setAddKind] = useState<SessionItemKind>('drill')
  const [selectedId, setSelectedId] = useState('')
  const [plannedDuration, setPlannedDuration] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── The dispatch helpers. Every `kind` branch in this file is here. ──────
  const saveItem = (item: SessionItem, patch: AttachmentFormValues & { order_index?: number }) =>
    item.kind === 'drill' ? updateSessionDrill(item.id, patch) : updateSessionTactic(item.id, patch)

  const reindex = (item: SessionItem, orderIndex: number) =>
    item.kind === 'drill'
      ? updateSessionDrill(item.id, { order_index: orderIndex })
      : updateSessionTactic(item.id, { order_index: orderIndex })

  const removeItem = (item: SessionItem) =>
    item.kind === 'drill' ? detachDrillFromSession(item.id) : detachTacticFromSession(item.id)

  // Picking a document suggests its own recorded duration as a starting point
  // for "how long will this take in THIS session" — a prefill only, so a coach
  // who knows this run will go long can type over it. A tactic has no recorded
  // minutes, so only drills prefill.
  const handleSelect = (id: string) => {
    setSelectedId(id)
    if (addKind !== 'drill' || plannedDuration) return
    const suggested = drillsById.get(id)?.duration_minutes
    if (suggested != null) setPlannedDuration(String(suggested))
  }

  const handleAttach = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedId || submitting) return
    setSubmitting(true)
    const shared = {
      session_id: session.id,
      // The end of the shared sequence. Gapless, so this can never collide.
      order_index: items.length,
      planned_duration_minutes: plannedDuration ? Number(plannedDuration) : null,
      notes: notes.trim() || null,
    }
    const attached =
      addKind === 'drill'
        ? await attachDrillToSession({ ...shared, drill_id: selectedId })
        : await attachTacticToSession({ ...shared, tactic_id: selectedId })
    setSubmitting(false)
    if (attached) {
      setSelectedId('')
      setPlannedDuration('')
      setNotes('')
    }
  }

  // Swaps order_index with the adjacent row in the given direction — two
  // per-attachment updates, possibly against two different tables, so
  // reordering works across types exactly as it does within one.
  const handleReorder = async (index: number, direction: -1 | 1) => {
    const current = items[index]
    const other = items[index + direction]
    if (!current || !other) return
    await Promise.all([reindex(current, other.orderIndex), reindex(other, current.orderIndex)])
  }

  // Detach, then close the gap it left. See the header: a hole in the shared
  // sequence lets the next attach collide with an existing index.
  const handleRemove = async (item: SessionItem) => {
    const removed = await removeItem(item)
    if (!removed) return
    const remaining = items.filter((i) => i.id !== item.id)
    await Promise.all(
      remaining.map((row, index) => (row.orderIndex === index ? null : reindex(row, index))).filter(Boolean)
    )
  }

  const options =
    addKind === 'drill'
      ? drills.map((d) => ({ value: d.id, label: drillPickerLabel(d) }))
      : tactics.map((t) => ({ value: t.id, label: tacticPickerLabel(t) }))

  const placeholder =
    addKind === 'drill'
      ? drills.length === 0
        ? 'No drills yet — build one in Design'
        : 'Select a drill…'
      : tactics.length === 0
        ? 'No tactics yet — build one in Tactics'
        : 'Select a tactic…'

  return (
    <div className="mt-3 border-t border-line pt-3">
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing in this session yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <SessionItemRow
              key={`${item.kind}-${item.id}`}
              item={item}
              position={index + 1}
              isFirst={index === 0}
              isLast={index === items.length - 1}
              onMove={(direction) => handleReorder(index, direction)}
              onSave={(patch) => saveItem(item, patch)}
              onRemove={() => handleRemove(item)}
            />
          ))}
        </ul>
      )}

      <form onSubmit={handleAttach} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
        {/* The add-flow offers both libraries (9.4). A segmented toggle rather
            than two separate forms: which library you are picking from is one
            property of one action, not two actions. */}
        <div>
          <span className="block text-xs font-medium text-ink-muted">Add</span>
          <div className="mt-1 flex gap-1 rounded-md bg-panel-raised p-1">
            {(['drill', 'tactic'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={addKind === kind}
                onClick={() => {
                  setAddKind(kind)
                  setSelectedId('')
                }}
                className={
                  'min-h-9 rounded-md px-2.5 text-xs font-medium transition-colors ' +
                  (addKind === kind ? 'bg-accent text-white' : 'text-ink-muted hover:bg-panel hover:text-ink')
                }
              >
                {KIND_LABEL[kind]}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-40 flex-1">
          <label className="block text-xs font-medium text-ink-muted">{KIND_LABEL[addKind]}</label>
          <div className="mt-1">
            <Dropdown
              value={selectedId}
              onChange={handleSelect}
              options={options}
              placeholder={placeholder}
              ariaLabel={KIND_LABEL[addKind]}
              triggerClassName="w-full"
            />
          </div>
        </div>
        <div className="w-28">
          <label className="block text-xs font-medium text-ink-muted">Minutes</label>
          <input
            type="number"
            min={1}
            value={plannedDuration}
            onChange={(e) => setPlannedDuration(e.target.value)}
            placeholder="optional"
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="min-w-32 flex-1">
          <label className="block text-xs font-medium text-ink-muted">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. focus on first touch"
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <button
          type="submit"
          disabled={!selectedId || submitting || attachLoading}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting || attachLoading ? 'Attaching…' : `Attach ${addKind}`}
        </button>
      </form>
      {attachError && <p className="mt-1 text-sm text-bad">{attachError}</p>}
    </div>
  )
}

function SessionItemRow({
  item,
  position,
  isFirst,
  isLast,
  onMove,
  onSave,
  onRemove,
}: {
  item: SessionItem
  position: number
  isFirst: boolean
  isLast: boolean
  onMove: (direction: -1 | 1) => void
  onSave: (patch: AttachmentFormValues) => Promise<unknown>
  onRemove: () => Promise<void>
}) {
  // One hook, branching inside the selector — the two slices keep their own
  // keyed records, and which one this row reads is a property of the row.
  const rowLoading = useStore((s) =>
    item.kind === 'drill' ? (s.sessionDrillRowLoading[item.id] ?? false) : (s.sessionTacticRowLoading[item.id] ?? false)
  )
  const rowError = useStore((s) =>
    item.kind === 'drill' ? (s.sessionDrillRowError[item.id] ?? null) : (s.sessionTacticRowError[item.id] ?? null)
  )

  const [plannedDuration, setPlannedDuration] = useState(
    item.plannedMinutes != null ? String(item.plannedMinutes) : ''
  )
  const [notes, setNotes] = useState(item.notes ?? '')
  const [dirty, setDirty] = useState(false)
  const [removing, setRemoving] = useState(false)

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || rowLoading) return
    const saved = await onSave({
      planned_duration_minutes: plannedDuration ? Number(plannedDuration) : null,
      notes: notes.trim() || null,
    })
    if (saved) setDirty(false)
  }

  const handleRemove = async () => {
    setRemoving(true)
    await onRemove()
    setRemoving(false)
  }

  return (
    <li className="rounded-md border border-line px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <NumberChip index={position} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* The type badge the plan asks for on each row — with two kinds
                  in one list, "which of these is the tactic" has to be
                  answerable at a glance. `neutral` for both: Badge's tones are
                  ok/warn/bad/neutral, a status vocabulary, and neither a drill
                  nor a tactic is a status. The words differ, which is what the
                  badge is for; widening a shared component to tint one row of
                  one panel would be the wrong trade. */}
              <Badge tone="neutral">{KIND_LABEL[item.kind]}</Badge>
              {item.href ? (
                <Link to={item.href} className="text-sm font-medium text-ink hover:text-accent hover:underline">
                  {item.title}
                </Link>
              ) : (
                <p className="text-sm font-medium text-ink">{item.title}</p>
              )}
            </div>
            {/* The document's own recorded fit, not this attachment's planned
                minutes below — a quick "does this belong in this block" check
                while a session is still being built. */}
            {item.badges.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {item.badges.map((badge) => (
                  <Badge key={badge} tone="neutral">
                    {badge}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={isFirst}
            aria-label="Move up"
            className="rounded-md border border-line px-1.5 py-0.5 text-xs text-ink-muted disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={isLast}
            aria-label="Move down"
            className="rounded-md border border-line px-1.5 py-0.5 text-xs text-ink-muted disabled:opacity-30"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={removing}
            className="text-xs text-bad underline underline-offset-2 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
      <form onSubmit={handleSave} className="mt-2 flex flex-wrap items-end gap-2">
        <div className="w-24">
          <label className="block text-xs font-medium text-ink-muted">Minutes</label>
          <input
            type="number"
            min={1}
            value={plannedDuration}
            onChange={(e) => {
              setPlannedDuration(e.target.value)
              setDirty(true)
            }}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="min-w-32 flex-1">
          <label className="block text-xs font-medium text-ink-muted">Notes</label>
          <input
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value)
              setDirty(true)
            }}
            className="mt-1 w-full rounded-md border border-line bg-panel-raised px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <button
          type="submit"
          disabled={!dirty || rowLoading}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {rowLoading ? 'Saving…' : 'Save'}
        </button>
      </form>
      {rowError && <p className="mt-1 text-sm text-bad">{rowError}</p>}
    </li>
  )
}
