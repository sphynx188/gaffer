import { PageHeader } from '../components/ui/PageHeader'
import { TeamManagement } from '../components/TeamManagement'

export function TeamSettingsPage() {
  return (
    <div>
      <PageHeader title="Teams" description="Create and manage the teams you coach." />
      <TeamManagement />
    </div>
  )
}
