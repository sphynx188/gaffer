import type { AvailabilityStatus } from '../../store'
import type { BadgeTone } from './Badge'

export function availabilityTone(status: AvailabilityStatus): BadgeTone {
  switch (status) {
    case 'present':
      return 'ok'
    case 'unconfirmed':
      return 'neutral'
    case 'away':
      return 'warn'
    case 'injured':
      return 'bad'
  }
}
