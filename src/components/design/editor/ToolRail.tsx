import { useEffect, useRef, type ReactNode } from 'react'
import { Grid3x3, MousePointer2, SlidersHorizontal, Sparkles } from 'lucide-react'
import type { PitchConfig } from '../../../store'
import { GridPanel, type GridSettings } from './GridPanel'
import { PitchPanel } from './PitchPanel'

// The tool selector (rework plan Stage 5.2; moved from a left icon rail to a
// labelled row atop the canvas 2026-08-29 — icon-only buttons relying on a
// slow native tooltip made it hard to tell what a tool did before trying it,
// and the row now sits where the top bar's name field used to leave a wide
// stretch of visibly empty space).
//
// Player/Ball/Equipment/Markings/Team moved out (2026-08-31) into the right
// panel's Tools tab (see ToolsPanel.tsx) — everything placeable on the pitch
// lives beside the Timeline tab that already held the keyframes, rather than
// split between here and there. What stays here is mode and board-wide
// settings, not placeable content: Select (how a tap/drag on the canvas
// behaves), Grid & guides, Pitch, and Drill details.

export type CanvasTool = 'select' | 'player' | 'ball' | 'equipment' | 'marking'
export type RailPanel = 'grid' | 'pitch' | null

interface ToolRailProps {
  tool: CanvasTool
  onToolChange: (tool: CanvasTool) => void
  panel: RailPanel
  onPanelChange: (panel: RailPanel) => void
  grid: GridSettings
  onGridChange: (grid: GridSettings) => void
  pitch: PitchConfig
  onPitchChange: (pitch: PitchConfig) => void
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
          {props.panel === 'grid' && <GridPanel settings={props.grid} onChange={props.onGridChange} />}
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

export function RailButton({
  label,
  icon,
  active = false,
  layout,
  onClick,
  anchor,
}: {
  label: string
  icon: ReactNode
  active?: boolean
  layout: 'topbar' | 'drawer'
  onClick?: () => void
  // Rework plan Stage 11.1 — matched against a TourStep's `anchor`.
  anchor?: string
}) {
  return (
    <button
      type="button"
      data-onboarding-anchor={anchor}
      onClick={onClick}
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
