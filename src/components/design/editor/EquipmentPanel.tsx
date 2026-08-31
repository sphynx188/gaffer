import { ChevronDown } from 'lucide-react'
import type { EquipmentType } from '../../../store'
import { EQUIPMENT_ADVANCED, EQUIPMENT_CORE, EQUIPMENT_LABELS } from '../../../store'
import { EquipmentIcon } from '../canvas/EquipmentShapes'

// The equipment library (rework plan Stage 6.3), grouped Core / Advanced the
// way the target app groups it: the five a coach reaches for every session,
// then the six that turn up in specific drills.
//
// Collapse state (2026-08-31) is owned by the caller (ToolsPanel.tsx, the
// only one left now that Player/Ball/Equipment/Markings moved off the top
// bar) rather than here — same reasoning as LibrarySidebar's sections: one
// persisted record covering every collapsible group in the panel, not one
// per component.

export type EquipmentGroupKey = 'core' | 'advanced'

interface EquipmentPanelProps {
  value: EquipmentType
  onChange: (equipment: EquipmentType) => void
  // Dragging a piece straight onto the pitch, as well as arming it — the same
  // pair of gestures every placement tool in the rail supports.
  onStartDrag?: (equipment: EquipmentType) => (event: React.PointerEvent) => void
  collapsed: Record<EquipmentGroupKey, boolean>
  onToggleGroup: (group: EquipmentGroupKey) => void
}

export function EquipmentPanel({ value, onChange, onStartDrag, collapsed, onToggleGroup }: EquipmentPanelProps) {
  return (
    <div className="space-y-3">
      <Group
        title="Core"
        types={EQUIPMENT_CORE}
        value={value}
        onChange={onChange}
        onStartDrag={onStartDrag}
        collapsed={collapsed.core}
        onToggle={() => onToggleGroup('core')}
      />
      <Group
        title="Advanced"
        types={EQUIPMENT_ADVANCED}
        value={value}
        onChange={onChange}
        onStartDrag={onStartDrag}
        collapsed={collapsed.advanced}
        onToggle={() => onToggleGroup('advanced')}
      />
    </div>
  )
}

function Group({
  title,
  types,
  value,
  onChange,
  onStartDrag,
  collapsed,
  onToggle,
}: {
  title: string
  types: EquipmentType[]
  value: EquipmentType
  onChange: (equipment: EquipmentType) => void
  onStartDrag?: (equipment: EquipmentType) => (event: React.PointerEvent) => void
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="flex items-center gap-1 rounded text-xs font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
        {title}
      </button>
      {!collapsed &&
        types.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            onPointerDown={onStartDrag?.(type)}
            aria-pressed={value === type}
            className={
              'flex min-h-11 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors lg:min-h-9 ' +
              (value === type ? 'bg-accent/15 text-accent-ink' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
            }
          >
            <EquipmentIcon type={type} />
            {EQUIPMENT_LABELS[type]}
          </button>
        ))}
    </div>
  )
}
