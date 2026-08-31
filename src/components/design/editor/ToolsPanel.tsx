import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import type { EquipmentType } from '../../../store'
import type { CanvasTool } from './ToolRail'
import { EquipmentPanel, type EquipmentGroupKey } from './EquipmentPanel'
import { MarkingsPanel } from './MarkingsPanel'
import type { MarkingTool } from './markingTools'
import { BallToolIcon, PlayerToolIcon, PLAYER_A_COLOR, PLAYER_B_COLOR } from './toolIcons'

// The drag-and-drop palette (2026-08-31) — the right panel's Tools tab,
// beside Timeline (PropertiesPanel's own keyframe view). Everything that gets
// PLACED on the pitch lives here now, carried over from the old top-bar tool
// rail's Player/Ball/Equipment/Markings/Team buttons (see ToolRail's own
// comment for what stayed there instead: Select, Grid & guides, Pitch, Drill
// details — mode and board-wide settings, not placeable content).
//
// Both gestures the rail always supported still work identically: tapping an
// item arms it (so a tap on the pitch places it), dragging it places
// directly. Equipment and Markings are the exact same sub-panels the rail
// used to pop open in a flyout — reused verbatim, just always visible here
// instead of gated behind an extra tap.
export type DragPlacement =
  | { kind: 'player'; team: string }
  | { kind: 'ball' }
  | { kind: 'equipment'; equipment: EquipmentType }

// Every category collapses independently (2026-08-31), same persistence
// shape as LibrarySidebar's sections: one localStorage record for the whole
// panel rather than one key per component, owned here since this is the one
// place all four categories are actually composed together.
type ToolsSectionKey = 'players' | EquipmentGroupKey | 'markings'
const COLLAPSE_STORAGE_KEY = 'gaffer-tools-panel-collapsed'
const DEFAULT_COLLAPSED: Record<ToolsSectionKey, boolean> = {
  players: false,
  core: false,
  advanced: false,
  markings: false,
}

function readStoredCollapsed(): Record<ToolsSectionKey, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    return raw ? { ...DEFAULT_COLLAPSED, ...JSON.parse(raw) } : DEFAULT_COLLAPSED
  } catch {
    return DEFAULT_COLLAPSED
  }
}

export interface ToolsPanelProps {
  // Which canvas tool is actually armed right now — distinct from `marking`/
  // `equipment`/`team` below, which just remember the last sub-choice within
  // each category even while a totally different tool (often plain Select)
  // is the one live on the pitch. Used to gate the "pressed" highlight so a
  // remembered choice doesn't read as active when it isn't.
  tool: CanvasTool
  team: string
  onTeamChange: (team: string) => void
  onToolChange: (tool: CanvasTool) => void
  equipment: EquipmentType
  onEquipmentChange: (equipment: EquipmentType) => void
  marking: MarkingTool
  onMarkingChange: (marking: MarkingTool) => void
  markingCount: number
  onClearMarkings: () => void
  onStartDrag: (placement: DragPlacement) => (event: ReactPointerEvent) => void
}

export function ToolsPanel(props: ToolsPanelProps) {
  const [collapsed, setCollapsed] = useState(readStoredCollapsed)
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapsed))
    } catch {
      // Private-browsing/embedded contexts can throw — collapsing still
      // works for the session, it just won't survive a reload.
    }
  }, [collapsed])
  const toggle = (key: ToolsSectionKey) => setCollapsed((c) => ({ ...c, [key]: !c[key] }))

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <CategoryHeader collapsed={collapsed.players} onToggle={() => toggle('players')}>
          Players &amp; ball
        </CategoryHeader>
        {!collapsed.players && (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <PlayerSwatch
                team="A"
                active={props.team === 'A'}
                onClick={() => {
                  props.onTeamChange('A')
                  props.onToolChange('player')
                }}
                onPointerDown={props.onStartDrag({ kind: 'player', team: 'A' })}
              />
              <PlayerSwatch
                team="B"
                active={props.team === 'B'}
                onClick={() => {
                  props.onTeamChange('B')
                  props.onToolChange('player')
                }}
                onPointerDown={props.onStartDrag({ kind: 'player', team: 'B' })}
              />
            </div>
            <button
              type="button"
              onClick={() => props.onToolChange('ball')}
              onPointerDown={props.onStartDrag({ kind: 'ball' })}
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink lg:min-h-9"
            >
              <BallToolIcon />
              Ball
            </button>
          </>
        )}
      </div>

      <div data-onboarding-anchor="tool-equipment" className="border-t border-line pt-3">
        <EquipmentPanel
          value={props.equipment}
          onChange={(value) => {
            props.onEquipmentChange(value)
            props.onToolChange('equipment')
          }}
          onStartDrag={(equipment) => props.onStartDrag({ kind: 'equipment', equipment })}
          collapsed={{ core: collapsed.core, advanced: collapsed.advanced }}
          onToggleGroup={toggle}
        />
      </div>

      <div data-onboarding-anchor="tool-marking" className="border-t border-line pt-3">
        <MarkingsPanel
          value={props.marking}
          armed={props.tool === 'marking'}
          onChange={(value) => {
            props.onMarkingChange(value)
            props.onToolChange('marking')
          }}
          onClearAll={props.onClearMarkings}
          markingCount={props.markingCount}
          collapsed={collapsed.markings}
          onToggleCollapsed={() => toggle('markings')}
        />
      </div>
    </div>
  )
}

function CategoryHeader({
  collapsed,
  onToggle,
  children,
}: {
  collapsed: boolean
  onToggle: () => void
  children: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      className="flex items-center gap-1 rounded text-xs font-medium text-ink-muted transition-colors hover:text-ink"
    >
      <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
      {children}
    </button>
  )
}

function PlayerSwatch({
  team,
  active,
  onClick,
  onPointerDown,
}: {
  team: string
  active: boolean
  onClick: () => void
  onPointerDown: (event: ReactPointerEvent) => void
}) {
  return (
    <button
      type="button"
      data-onboarding-anchor={team === 'A' ? 'tool-player' : undefined}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-pressed={active}
      className={
        'flex min-h-11 items-center gap-2 rounded-md px-2 text-sm transition-colors lg:min-h-9 ' +
        (active ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
      }
    >
      <PlayerToolIcon color={team === 'B' ? PLAYER_B_COLOR : PLAYER_A_COLOR} />
      Team {team}
    </button>
  )
}
