import type { EquipmentType } from '../../../store'
import { EQUIPMENT_ADVANCED, EQUIPMENT_CORE, EQUIPMENT_LABELS } from '../../../store'
import { EquipmentIcon } from '../canvas/EquipmentShapes'

// The equipment library (rework plan Stage 6.3), grouped Core / Advanced the
// way the target app groups it: the five a coach reaches for every session,
// then the six that turn up in specific drills.

interface EquipmentPanelProps {
  value: EquipmentType
  onChange: (equipment: EquipmentType) => void
  // Dragging a piece straight onto the pitch, as well as arming it — the same
  // pair of gestures every placement tool in the rail supports.
  onStartDrag?: (equipment: EquipmentType) => (event: React.PointerEvent) => void
}

export function EquipmentPanel({ value, onChange, onStartDrag }: EquipmentPanelProps) {
  return (
    <div className="space-y-3">
      <Group title="Core" types={EQUIPMENT_CORE} value={value} onChange={onChange} onStartDrag={onStartDrag} />
      <Group title="Advanced" types={EQUIPMENT_ADVANCED} value={value} onChange={onChange} onStartDrag={onStartDrag} />
    </div>
  )
}

function Group({
  title,
  types,
  value,
  onChange,
  onStartDrag,
}: {
  title: string
  types: EquipmentType[]
  value: EquipmentType
  onChange: (equipment: EquipmentType) => void
  onStartDrag?: (equipment: EquipmentType) => (event: React.PointerEvent) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-ink-muted">{title}</p>
      {types.map((type) => (
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
