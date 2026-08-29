import type { PitchConfig } from '../../../store'
import { PITCH_PRESETS, configFromPreset, formatDimensions } from '../canvas/pitchPresets'

// The pitch panel — simplified 2026-08-29 (first-phase-studio comparison) to
// a flat list of named field types, no family tabs, no custom-size inputs,
// no orientation toggle and no separate overlays row: each field type is a
// single button that sets the whole pitch (dimensions, orientation,
// markings, default overlay) at once, the same "pick a named field" model
// First Phase Studio's own Field menu uses. A coach who wants a different
// exact size no longer can — that precision traded away is the "simplify"
// half of the ask, not an oversight.

interface PitchPanelProps {
  pitch: PitchConfig
  onChange: (pitch: PitchConfig) => void
}

export function PitchPanel({ pitch, onChange }: PitchPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {PITCH_PRESETS.map((preset) => {
        const selected = pitch.preset === preset.id
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange({ ...pitch, ...configFromPreset(preset) })}
            aria-pressed={selected}
            className={
              'flex flex-col items-center gap-1 rounded-md border p-2 text-center transition-colors ' +
              (selected ? 'border-accent bg-accent/15' : 'border-line hover:border-line-strong')
            }
          >
            <PresetThumb widthMeters={preset.widthMeters} lengthMeters={preset.lengthMeters} orientation={preset.orientation} />
            <span className={'text-xs font-medium ' + (selected ? 'text-accent' : 'text-ink')}>{preset.label}</span>
            <span className="text-[10px] tabular-nums text-ink-faint">
              {formatDimensions(preset.lengthMeters, preset.widthMeters, preset.units ?? 'm')}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// A plan view of the space, drawn to its real proportions (post-orientation)
// so a coach can tell a wide-and-short field from a long-and-narrow one
// before reading the numbers.
function PresetThumb({
  widthMeters,
  lengthMeters,
  orientation,
}: {
  widthMeters: number
  lengthMeters: number
  orientation: PitchConfig['orientation']
}) {
  const box = 34
  const [w0, h0] = orientation === 'landscape' ? [lengthMeters, widthMeters] : [widthMeters, lengthMeters]
  const scale = box / Math.max(w0, h0)
  const w = Math.max(4, w0 * scale)
  const h = Math.max(4, h0 * scale)
  return (
    <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
      <rect
        x={(box - w) / 2}
        y={(box - h) / 2}
        width={w}
        height={h}
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        className="text-ink-muted"
      />
      <line
        x1={(box - w) / 2}
        y1={box / 2}
        x2={(box + w) / 2}
        y2={box / 2}
        stroke="currentColor"
        strokeWidth="0.8"
        className="text-ink-faint"
      />
    </svg>
  )
}
