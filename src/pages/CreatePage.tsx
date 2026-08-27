import { Link } from 'react-router-dom'
import { LibraryBig, Shield } from 'lucide-react'
import type { ComponentType } from 'react'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'

// The nav rail's "Create" entry lands here rather than opening a popover
// (2026-08-28): a small picker page, two cards, each linking straight to
// that document type's existing create entry point — /design (DesignPage's
// own create-drill form) and /tactics (TacticsPage's own create-tactic
// form). No new creation logic lives here, just a front door to what
// already exists.
const OPTIONS: { to: string; label: string; description: string; icon: ComponentType<{ className?: string }> }[] = [
  { to: '/design', label: 'Drill', description: 'Design a new drill on the pitch canvas.', icon: LibraryBig },
  { to: '/tactics', label: 'Tactic', description: 'Build a new tactical setup.', icon: Shield },
]

export function CreatePage() {
  return (
    <div>
      <PageHeader title="Create" description="What do you want to build?" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {OPTIONS.map(({ to, label, description, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card className="flex h-full flex-col items-start gap-3 transition-colors hover:border-accent/40 hover:bg-accent/5">
              <Icon className="h-8 w-8 text-accent" />
              <div>
                <p className="text-base font-semibold text-ink">{label}</p>
                <p className="mt-1 text-sm text-ink-muted">{description}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
