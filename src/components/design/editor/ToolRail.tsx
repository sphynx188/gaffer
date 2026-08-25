import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Grid3x3, MousePointer2, PenLine, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { EquipmentType, PitchConfig } from '../../../store'
import { BallToolIcon, PlayerToolIcon, PLAYER_A_COLOR, PLAYER_B_COLOR } from './toolIcons'
import { EquipmentIcon } from '../canvas/EquipmentShapes'
import { EquipmentPanel } from './EquipmentPanel'
import { MarkingsPanel } from './MarkingsPanel'
import type { MarkingTool } from './markingTools'
import { GridPanel, type GridSettings } from './GridPanel'
import { PitchPanel } from './PitchPanel'

// The left rail (rework plan Stage 5.2). One canvas tool is active at a time;
// the rail's other entries open a panel anchored to it rather than changing
// what a tap on the pitch does.
//
// Each tool offers exactly what the data model carries today. Equipment is the
// three kinds that exist, Markings is arrows and notes, Pitch is the four
// presets — Stages 6 and 7 widen those panels. Drill Details is the one entry
// that doesn't open a panel anchored to the rail: it opens the full-height
// drawer (Stage 8.2), which is too much form to fit beside a tool button.

export type CanvasTool = 'select' | 'player' | 'ball' | 'equipment' | 'marking'
export type { MarkingTool }
export type RailPanel = 'equipment' | 'marking' | 'team' | 'grid' | 'pitch' | null

// What a rail button can be dragged onto the pitch to place, carried over from
// the phases-era editor: a coach dragging an actual cone onto the pitch reads
// more naturally than tap-a-tool-then-tap-the-pitch. Both gestures are
// supported — tapping the tool arms it, dragging it places directly.
export type DragPlacement =
  | { kind: 'player'; team: string }
  | { kind: 'ball' }
  | { kind: 'equipment'; equipment: EquipmentType }

interface ToolRailProps {
  tool: CanvasTool
  onToolChange: (tool: CanvasTool) => void
  panel: RailPanel
  onPanelChange: (panel: RailPanel) => void
  team: string
  onTeamChange: (team: string) => void
  equipment: EquipmentType
  onEquipmentChange: (equipment: EquipmentType) => void
  marking: MarkingTool
  onMarkingChange: (marking: MarkingTool) => void
  markingCount: number
  onClearMarkings: () => void
  grid: GridSettings
  onGridChange: (grid: GridSettings) => void
  pitch: PitchConfig
  onPitchChange: (pitch: PitchConfig) => void
  onStartDrag: (placement: DragPlacement) => (event: ReactPointerEvent) => void
  onOpenDetails: () => void
  // Laid out as a column on desktop and as a wrapping row inside the mobile
  // drawer, where there's width to spare and no rail to anchor a popover to.
  layout: 'rail' | 'drawer'
}


export function ToolRail(props: ToolRailProps) {
  const { layout } = props
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Click-away closes an open panel, matching Dropdown.tsx's own popover
  // behaviour so every popover in the app dismisses the same way.
  useEffect(() => {
    if (!props.panel || layout !== 'rail') return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) props.onPanelChange(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.onPanelChange(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [props, layout])

  const togglePanel = (panel: Exclude<RailPanel, null>) =>
    props.onPanelChange(props.panel === panel ? null : panel)

  return (
    <div ref={containerRef} className={layout === 'rail' ? 'relative' : ''}>
      <div
        className={
          layout === 'rail'
            ? 'flex flex-col gap-1 rounded-xl border border-line bg-panel p-1.5'
            : 'grid grid-cols-2 gap-1.5'
        }
      >
        <RailButton
          label="Select"
          anchor="tool-select"
          active={props.tool === 'select'}
          layout={layout}
          onClick={() => {
            props.onToolChange('select')
            props.onPanelChange(null)
          }}
          icon={<MousePointer2 className="h-4 w-4" />}
        />
        <RailButton
          label="Player"
          anchor="tool-player"
          active={props.tool === 'player'}
          layout={layout}
          onClick={() => {
            props.onToolChange('player')
            props.onPanelChange(null)
          }}
          onPointerDown={props.onStartDrag({ kind: 'player', team: props.team })}
          icon={<PlayerToolIcon color={props.team === 'B' ? PLAYER_B_COLOR : PLAYER_A_COLOR} />}
        />
        <RailButton
          label="Ball"
          active={props.tool === 'ball'}
          layout={layout}
          onClick={() => {
            props.onToolChange('ball')
            props.onPanelChange(null)
          }}
          onPointerDown={props.onStartDrag({ kind: 'ball' })}
          icon={<BallToolIcon />}
        />
        <RailButton
          label="Equipment"
          anchor="tool-equipment"
          active={props.tool === 'equipment'}
          layout={layout}
          onClick={() => {
            props.onToolChange('equipment')
            togglePanel('equipment')
          }}
          onPointerDown={props.onStartDrag({ kind: 'equipment', equipment: props.equipment })}
          icon={<EquipmentIcon type={props.equipment} />}
        />
        <RailButton
          label="Markings"
          anchor="tool-marking"
          active={props.tool === 'marking'}
          layout={layout}
          onClick={() => {
            props.onToolChange('marking')
            togglePanel('marking')
          }}
          icon={<PenLine className="h-4 w-4" />}
        />
        <RailButton
          label={`Team ${props.team}`}
          active={props.panel === 'team'}
          layout={layout}
          onClick={() => togglePanel('team')}
          icon={
            <span
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: props.team === 'B' ? PLAYER_B_COLOR : PLAYER_A_COLOR }}
            />
          }
        />
        <RailButton
          label="Grid & guides"
          active={props.panel === 'grid'}
          layout={layout}
          onClick={() => togglePanel('grid')}
          icon={<Grid3x3 className="h-4 w-4" />}
        />
        <RailButton
          label="Pitch"
          anchor="rail-pitch"
          active={props.panel === 'pitch'}
          layout={layout}
          onClick={() => togglePanel('pitch')}
          icon={<SlidersHorizontal className="h-4 w-4" />}
        />
        <RailButton
          label="Drill details"
          anchor="rail-details"
          layout={layout}
          onClick={props.onOpenDetails}
          icon={<Sparkles className="h-4 w-4" />}
        />
      </div>

      {props.panel && (
        <Panel layout={layout}>
          {props.panel === 'equipment' && (
            <EquipmentPanel
              value={props.equipment}
              onChange={(value) => {
                props.onEquipmentChange(value)
                props.onToolChange('equipment')
              }}
              onStartDrag={(equipment) => props.onStartDrag({ kind: 'equipment', equipment })}
            />
          )}
          {props.panel === 'marking' && (
            <MarkingsPanel
              value={props.marking}
              onChange={(value) => {
                props.onMarkingChange(value)
                props.onToolChange('marking')
              }}
              onClearAll={props.onClearMarkings}
              markingCount={props.markingCount}
            />
          )}
          {props.panel === 'grid' && <GridPanel settings={props.grid} onChange={props.onGridChange} />}
          {props.panel === 'team' && (
            <OptionList
              title="Team colour"
              options={[
                { value: 'A', label: 'Team A', icon: <PlayerToolIcon color={PLAYER_A_COLOR} /> },
                { value: 'B', label: 'Team B', icon: <PlayerToolIcon color={PLAYER_B_COLOR} /> },
              ]}
              value={props.team}
              onChange={props.onTeamChange}
            />
          )}
          {props.panel === 'pitch' && <PitchPanel pitch={props.pitch} onChange={props.onPitchChange} />}
        </Panel>
      )}
    </div>
  )
}

// Anchored beside the rail on desktop; inline under the tool grid inside the
// mobile drawer, where there's no rail to anchor to and the sheet is already
// the popover.
function Panel({ layout, children }: { layout: 'rail' | 'drawer'; children: ReactNode }) {
  if (layout === 'drawer') {
    return <div className="mt-3 rounded-lg border border-line bg-panel-raised p-3">{children}</div>
  }
  return (
    <div className="absolute left-full top-0 z-30 ml-2 max-h-[70vh] w-56 overflow-y-auto rounded-xl border border-line bg-panel p-3">
      {children}
    </div>
  )
}

function OptionList<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string
  options: { value: T; label: string; icon?: ReactNode }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={
            'flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors ' +
            (value === option.value
              ? 'bg-accent/15 text-accent'
              : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
          }
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}

function RailButton({
  label,
  icon,
  active = false,
  layout,
  onClick,
  onPointerDown,
  anchor,
}: {
  label: string
  icon: ReactNode
  active?: boolean
  layout: 'rail' | 'drawer'
  onClick?: () => void
  onPointerDown?: (event: ReactPointerEvent) => void
  // Rework plan Stage 11.1 — matched against a TourStep's `anchor`.
  anchor?: string
}) {
  return (
    <button
      type="button"
      data-onboarding-anchor={anchor}
      onClick={onClick}
      onPointerDown={onPointerDown}
      aria-pressed={active}
      title={label}
      // 44px minimum on touch, tightened on desktop where a pointer is precise.
      className={
        'flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors ' +
        (layout === 'rail' ? 'lg:min-h-10 lg:w-10 lg:justify-center lg:px-0 ' : '') +
        (active ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className={layout === 'rail' ? 'lg:hidden' : ''}>{label}</span>
    </button>
  )
}
