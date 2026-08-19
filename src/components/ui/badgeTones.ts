import type { AvailabilityStatus } from '../../store'
import type { BadgeTone } from './Badge'

export function availabilityTone(status: AvailabilityStatus): BadgeTone {
  switch (status) {
    case 'available':
      return 'ok'
    case 'unconfirmed':
      return 'warn'
    case 'unavailable':
      return 'bad'
  }
}

// 1-2 = light (ok), 3 = medium (warn), 4-5 = heavy (bad); unset = neutral.
export function loadTone(load: number | null | undefined): BadgeTone {
  if (load == null) return 'neutral'
  if (load <= 2) return 'ok'
  if (load === 3) return 'warn'
  return 'bad'
}
