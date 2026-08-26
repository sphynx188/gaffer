import { useState } from 'react'
import type { OverlayKind, PitchConfig, PitchOrientation } from '../../../store'
import {
  PITCH_FAMILIES,
  canonicalPresetId,
  configFromPreset,
  findPreset,
  formatDimensions,
  metersToYards,
  presetsInFamily,
  type PitchFamily,
} from '../canvas/pitchPresets'

// The pitch panel (rework plan Stage 7.3): family tabs, preset cards carrying
// a mini plan view and the real dimensions, a units toggle, a portrait switch,
// custom dimensions, and the overlays.

const OVERLAYS: { id: OverlayKind; label: string }[] = [
  { id: 'thirds', label: 'Thirds' },
  { id: 'channels', label: '5 channels' },
  { id: 'lanes', label: 'Lanes' },
  { id: 'half_spaces', label: 'Half-spaces' },
  { id: 'pep_zones', label: 'Pep 20 zones' },
  { id: 'training_grid', label: 'Training grid' },
]

const CHIP = 'min-h-11 rounded-md border px-2 text-xs font-medium transition-colors lg:min-h-8'
const ON = 'border-accent bg-accent text-white'
const OFF = 'border-line text-ink-muted hover:border-line-strong'

interface PitchPanelProps {
  pitch: PitchConfig
  onChange: (pitch: PitchConfig) => void
}

export function PitchPanel({ pitch, onChange }: PitchPanelProps) {
  const active = findPreset(pitch.preset)
  // Legacy ids ('half', 'quarter') describe a card that exists under a
  // different name, so resolve before comparing — otherwise every drill saved
  // before Stage 7 shows no selected card at all.
  const selectedId = canonicalPresetId(pitch.preset)
  const [family, setFamily] = useState<PitchFamily>(active?.family ?? 'classic')
  const units = pitch.units ?? active?.units ?? 'm'

  const patch = (next: Partial<PitchConfig>) => onChange({ ...pitch, ...next })

  const setDimension = (key: 'widthMeters' | 'lengthMeters', raw: string) => {
    const entered = Number(raw)
    if (!Number.isFinite(entered) || entered <= 0) return
    // Typed in whatever unit the panel is showing, stored in metres.
    const meters = units === 'yd' ? entered * 0.9144 : entered
    // Any hand-edited dimension stops being the preset it started as.
    patch({ [key]: Math.round(meters * 10) / 10, preset: 'custom', markings: undefined } as Partial<PitchConfig>)
  }

  const toggleOverlay = (id: OverlayKind) => {
    const current = pitch.overlays ?? []
    patch({ overlays: current.includes(id) ? current.filter((o) => o !== id) : [...current, id] })
  }

  const shown = (meters: number) => Math.round(units === 'yd' ? metersToYards(meters) : meters)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {PITCH_FAMILIES.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFamily(option.id)}
            aria-pressed={family === option.id}
            className={CHIP + ' ' + (family === option.id ? ON : OFF)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {presetsInFamily(family).map((preset) => {
          const selected = selectedId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ ...pitch, ...configFromPreset(preset, pitch.orientation) })}
              aria-pressed={selected}
              className={
                'flex flex-col items-center gap-1 rounded-md border p-2 text-center transition-colors ' +
                (selected ? 'border-accent bg-accent/15' : 'border-line hover:border-line-strong')
              }
            >
              <PresetThumb widthMeters={preset.widthMeters} lengthMeters={preset.lengthMeters} />
              <span className={'text-xs font-medium ' + (selected ? 'text-accent' : 'text-ink')}>{preset.label}</span>
              <span className="text-[10px] tabular-nums text-ink-faint">
                {formatDimensions(preset.lengthMeters, preset.widthMeters, preset.units ?? 'm')}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
        <button
          type="button"
          onClick={() => patch({ orientation: (pitch.orientation === 'portrait' ? 'landscape' : 'portrait') as PitchOrientation })}
          className={CHIP + ' ' + OFF}
        >
          {pitch.orientation === 'portrait' ? 'Portrait' : 'Landscape'}
        </button>
        {(['m', 'yd'] as const).map((unit) => (
          <button
            key={unit}
            type="button"
            onClick={() => patch({ units: unit })}
            aria-pressed={units === unit}
            className={CHIP + ' ' + (units === unit ? ON : OFF)}
          >
            {unit}
          </button>
        ))}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-ink-muted">Custom size ({units})</p>
        <div className="flex items-center gap-1.5">
          <input
            aria-label={`Length in ${units}`}
            type="number"
            min={1}
            value={shown(pitch.lengthMeters)}
            onChange={(e) => setDimension('lengthMeters', e.target.value)}
            className="h-11 w-full rounded-md border border-line bg-panel px-2 text-sm tabular-nums text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 lg:h-8"
          />
          <span className="text-xs text-ink-faint">×</span>
          <input
            aria-label={`Width in ${units}`}
            type="number"
            min={1}
            value={shown(pitch.widthMeters)}
            onChange={(e) => setDimension('widthMeters', e.target.value)}
            className="h-11 w-full rounded-md border border-line bg-panel px-2 text-sm tabular-nums text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30 lg:h-8"
          />
        </div>
      </div>

      <div className="space-y-1 border-t border-line pt-3">
        <p className="text-xs font-medium text-ink-muted">Overlays</p>
        <div className="flex flex-wrap gap-1">
          {OVERLAYS.map((overlay) => {
            const on = (pitch.overlays ?? []).includes(overlay.id)
            return (
              <button
                key={overlay.id}
                type="button"
                onClick={() => toggleOverlay(overlay.id)}
                aria-pressed={on}
                className={CHIP + ' ' + (on ? ON : OFF)}
              >
                {overlay.label}
              </button>
            )
          })}
        </div>
        {(pitch.overlays ?? []).length > 0 && (
          <label className="block pt-1 text-xs text-ink-muted">
            Opacity — {Math.round((pitch.overlayOpacity ?? 0.4) * 100)}%
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round((pitch.overlayOpacity ?? 0.4) * 100)}
              onChange={(e) => patch({ overlayOpacity: Number(e.target.value) / 100 })}
              className="mt-1 w-full accent-accent"
            />
          </label>
        )}
      </div>
    </div>
  )
}

// A plan view of the space, drawn to its real proportions so a coach can tell
// a long-and-narrow grid from a wide-and-short one before reading the numbers.
function PresetThumb({ widthMeters, lengthMeters }: { widthMeters: number; lengthMeters: number }) {
  const box = 34
  const scale = box / Math.max(widthMeters, lengthMeters)
  const w = Math.max(4, widthMeters * scale)
  const h = Math.max(4, lengthMeters * scale)
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
