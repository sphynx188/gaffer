import { Redo2, Undo2 } from 'lucide-react'
import { useStore } from '../../store'
import type { PitchConfig, Tactic } from '../../store'
import { MarkingsPanel } from '../design/editor/MarkingsPanel'
import { PitchPanel } from '../design/editor/PitchPanel'
import { PropertiesPanel } from '../design/editor/PropertiesPanel'
import type { MarkingTool } from '../design/editor/markingTools'
import type { TimelineHost } from '../design/timeline/TimelineHost'

// The inspector (TACTICS_BOARD_REWORK_PLAN.md Stage 7.3): Tools / Player /
// Style tabs.
//
//   TOOLS   the fourteen drawing tools, plus the DRAWING undo/redo and Clear
//           drawings. Those sit here rather than in the top bar on purpose:
//           the two undo stacks Stage 2.3 built are only useful if a coach can
//           tell them apart, and the way to do that is to put each one beside
//           the work it undoes.
//   PLAYER  the shared PropertiesPanel, with Marker Overrides switched on.
//   STYLE   how the board itself looks — the pitch preset, its dimensions and
//           the overlays. This is Teloframe's "Customize" by another name.
//
// The Player tab's empty state is the plan's own wording from §1.

export type InspectorTab = 'tools' | 'player' | 'style'

const TAB = 'min-h-11 flex-1 rounded-md text-xs font-medium transition-colors lg:min-h-9'
const TAB_ON = 'bg-accent text-white'
const TAB_OFF = 'text-ink-muted hover:bg-panel-raised hover:text-ink'

export function TacticInspector({
  tactic,
  host,
  tab,
  onTabChange,
  marking,
  onMarkingChange,
  selectedIds,
  currentTime,
  parkedKeyframeId,
  hasFollowingKeyframe,
  onSeek,
  onRemoveSelection,
}: {
  tactic: Tactic
  host: TimelineHost
  tab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  marking: MarkingTool
  onMarkingChange: (tool: MarkingTool) => void
  selectedIds: string[]
  currentTime: number
  parkedKeyframeId: string | null
  hasFollowingKeyframe: boolean
  onSeek: (seconds: number) => void
  onRemoveSelection: () => void
}) {
  const undoTactic = useStore((s) => s.undoTactic)
  const redoTactic = useStore((s) => s.redoTactic)
  const canUndoDrawing = useStore((s) => s.canUndoTactic(tactic.id, 'drawing'))
  const canRedoDrawing = useStore((s) => s.canRedoTactic(tactic.id, 'drawing'))
  const clearTacticDrawings = useStore((s) => s.clearTacticDrawings)
  const removeTacticMarking = useStore((s) => s.removeTacticMarking)
  const setTacticPitch = useStore((s) => s.setTacticPitch)

  const drawnCount = tactic.scene.markings.filter((m) => !m.keyframeId).length

  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Inspector" className="flex gap-1 rounded-md bg-panel-raised p-1">
        {(['tools', 'player', 'style'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={tab === option}
            onClick={() => onTabChange(option)}
            className={TAB + ' ' + (tab === option ? TAB_ON : TAB_OFF)}
          >
            {option === 'tools' ? 'Tools' : option === 'player' ? 'Player' : 'Style'}
          </button>
        ))}
      </div>

      {tab === 'tools' && (
        <div className="space-y-2">
          {/* Drawing undo/redo — the OTHER stack. Clearing drawings can never
              rewind the animation, and stepping back through the animation
              never wipes a coach's arrows. */}
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => undoTactic(tactic.id, 'drawing')}
              disabled={!canUndoDrawing}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-line text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40 lg:min-h-9"
              title="Undo the last drawing"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Undo
            </button>
            <button
              type="button"
              onClick={() => redoTactic(tactic.id, 'drawing')}
              disabled={!canRedoDrawing}
              className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-line text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40 lg:min-h-9"
              title="Redo the last drawing"
            >
              <Redo2 className="h-3.5 w-3.5" />
              Redo
            </button>
          </div>

          <MarkingsPanel
            value={marking}
            onChange={onMarkingChange}
            onClearAll={() => {
              for (const m of tactic.scene.markings) removeTacticMarking(tactic.id, m.id)
            }}
            markingCount={tactic.scene.markings.length}
            onClearDrawings={() => clearTacticDrawings(tactic.id)}
            drawingCount={drawnCount}
          />
        </div>
      )}

      {tab === 'player' && (
        <>
          {selectedIds.length === 0 && (
            <p className="text-xs text-ink-muted">
              Select a player, ball, or annotation to edit its properties.
            </p>
          )}
          <PropertiesPanel
            host={host}
            selectedIds={selectedIds}
            currentTime={currentTime}
            parkedKeyframeId={parkedKeyframeId}
            hasFollowingKeyframe={hasFollowingKeyframe}
            drawingRoute={false}
            onDrawRoute={() => {}}
            onClearRoute={() => {}}
            onSeek={onSeek}
            onRemoveSelection={onRemoveSelection}
            onDuplicateAlongLine={() => {}}
            showMarkerOverrides
          />
        </>
      )}

      {tab === 'style' && (
        <PitchPanel
          pitch={tactic.pitch}
          onChange={(next: PitchConfig) => setTacticPitch(tactic.id, next)}
        />
      )}
    </div>
  )
}
