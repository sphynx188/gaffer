import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../../store'
import type { Player, PlayerRole, SceneEntity, Tactic } from '../../store'
import { PLAYER_POSITION_LABELS } from '../../store'
import { Dropdown } from '../ui/Dropdown'
import { Skeleton } from '../ui/Skeleton'
import { FormationPicker } from './FormationPicker'
import { nextFreeSlot, resolveFormation, type FormationSlot } from './formations'

// The squad panel (TACTICS_BOARD_REWORK_PLAN.md Stage 4): Home / Away tabs,
// and per side a team colour, a formation picker, a team selector and the
// squad list. Stage 7 mounts this in the editor shell — it owns the shell and
// is what finally deletes TacticBoard.tsx — so this takes a tactic and a
// keyframe id rather than reading a route.
//
// ── The two sides are not symmetrical ────────────────────────────────────
// HOME is the coach's own squad: the `players` array, which playerSlice keeps
// scoped to `selectedTeamId`. Rows bind to entities by
// `SceneEntity.player_id`. AWAY is a placeholder side by default, and can be
// bound to another team the coach actually coaches (4.3) — useful for prepping
// against a side they know. A bound away side behaves exactly like home; an
// unbound one lists placeholder entities the tactic invented.
//
// ── What a row's "edit" and "delete" do, and don't ───────────────────────
// A roster-bound row IS a real `player` row, shared with the roster,
// attendance and session screens. Editing or deleting one from here would
// reach outside this feature and change data those screens own, so it doesn't:
//   * EDIT changes the per-tactic ROLE (4.4 — "role is a per-tactic
//     assignment"), which is the only thing about a bound player this tactic
//     actually owns. Names and squad numbers stay the roster's business.
//   * DELETE appears only on away-side placeholders, which this tactic
//     invented and can therefore destroy. For a roster row, toggling off IS
//     the removal — and 4.2 is explicit that toggling off must not delete the
//     entity, or the player wouldn't return to the same place.

// Same shared-grid rule PlayerRoster.tsx follows: one `grid-template-columns`
// on the header and on every row, so the two can never drift out of alignment
// the way flex children silently do (design.md). Narrower than the roster's,
// because this lives in a side panel rather than a full-width page.
const ROW_GRID = 'sm:grid sm:grid-cols-[2rem_1fr_4.5rem_auto] sm:items-center sm:gap-x-3'

const SKELETON_ROWS = [0, 1, 2, 3]

// A small, fixed palette rather than a full colour picker. Two sides only ever
// need to be told apart, and the visual-style discussion settled on "team
// distinction is a 2-colour pair, never a big palette" (pitchTheme.ts).
const TEAM_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#a855f7', '#ec4899', '#64748b']

const ROLES: PlayerRole[] = ['GK', 'RB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST']

// One row of the list, whether it is backed by a roster player or a
// placeholder. `player` is absent for placeholders; `entity` is absent for a
// roster player who has never been placed on this board.
interface SquadRow {
  key: string
  player: Player | null
  entity: SceneEntity | null
  onPitch: boolean
  label: string
  squadNumber: number | null
  positionLabel: string
}

export function SquadPanel({ tactic, keyframeId }: { tactic: Tactic; keyframeId: string }) {
  const [side, setSide] = useState<'home' | 'away'>('home')

  const teams = useStore((s) => s.teams)
  const players = useStore((s) => s.players)
  const playersLoading = useStore((s) => s.playersLoading)
  const rostersByTeam = useStore((s) => s.rostersByTeam)
  const rostersByTeamLoading = useStore((s) => s.rostersByTeamLoading)
  const rostersByTeamError = useStore((s) => s.rostersByTeamError)
  const fetchTeamRoster = useStore((s) => s.fetchTeamRoster)
  const customFormations = useStore((s) => s.customFormations)

  const addTacticEntity = useStore((s) => s.addTacticEntity)
  const removeTacticEntity = useStore((s) => s.removeTacticEntity)
  const updateTacticEntity = useStore((s) => s.updateTacticEntity)
  const setTacticEntityHidden = useStore((s) => s.setTacticEntityHidden)
  const setTacticSide = useStore((s) => s.setTacticSide)
  const applyTacticFormation = useStore((s) => s.applyTacticFormation)
  const createCustomFormation = useStore((s) => s.createCustomFormation)

  const config = tactic.sides[side]
  // Home is always the coach's selected team; away is whichever team it is
  // bound to, or nothing at all when it is a placeholder side.
  const awayTeamId = tactic.sides.away.teamId

  // The away side's roster comes from the keyed cache so it can never overwrite
  // `players`, which is the selected team's roster (see playerSlice).
  useEffect(() => {
    if (side === 'away' && awayTeamId) void fetchTeamRoster(awayTeamId)
  }, [side, awayTeamId, fetchTeamRoster])

  const roster: Player[] =
    side === 'home' ? players : awayTeamId ? (rostersByTeam[awayTeamId] ?? []) : []
  const rosterLoading =
    side === 'home' ? playersLoading : !!awayTeamId && !!rostersByTeamLoading[awayTeamId]
  const rosterError = side === 'away' && awayTeamId ? rostersByTeamError[awayTeamId] : null

  const keyframe = tactic.keyframes.find((k) => k.id === keyframeId)
  const sideEntities = tactic.scene.entities.filter((e) => e.kind === 'player' && e.team === side)
  const isOnPitch = (entity: SceneEntity) => !keyframe?.states[entity.id]?.hidden

  const formation = resolveFormation(config.formation, customFormations)
  const slots: FormationSlot[] = formation?.slots ?? []

  // Roster rows first (in roster order), then any placeholder entities this
  // tactic invented that no roster row accounts for.
  const boundEntityFor = (playerId: string) => sideEntities.find((e) => e.player_id === playerId) ?? null
  const rows: SquadRow[] = [
    ...roster.map((player) => {
      const entity = boundEntityFor(player.id)
      return {
        key: `player:${player.id}`,
        player,
        entity,
        onPitch: !!entity && isOnPitch(entity),
        label: player.name,
        squadNumber: player.squad_number,
        positionLabel: player.positions.map((p) => PLAYER_POSITION_LABELS[p]).join(', ') || '—',
      }
    }),
    ...sideEntities
      .filter((e) => !e.player_id)
      .map((entity) => ({
        key: `entity:${entity.id}`,
        player: null,
        entity,
        onPitch: isOnPitch(entity),
        label: entity.label ?? `Player ${entity.number ?? ''}`.trim(),
        squadNumber: entity.number ?? null,
        positionLabel: 'Placeholder',
      })),
  ]

  const onPitchCount = sideEntities.filter(isOnPitch).length

  // Toggling a row on has two quite different meanings, which is why 4.2 and
  // this stage's verify step read as though they contradict each other:
  //   * an entity that exists and is hidden -> un-hide it, and it comes back
  //     to the exact position it was standing in;
  //   * a roster player with no entity at all -> create one, at the first free
  //     slot in the current formation.
  const togglePitch = (row: SquadRow) => {
    if (row.entity) {
      setTacticEntityHidden(tactic.id, keyframeId, row.entity.id, row.onPitch)
      return
    }
    if (!row.player || !keyframe) return
    const free = nextFreeSlot(
      slots,
      keyframe.states,
      sideEntities.filter(isOnPitch).map((e) => e.id)
    )
    // Every slot taken means the coach already has a full shape out; drop the
    // extra player in the middle rather than stacking them on someone.
    const position = free ? { x: free.x, y: free.y } : { x: 0.5, y: 0.5 }
    addTacticEntity(tactic.id, 'player', position, {
      team: side,
      player_id: row.player.id,
      ...(free ? { role: free.role } : {}),
      ...(row.player.squad_number !== null ? { number: row.player.squad_number } : {}),
    })
  }

  const addPlaceholder = () => {
    if (!keyframe) return
    const free = nextFreeSlot(
      slots,
      keyframe.states,
      sideEntities.filter(isOnPitch).map((e) => e.id)
    )
    const position = free ? { x: free.x, y: free.y } : { x: 0.5, y: 0.5 }
    addTacticEntity(tactic.id, 'player', position, {
      team: side,
      label: `Player ${sideEntities.length + 1}`,
      ...(free ? { role: free.role } : {}),
    })
  }

  const teamOptions = teams
    // A tactic's own team is the home side; offering it as the opposition
    // would let a coach set their team up against itself.
    .filter((team) => team.id !== tactic.team_id)
    .map((team) => ({ value: team.id, label: team.name }))

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Squad side" className="flex gap-1">
        {(['home', 'away'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={side === option}
            onClick={() => setSide(option)}
            className={
              'min-h-11 flex-1 rounded-md border px-3 text-sm font-medium transition-colors lg:min-h-9 ' +
              (side === option
                ? 'border-accent bg-accent text-white'
                : 'border-line text-ink-muted hover:border-line-strong hover:text-ink')
            }
          >
            {option === 'home' ? 'Home team' : 'Away team'}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Team colour</p>
        <div className="flex flex-wrap gap-1.5">
          {TEAM_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Set ${side} team colour`}
              aria-pressed={config.color === color}
              onClick={() => setTacticSide(tactic.id, side, { color })}
              style={{ backgroundColor: color }}
              className={
                'h-7 w-7 rounded-full border-2 transition-colors ' +
                (config.color === color ? 'border-ink' : 'border-transparent hover:border-line-strong')
              }
            />
          ))}
        </div>
      </div>

      <FormationPicker
        side={side}
        formationKey={config.formation}
        onChange={(key, nextSlots) => applyTacticFormation(tactic.id, side, key, nextSlots, keyframeId)}
        onSaveCurrentShape={
          onPitchCount > 0
            ? (name) => {
                const shape = sideEntities
                  .filter(isOnPitch)
                  .map((e) => ({
                    role: e.role ?? 'CM',
                    x: keyframe?.states[e.id]?.x ?? 0.5,
                    y: keyframe?.states[e.id]?.y ?? 0.5,
                  }))
                void createCustomFormation({ name, slots: shape })
              }
            : undefined
        }
      />

      {side === 'away' && (
        <div>
          <label htmlFor="away-team" className="block text-xs font-medium uppercase tracking-wide text-ink-muted">
            Opposition
          </label>
          <div className="mt-1">
            <Dropdown
              id="away-team"
              value={awayTeamId ?? ''}
              onChange={(value) => setTacticSide(tactic.id, 'away', { teamId: value || null })}
              options={[{ value: '', label: 'Placeholder side' }, ...teamOptions]}
              ariaLabel="Opposition team"
              placeholder="Placeholder side"
              emptyMessage="No other teams"
            />
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            Bind the opposition to a team you coach, or leave it as unnamed placeholders.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            Squad ({rows.length})
          </p>
          <p className="text-xs tabular-nums text-ink-faint">{onPitchCount} on pitch</p>
        </div>

        {rosterError && <p className="text-sm text-bad">{rosterError}</p>}

        {rosterLoading && (
          <ul className="space-y-2" aria-busy="true">
            {SKELETON_ROWS.map((row) => (
              <li key={row} className="rounded-md border border-line px-2 py-2">
                <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${ROW_GRID}`}>
                  <Skeleton className="h-4 w-6" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-6 w-14 sm:ml-auto" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {!rosterLoading && rows.length === 0 && (
          <p className="text-sm text-ink-muted">
            {side === 'home'
              ? 'No players on this team yet — add them on the Roster page.'
              : 'No opposition players yet. Bind a team above, or add placeholders.'}
          </p>
        )}

        {rows.length > 0 && (
          <ul className="space-y-1.5">
            <li className={`hidden px-2 ${ROW_GRID}`}>
              <span className="text-xs font-medium text-ink-muted">#</span>
              <span className="text-xs font-medium text-ink-muted">Name</span>
              <span className="text-xs font-medium text-ink-muted">Role</span>
              <span aria-hidden="true" />
            </li>
            {rows.map((row) => (
              <SquadListRow
                key={row.key}
                row={row}
                onTogglePitch={() => togglePitch(row)}
                onSetRole={(role) => row.entity && updateTacticEntity(tactic.id, row.entity.id, { role })}
                onDelete={
                  // Placeholders only — see the header.
                  row.entity && !row.player ? () => removeTacticEntity(tactic.id, row.entity!.id) : undefined
                }
              />
            ))}
          </ul>
        )}

        {(side === 'away' && !awayTeamId) && (
          <button
            type="button"
            onClick={addPlaceholder}
            className="flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add placeholder
          </button>
        )}
      </div>
    </div>
  )
}

function SquadListRow({
  row,
  onTogglePitch,
  onSetRole,
  onDelete,
}: {
  row: SquadRow
  onTogglePitch: () => void
  onSetRole: (role: PlayerRole) => void
  onDelete?: () => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <li className="rounded-md border border-line px-2 py-2">
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${ROW_GRID}`}>
        <span className="text-sm tabular-nums text-ink-muted">{row.squadNumber ?? '—'}</span>
        <span className="min-w-0">
          <span className="block truncate text-sm text-ink">{row.label}</span>
          <span className="block truncate text-xs text-ink-faint">{row.positionLabel}</span>
        </span>
        <span className="text-xs font-medium tabular-nums text-ink-muted">{row.entity?.role ?? '—'}</span>
        <span className="flex items-center gap-1 sm:ml-auto">
          <button
            type="button"
            onClick={onTogglePitch}
            aria-pressed={row.onPitch}
            className={
              'min-h-11 rounded-md border px-2 text-xs font-medium transition-colors lg:min-h-8 ' +
              (row.onPitch
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-line text-ink-muted hover:border-line-strong hover:text-ink')
            }
          >
            {row.onPitch ? 'On pitch' : 'Off'}
          </button>
          {/* A role is a position in a shape, so it only means anything for a
              player who is actually in one. */}
          {row.entity && row.onPitch && (
            <button
              type="button"
              onClick={() => setEditing((open) => !open)}
              aria-label={`Edit ${row.label}'s role`}
              aria-expanded={editing}
              className="min-h-11 rounded-md border border-line px-1.5 text-ink-muted transition-colors hover:border-line-strong hover:text-ink lg:min-h-8"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label={`Remove ${row.label}`}
              className="min-h-11 rounded-md border border-line px-1.5 text-ink-muted transition-colors hover:border-line-strong hover:text-bad lg:min-h-8"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </span>
      </div>

      {editing && row.entity && (
        <div className="mt-2 border-t border-line pt-2">
          <Dropdown
            value={row.entity.role ?? ''}
            onChange={(value) => {
              onSetRole(value as PlayerRole)
              setEditing(false)
            }}
            options={ROLES.map((role) => ({ value: role, label: role }))}
            ariaLabel={`Role for ${row.label}`}
            placeholder="Set a role"
            searchable={false}
          />
          <p className="mt-1 text-xs text-ink-faint">
            Role is per tactic — it doesn&rsquo;t change this player&rsquo;s roster position.
          </p>
        </div>
      )}
    </li>
  )
}
