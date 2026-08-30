import { Compass } from 'lucide-react'
import { EmptyState } from '../components/ui/EmptyState'

// Added 2026-08-30. Every unmatched path used to `<Navigate to="/" replace />`,
// so a stale bookmark or a mistyped URL dropped the coach on the club home with
// nothing said and the address bar quietly rewritten — indistinguishable from
// having clicked Home. The in-app equivalent was already handled well ("That
// drill isn't in your library."); this gives the router the same manners.
export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      message="There's nothing at that address."
      action={{ to: '/', label: 'Go to club home' }}
    />
  )
}
