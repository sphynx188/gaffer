import { useEffect, useRef } from 'react'
import { CircleDot, LayoutGrid, MousePointer2, PenLine, SlidersHorizontal } from 'lucide-react'
import type { PitchConfig, Tactic } from '../../store'
import { useStore } from '../../store'
import { Panel, RailButton } from '../design/editor/ToolRail'
import { MarkingsPanel } from '../design/editor/MarkingsPanel'
import { PitchPanel } from '../design/editor/PitchPanel'
import type { MarkingTool } from '../design/editor/markingTools'
import { FORMATIONS, slotsForSide } from './formations'
import { SquadPanel } from './SquadPanel'

// The tactics tool row (2026-08-30), the same labelled row atop the canvas the
// drill editor got — built from ToolRail's own `RailButton` and `Panel` so the
// two rows are the same chrome rather than a lookalike, but a separate
// component because the TOOLS genuinely differ. That is the split gaffer/
// CLAUDE.md already describes for the two top bars: share the pieces, not a
// shell forced over two different toolbars.
//
// It replaces the permanent left-hand squad column. Squad still exists, as a
// dropdown here — team colour, the roster and the opposition binding all live
// in it and none of that had anywhere else to go — but the board no longer
// gives a third of its width to it by default.

export type TacticPanel = 'marking' | 'formation' | 'squad' | 'pitch' | null

export function TacticToolRow({
  tactic,
  keyframeId,
  side,
  onSideChange,
  tool,
  onToolChange,
  marking,
  onMarkingChange,
  panel,
  onPanelChange,
  onAddBall,
  layout,
}: {
  tactic: Tactic
  keyframeId: string | null
  side: 'home' | 'away'
  onSideChange: (side: 'home' | 'away') => void
  tool: 'select' | 'marking'
  onToolChange: (tool: 'select' | 'marking') => void
  marking: MarkingTool
  onMarkingChange: (tool: MarkingTool) => void
  panel: TacticPanel
  onPanelChange: (panel: TacticPanel) => void
  onAddBall: () => void
  layout: 'topbar' | 'drawer'
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const applyTacticFormation = useStore((s) => s.applyTacticFormation)
  const clearTacticDrawings = useStore((s) => s.clearTacticDrawings)
  const setTacticPitch = useStore((s) => s.setTacticPitch)

  // Click-away and Escape dismiss, matching ToolRail's own behaviour so every
  // popover in both editors closes the same way.
  useEffect(() => {
    if (!panel || layout === 'drawer') return
    const onPointerDown = (event: PointerEvent) => {
      const container = containerRef.current
      if (!container || !container.contains(event.target as Node)) onPanelChange(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onPanelChange(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [panel, onPanelChange, layout])

  const toggle = (next: Exclude<TacticPanel, null>) => onPanelChange(panel === next ? null : next)
  const formationKey = tactic.sides[side].formation
  const drawnCount = tactic.scene.markings.filter((m) => !m.keyframeId).length

  return (
    <div ref={containerRef} className={layout === 'topbar' ? 'relative' : ''}>
      <div
        className={
          layout === 'topbar'
            ? 'flex flex-wrap items-center gap-1 rounded-xl border border-line bg-panel p-1.5'
            : 'grid grid-cols-2 gap-1.5'
        }
      >
        <RailButton
          label="Select"
          active={tool === 'select'}
          layout={layout}
          onClick={() => {
            onToolChange('select')
            onPanelChange(null)
          }}
          icon={<MousePointer2 className="h-4 w-4" />}
        />
        <RailButton
          label="Markings"
          anchor="tactic-tools"
          active={tool === 'marking'}
          layout={layout}
          onClick={() => {
            onToolChange('marking')
            toggle('marking')
          }}
          icon={<PenLine className="h-4 w-4" />}
        />
        <RailButton
          label="Ball"
          anchor="tactic-ball"
          layout={layout}
          onClick={() => {
            onAddBall()
            onPanelChange(null)
          }}
          icon={<CircleDot className="h-4 w-4" />}
        />
        <RailButton
          label={formationLabelFor(formationKey)}
          anchor="tactic-formation"
          active={panel === 'formation'}
          layout={layout}
          onClick={() => toggle('formation')}
          icon={<LayoutGrid className="h-4 w-4" />}
        />
        <RailButton
          label={side === 'home' ? 'Home team' : 'Away team'}
          anchor="tactic-squad"
          active={panel === 'squad'}
          layout={layout}
          onClick={() => toggle('squad')}
          icon={
            <span
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: tactic.sides[side].color ?? '#3b82f6' }}
            />
          }
        />
        <RailButton
          label="Pitch"
          layout={layout}
          active={panel === 'pitch'}
          onClick={() => toggle('pitch')}
          icon={<SlidersHorizontal className="h-4 w-4" />}
        />
      </div>

      {panel && (
        <Panel layout={layout}>
          {panel === 'marking' && (
            <MarkingsPanel
              value={marking}
              onChange={(value) => {
                onMarkingChange(value)
                onToolChange(value === 'select' ? 'select' : 'marking')
              }}
              onClearAll={() => clearTacticDrawings(tactic.id)}
              markingCount={drawnCount}
            />
          )}
          {panel === 'formation' && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-ink-muted">
                Formation — {side === 'home' ? 'home' : 'away'} side
              </p>
              <p className="text-[11px] text-ink-faint">
                Picking one shapes the side, adding players if it needs them.
              </p>
              <div className="grid grid-cols-2 gap-1 pt-1">
                {FORMATIONS.map((formation) => (
                  <button
                    key={formation.key}
                    type="button"
                    aria-pressed={formationKey === formation.key}
                    disabled={!keyframeId}
                    onClick={() => {
                      if (!keyframeId) return
                      // `true` fills empty slots: from the row a coach is
                      // choosing a SHAPE, and on a board with nobody on it the
                      // only useful answer is to put a side out.
                      // slotsForSide mirrors x for the away team, the
                      // convention formations.ts documents. SquadPanel's own
                      // picker passes the unmirrored slots — worth reconciling,
                      // but placing a side we are CREATING onto the wrong half
                      // would be plainly broken, so this one follows the rule.
                      applyTacticFormation(
                        tactic.id,
                        side,
                        formation.key,
                        slotsForSide(formation, side),
                        keyframeId,
                        true
                      )
                      onPanelChange(null)
                    }}
                    className={
                      'flex min-h-11 items-center justify-center rounded-md border px-2 text-sm font-medium transition-colors disabled:opacity-40 lg:min-h-9 ' +
                      (formationKey === formation.key
                        ? 'border-accent bg-accent text-white'
                        : 'border-line text-ink-muted hover:border-line-strong hover:text-ink')
                    }
                  >
                    {formation.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {panel === 'squad' && keyframeId && (
            <SquadPanel tactic={tactic} keyframeId={keyframeId} side={side} onSideChange={onSideChange} />
          )}
          {panel === 'pitch' && (
            <PitchPanel pitch={tactic.pitch} onChange={(next: PitchConfig) => setTacticPitch(tactic.id, next)} />
          )}
        </Panel>
      )}
    </div>
  )
}

function formationLabelFor(key: string): string {
  return FORMATIONS.find((f) => f.key === key)?.label ?? 'Formation'
}
