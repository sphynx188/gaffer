import { useEffect, useRef, useState } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'gaffer-theme'
// Long enough to cover the 0.15s colour transition in index.css, with a little
// slack so the class isn't pulled before the last element has finished.
const SWITCH_MS = 220
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

  // Skips the very first run: on mount the attribute is only being brought in
  // line with what the <head> script already painted, so there is nothing to
  // animate and flagging a switch would fade the whole page in on load.
  const mounted = useRef(false)

  useEffect(() => {
    const root = document.documentElement
    // `theme-switching` forces one uniform colour transition across every
    // element for the duration of the swap (see index.css). Without it the
    // change is visibly ragged: anything carrying a `transition-opacity` or
    // `transition-transform` utility has no colour transition at all and snaps
    // while the rest of the page fades.
    let timer: number | undefined
    if (mounted.current) {
      root.classList.add('theme-switching')
      timer = window.setTimeout(() => root.classList.remove('theme-switching'), SWITCH_MS)
    }
    mounted.current = true

    root.setAttribute('data-theme', theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? LIGHT_THEME_COLOR : DARK_THEME_COLOR)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage can throw in private-browsing/embedded contexts —
      // the toggle still works for the session, it just won't persist.
    }

    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      // Toggling again mid-fade must not leave the class stranded on the root,
      // where it would flatten every later hover transition too.
      root.classList.remove('theme-switching')
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggleTheme }
}
