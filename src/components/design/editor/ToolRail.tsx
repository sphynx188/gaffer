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

// The tool selector (rework plan Stage 5.2; moved from a left icon rail to a
// labelled row atop the canvas 2026-08-29 — icon-only buttons relying on a
// slow native tooltip made it hard to tell what a tool did before trying it,
// and the row now sits where the top bar's name field used to leave a wide
// stretch of visibly empty space). One canvas tool is active at a time; the
// row's other entries open a panel anchored to it rather than changing what a
// tap on the pitch does.
//
// Each tool offers exactly what the data model carries today. Equipment is the
// three kinds that exist, Markings is arrows and notes, Pitch is the four
// presets — Stages 6 and 7 widen those panels. Drill Details is the one entry
// that doesn't open a panel anchored to the row: it opens the full-height
// drawer (Stage 8.2), which is too much form to fit in a dropdown.

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
  // A labelled row atop the canvas on desktop; a wrapping grid inside the
  // mobile drawer, where there's width to spare and nothing to drop a panel
  // below.
  layout: 'topbar' | 'drawer'
}


export function ToolRail(props: ToolRailProps) {
  const { layout } = props
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Click-away closes an open panel, matching Dropdown.tsx's own popover
  // behaviour so every popover in the app dismisses the same way. Only the
  // topbar instance needs this — the mobile drawer's panel sits inline inside
  // the already-modal Sheet, which closes it by closing the whole sheet.
  const { panel, onPanelChange } = props
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
    // Depends on the two values actually used, not the whole `props` object —
    // that one is rebuilt on every DrillEditor render, which tore this
    // listener down and re-registered it dozens of times a second while the
    // playhead ran.
  }, [panel, onPanelChange, layout])

  const togglePanel = (panel: Exclude<RailPanel, null>) =>
    props.onPanelChange(props.panel === panel ? null : panel)

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

// Dropped below the row on desktop; inline under the tool grid inside the
// mobile drawer, where there's no row to anchor to and the sheet is already
// the popover.
//
// Exported (with RailButton below) on 2026-08-30 so the tactics editor's own
// tool row is the same chrome rather than a lookalike — the two editors have
// different TOOLS, which is why they don't share a row component, but a button
// and a dropdown should not drift apart between them.
export function Panel({ layout, children }: { layout: 'topbar' | 'drawer'; children: ReactNode }) {
  if (layout === 'drawer') {
    return <div className="mt-3 rounded-lg border border-line bg-panel-raised p-3">{children}</div>
  }
  return (
    <div className="absolute left-0 top-full z-30 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-xl border border-line bg-panel p-3">
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
              ? 'bg-accent/15 text-accent-ink'
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

export function RailButton({
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
  layout: 'topbar' | 'drawer'
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
        'flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ' +
        (layout === 'topbar' ? 'lg:min-h-9 lg:px-2.5' : '') +
        (active ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
