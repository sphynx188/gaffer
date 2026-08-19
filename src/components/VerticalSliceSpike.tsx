import { useEffect, useState, type FormEvent } from 'react'
import { useStore } from '../store'
import type { DrillPhase, PitchFormat } from '../store'

// Phase JSON shape pasted directly per build guide 0.5.1 step 3 ("literally
// paste a JSON blob matching the schema") — not built through UI yet.
// Source: gaffer_project_plan_final.md §5.
const HARDCODED_PHASE: DrillPhase = {
  id: 'phase-1',
  label: 'Initial setup',
  duration_seconds: 30,
  players: [{ id: 'p1', x: 0.42, y: 0.61, team: 'attack', number: 9, label: 'CF' }],
  cones: [{ id: 'c1', x: 0.3, y: 0.5, color: 'orange' }],
  balls: [{ id: 'b1', x: 0.5, y: 0.5 }],
  arrows: [{ id: 'a1', from: { x: 0.42, y: 0.61 }, to: { x: 0.55, y: 0.4 }, style: 'run' }],
  annotations: [{ id: 't1', x: 0.1, y: 0.1, text: 'Press trigger' }],
}

const formatOptions: PitchFormat[] = ['11v11', 'small_sided']

// Phase 0.5.1 — Vertical Slice Spike (gaffer_mvp_build_steps.md). Deliberately
// throwaway/ugly UI: one session, one drill (with the hardcoded phase above),
// the point being to prove the schema and the Zustand-to-Supabase wiring
// survive a full reload, not to build anything reusable. Every stage below
// fetches from Supabase on mount rather than trusting local-only state, per
// the Definition of Done.
//
// Team creation/editing is no longer done here — Phase 1.1 built the real
// TeamManagement component (rendered above this in App.tsx), so this spike
// now just reads whichever team that screen created via the shared store.
// Phase 1.2 — Multi-team switching (US-4): the spike now follows
// `selectedTeamId` (set via TeamSwitcher) instead of always reading
// teams[0], so its session/drill flow is scoped to whichever team is
// currently selected — switching teams re-fetches and shows that team's
// data, never a blend of two teams'.
//
// Phase 2d — Save as reusable / attach to session (US-14, US-15): the old
// step 4 ("attach drill to session") is gone. It's superseded by the real
// SessionDrillsPanel (mounted under each session's "Drills" toggle in
// SessionPlanner) — that flow picks from every existing drill, sets order via
// reorder buttons, and edits planned duration/notes per attachment, none of
// which this spike ever did (it always attached order_index 0 and nothing
// else, and read from the flat `sessionDrills` array 2d retired). This spike
// now stops at step 3: it still exists only because drill *creation* has no
// real UI of its own yet.
export function VerticalSliceSpike() {
  const teams = useStore((s) => s.teams)
  const teamsLoading = useStore((s) => s.teamsLoading)
  const selectedTeamId = useStore((s) => s.selectedTeamId)

  const sessions = useStore((s) => s.sessions)
  const sessionsLoading = useStore((s) => s.sessionsLoading)
  const sessionsError = useStore((s) => s.sessionsError)
  const fetchSessions = useStore((s) => s.fetchSessions)
  const createSession = useStore((s) => s.createSession)

  const drills = useStore((s) => s.drills)
  const drillsLoading = useStore((s) => s.drillsLoading)
  const drillsError = useStore((s) => s.drillsError)
  const fetchDrills = useStore((s) => s.fetchDrills)
  const createDrill = useStore((s) => s.createDrill)

  const [sessionDate, setSessionDate] = useState('')
  const [sessionDuration, setSessionDuration] = useState(60)
  const [drillName, setDrillName] = useState('')
  const [drillFormat, setDrillFormat] = useState<PitchFormat>('11v11')

  // Spike is scoped to "the first row of each table" *for the currently
  // selected team* on purpose — one team, one session, one drill is the
  // whole point of 0.5.1; which team that is now comes from the store
  // (TeamSwitcher / teamSlice), not just whichever team loaded first.
  const team = teams.find((t) => t.id === selectedTeamId) ?? null
  const session = sessions[0] ?? null
  const drill = drills[0] ?? null

  useEffect(() => {
    if (team) {
      fetchSessions(team.id)
      fetchDrills(team.id)
    }
  }, [team, fetchSessions, fetchDrills])

  const handleCreateSession = async (e: FormEvent) => {
    e.preventDefault()
    if (!team || !sessionDate) return
    await createSession({ team_id: team.id, date: sessionDate, duration_minutes: sessionDuration })
  }

  const handleCreateDrill = async (e: FormEvent) => {
    e.preventDefault()
    if (!team || !drillName) return
    await createDrill({
      team_id: team.id,
      name: drillName,
      pitch_format: drillFormat,
      phases: [HARDCODED_PHASE],
    })
  }

  const allDone = Boolean(team && session && drill)

  return (
    <div className="mt-8 w-full max-w-lg space-y-6 border-t border-slate-200 pt-6 text-left">
      <p className="text-xs uppercase tracking-wide text-slate-400">
        0.5.1 — vertical slice spike (throwaway UI, drill creation only — see Sessions above to attach)
      </p>

      {/* 1. Team (created via the real Team management screen above) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">1. Team</h2>
        {teamsLoading && !team && <p className="text-sm text-slate-400">Loading…</p>}
        {team ? (
          <p className="text-sm text-slate-600">
            ✅ {team.name} ({team.format})
          </p>
        ) : (
          !teamsLoading && (
            <p className="text-sm text-slate-400">
              Create a team above to continue the spike.
            </p>
          )
        )}
      </section>

      {/* 2. Session */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">2. Session</h2>
        {!team && <p className="text-sm text-slate-400">Waiting for a team…</p>}
        {team && sessionsLoading && !session && <p className="text-sm text-slate-400">Loading…</p>}
        {sessionsError && <p className="text-sm text-red-600">{sessionsError}</p>}
        {session ? (
          <p className="text-sm text-slate-600">
            ✅ {session.date} · {session.duration_minutes} min
          </p>
        ) : (
          team &&
          !sessionsLoading && (
            <form onSubmit={handleCreateSession} className="flex flex-wrap gap-2">
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                type="number"
                min={1}
                value={sessionDuration}
                onChange={(e) => setSessionDuration(Number(e.target.value))}
                className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
                Create
              </button>
            </form>
          )
        )}
      </section>

      {/* 3. Drill (hardcoded single phase) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">3. Drill (hardcoded phase)</h2>
        {!team && <p className="text-sm text-slate-400">Waiting for a team…</p>}
        {team && drillsLoading && !drill && <p className="text-sm text-slate-400">Loading…</p>}
        {drillsError && <p className="text-sm text-red-600">{drillsError}</p>}
        {drill ? (
          <p className="text-sm text-slate-600">
            ✅ {drill.name} ({drill.pitch_format}) · {drill.phases.length} phase(s), first id "
            {drill.phases[0]?.id}"
          </p>
        ) : (
          team &&
          !drillsLoading && (
            <form onSubmit={handleCreateDrill} className="flex flex-wrap gap-2">
              <input
                value={drillName}
                onChange={(e) => setDrillName(e.target.value)}
                placeholder="Drill name"
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <select
                value={drillFormat}
                onChange={(e) => setDrillFormat(e.target.value as PitchFormat)}
                className="rounded border border-slate-300 px-2 py-1 text-sm"
              >
                {formatOptions.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded bg-slate-900 px-3 py-1 text-sm text-white">
                Create
              </button>
            </form>
          )
        )}
      </section>

      {allDone && (
        <p className="text-sm font-medium text-green-700">
          ✅ team/session/drill all present — reload the page; everything above should re-appear pulled fresh from
          Supabase. Attach this drill to the session from the "Drills" toggle in Sessions above.
        </p>
      )}
    </div>
  )
}
