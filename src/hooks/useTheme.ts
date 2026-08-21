import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'gaffer-theme'
const LIGHT_THEME_COLOR = '#fbfbfa'
const DARK_THEME_COLOR = '#010102'

function readStoredTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

// Dark/light toggle (AppShell's header button). Dark is the default and
// needs no attribute — see index.css's `:root[data-theme="light"]`
// override block — so this only ever sets the attribute when switching to
// or persisting light. The <head> inline script in index.html mirrors
// `readStoredTheme`'s localStorage check to apply light before first
// paint; this hook is what keeps that in sync afterward and on toggle.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? LIGHT_THEME_COLOR : DARK_THEME_COLOR)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage can throw in private-browsing/embedded contexts —
      // the toggle still works for the session, it just won't persist.
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggleTheme }
}
