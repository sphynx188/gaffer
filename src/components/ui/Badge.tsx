import type { ReactNode } from 'react'

export type BadgeTone = 'ok' | 'warn' | 'bad' | 'neutral'

const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: 'bg-ok/15 text-ok',
  warn: 'bg-warn/15 text-warn',
  bad: 'bg-bad/15 text-bad',
  neutral: 'bg-panel-raised text-ink-muted',
}

// Small colored pill — tone-to-color mapping lives here; the tone-per-value
// helper (availabilityTone) is in badgeTones.ts, split out so this file
// only exports the component (Fast Refresh requirement).
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  )
}
