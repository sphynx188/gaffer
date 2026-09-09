// Applies a previously-chosen light theme (see src/hooks/useTheme.ts) before
// first paint — without this, a light-mode user would see a flash of the dark
// default every load. Loaded as a blocking <script src> from index.html's
// <head>, deliberately not from main.tsx, since it has to run before CSS
// paints. It used to be inline in index.html; it moved here on 2026-09-09 so
// the Content-Security-Policy in vercel.json can be `script-src 'self'` with
// no inline-script hash to keep in sync. Wrapped in try/catch because
// localStorage can throw in some embedded/private-browsing contexts, and a
// theming failure should never block the app from loading. Bare `catch {}` on purpose — oxlint flags an
// unused binding.
;(function () {
  try {
    if (localStorage.getItem('gaffer-theme') === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
      document.querySelector('meta[name="theme-color"]').setAttribute('content', '#fbfbfa')
    }
  } catch {}
})()
