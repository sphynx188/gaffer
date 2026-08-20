import { PageHeader } from '../components/ui/PageHeader'
import { CalendarGrid } from '../components/CalendarGrid'

export function CalendarPage() {
  return (
    <div>
      <PageHeader title="Calendar" description="Every team's sessions this week, at a glance." />
      <CalendarGrid />
    </div>
  )
}
