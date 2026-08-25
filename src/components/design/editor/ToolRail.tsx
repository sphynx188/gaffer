import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Grid3x3, MousePointer2, PenLine, Shapes, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { EquipmentType, PitchOrientation, PitchSize } from '../../../store'
import { PITCH_ORIENTATION_LABELS, PITCH_SIZE_LABELS } from '../../../store'
import {
  ArrowToolIcon,
  BallToolIcon,
  ConeToolIcon,
  MannequinToolIcon,
  NoteToolIcon,
  PlayerToolIcon,
  PLAYER_A_COLOR,
  PLAYER_B_COLOR,
  WitchesHatToolIcon,
} from './toolIcons'

// The left rail (rework plan Stage 5.2). One canvas tool is active at a time;
// the rail's other entries open a panel anchored to it rather than changing
// what a tap on the pitch does.
//
// Each tool offers exactly what the data model carries today. Equipment is the
// three kinds that exist, Markings is arrows and notes, Pitch is the four
// presets — Stages 6 and 7 widen those panels. Grid & Guides and Drill Details
// have nothing behind them yet, so they render disabled, the same treatment
// the plan asks for on the 2D/3D toggle.

export type CanvasTool = 'select' | 'player' | 'ball' | 'equipment' | 'marking'
export type MarkingTool = 'arrow-player' | 'arrow-ball' | 'text'
export type RailPanel = 'equipment' | 'marking' | 'team' | 'pitch' | null

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
  pitchSize: PitchSize
  orientation: PitchOrientation
  onPitchChange: (size: PitchSize, orientation: PitchOrientation) => void
  onStartDrag: (placement: DragPlacement) => (event: ReactPointerEvent) => void
  // Laid out as a column on desktop and as a wrapping row inside the mobile
  // drawer, where there's width to spare and no rail to anchor a popover to.
  layout: 'rail' | 'drawer'
}

const EQUIPMENT_OPTIONS: { value: EquipmentType; label: string; icon: ReactNode }[] = [
  { value: 'cone', label: 'Agility pole', icon: <ConeToolIcon /> },
  { value: 'witches_hat', label: "Witches' hat", icon: <WitchesHatToolIcon /> },
  { value: 'mannequin', label: 'Mannequin', icon: <MannequinToolIcon /> },
]

const MARKING_OPTIONS: { value: MarkingTool; label: string; icon: ReactNode }[] = [
  { value: 'arrow-player', label: 'Player run', icon: <ArrowToolIcon kind="player" /> },
  { value: 'arrow-ball', label: 'Pass', icon: <ArrowToolIcon kind="ball" /> },
  { value: 'text', label: 'Note', icon: <NoteToolIcon /> },
]

const PITCH_SIZES: PitchSize[] = ['full', 'three_quarter', 'half', 'quarter']
const ORIENTATIONS: PitchOrientation[] = ['portrait', 'landscape']

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
          active={props.tool === 'equipment'}
          layout={layout}
          onClick={() => {
            props.onToolChange('equipment')
            togglePanel('equipment')
          }}
          onPointerDown={props.onStartDrag({ kind: 'equipment', equipment: props.equipment })}
          icon={<Shapes className="h-4 w-4" />}
        />
        <RailButton
          label="Markings"
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
          layout={layout}
          disabled
          title="Grid & guides — coming with the element library stage"
          icon={<Grid3x3 className="h-4 w-4" />}
        />
        <RailButton
          label="Pitch"
          active={props.panel === 'pitch'}
          layout={layout}
          onClick={() => togglePanel('pitch')}
          icon={<SlidersHorizontal className="h-4 w-4" />}
        />
        <RailButton
          label="Drill details"
          layout={layout}
          disabled
          title="Drill details — coming with the metadata stage"
          icon={<Sparkles className="h-4 w-4" />}
        />
      </div>

      {props.panel && (
        <Panel layout={layout}>
          {props.panel === 'equipment' && (
            <OptionList
              title="Equipment"
              options={EQUIPMENT_OPTIONS}
              value={props.equipment}
              onChange={(value) => {
                props.onEquipmentChange(value)
                props.onToolChange('equipment')
              }}
            />
          )}
          {props.panel === 'marking' && (
            <OptionList
              title="Markings"
              options={MARKING_OPTIONS}
              value={props.marking}
              onChange={(value) => {
                props.onMarkingChange(value)
                props.onToolChange('marking')
              }}
            />
          )}
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
          {props.panel === 'pitch' && (
            <div className="space-y-3">
              <OptionList
                title="Pitch size"
                options={PITCH_SIZES.map((size) => ({ value: size, label: PITCH_SIZE_LABELS[size] ?? size }))}
                value={props.pitchSize}
                onChange={(value) => props.onPitchChange(value, props.orientation)}
              />
              <OptionList
                title="Orientation"
                options={ORIENTATIONS.map((o) => ({ value: o, label: PITCH_ORIENTATION_LABELS[o] ?? o }))}
                value={props.orientation}
                onChange={(value) => props.onPitchChange(props.pitchSize, value)}
              />
            </div>
          )}
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
    <div className="absolute left-full top-0 z-30 ml-2 w-56 rounded-xl border border-line bg-panel p-3">{children}</div>
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
  disabled = false,
  title,
  layout,
  onClick,
  onPointerDown,
}: {
  label: string
  icon: ReactNode
  active?: boolean
  disabled?: boolean
  title?: string
  layout: 'rail' | 'drawer'
  onClick?: () => void
  onPointerDown?: (event: ReactPointerEvent) => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      disabled={disabled}
      aria-pressed={active}
      title={title ?? label}
      // 44px minimum on touch, tightened on desktop where a pointer is precise.
      className={
        'flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors disabled:opacity-40 ' +
        (layout === 'rail' ? 'lg:min-h-10 lg:w-10 lg:justify-center lg:px-0 ' : '') +
        (active ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      <span className={layout === 'rail' ? 'lg:hidden' : ''}>{label}</span>
    </button>
  )
}
