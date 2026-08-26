import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
]

// Fixed marketing nav. Transparent over the hero; once scrolled it gains a
// hairline border + translucent blur so content sliding beneath reads as
// depth without a shadow (design.md: no shadows).
export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-300 ${
        scrolled ? 'border-b border-line bg-surface/80 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="text-base font-semibold tracking-tight text-ink">
          Gaffer
        </a>
        <div className="hidden items-center gap-6 sm:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-ink-muted transition-colors hover:text-ink">
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            Sign in
          </Link>
          <a
            href="#cta"
            className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            Get early access
          </a>
        </div>
      </nav>
    </header>
  )
}
