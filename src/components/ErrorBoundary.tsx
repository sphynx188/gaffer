import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

// Added 2026-09-09 (pre-deployment audit). Until this existed, an exception
// thrown during render anywhere in the tree unmounted the whole app and left
// a blank page — no message, no way back, and nothing in the address bar to
// say why. This sits ABOVE the router in main.tsx so that a crash inside a
// route, the shell, or the router itself all land here, which is also why
// the fallback uses a plain <a> rather than <Link>: there may be no router
// left to link through.
//
// Deliberately minimal. It does not try to recover state (a reload is the
// honest fix for a broken render) and it does not show the error text — the
// stack goes to console.error for whoever is debugging, and the coach gets
// the same tone as NotFoundPage ("There's nothing at that address.").
type Props = { children: ReactNode }
type State = { failed: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[render]', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface p-6 text-ink">
        <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-dashed border-line py-8 text-center">
          <AlertTriangle className="h-6 w-6 text-ink-faint" />
          <p className="text-sm text-ink-muted">Something went wrong showing this page.</p>
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm font-medium text-accent-ink hover:text-accent-hover"
            >
              Reload
            </button>
            <a href="/" className="text-sm font-medium text-accent-ink hover:text-accent-hover">
              Go to club home
            </a>
          </div>
        </div>
      </main>
    )
  }
}
