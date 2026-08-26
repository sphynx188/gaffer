import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <div>
          <p className="text-sm font-semibold tracking-tight text-ink">Gaffer</p>
          <p className="mt-1 text-xs text-ink-faint">The coaching workspace for football.</p>
        </div>
        <div className="flex items-center gap-6 text-xs text-ink-muted">
          <a href="#features" className="transition-colors hover:text-ink">
            Features
          </a>
          <a href="#pricing" className="transition-colors hover:text-ink">
            Pricing
          </a>
          <Link to="/login" className="transition-colors hover:text-ink">
            Sign in
          </Link>
        </div>
        <p className="text-xs text-ink-faint">© 2026 Gaffer. Built for coaches.</p>
      </div>
    </footer>
  )
}
