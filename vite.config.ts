import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Pinned, and `strictPort` so a busy 5173 FAILS rather than silently
  // drifting to 5174/5175. The drift matters now that OAuth is wired up:
  // every dev origin has to be listed in the Supabase dashboard under
  // Authentication -> URL Configuration -> Redirect URLs, and a server that
  // quietly moves ports comes back from Google to an origin that isn't on
  // that list — which fails as "returned to the site root and the invite was
  // never redeemed" rather than as anything that names a port. Better to be
  // told the port is taken and free it.
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    rolldownOptions: {
      output: {
        // Mediabunny (the drill-video compressor, compressVideo.ts) is only
        // ever imported dynamically, so it already lands in its own chunk —
        // but under its entry file's name, `src-[hash].js`. A stable name is
        // what lets the PWA precache below leave it out by pattern.
        chunkFileNames: (chunk) =>
          chunk.moduleIds.some((id) => id.includes('/node_modules/mediabunny/'))
            ? 'assets/mediabunny-[hash].js'
            : 'assets/[name]-[hash].js',
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    // Phase 3.4 (gaffer_mvp_build_steps.md) — PWA install + app-shell
    // caching. Scope is deliberately narrow: cache the app shell (JS/CSS/
    // HTML/icons) plus whatever GET data the app has already fetched, purely
    // so the last-synced plan is visible with no signal. Nothing here queues
    // or retries writes — Workbox only intercepts requests that match a
    // registered route (method + URL pattern both have to match), and every
    // route below is GET-only, so POST/PATCH/DELETE calls to Supabase are
    // never cached or replayed; offline writes simply fail the same way they
    // would with no service worker at all, which is what "explicitly do not
    // attempt to cache or queue offline writes" requires.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Gaffer',
        short_name: 'Gaffer',
        description: 'Plan sessions and design drills for your team, pitch-side or off it.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#4f46e5',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the built app shell (JS/CSS/HTML + the icons above) so it
        // loads with no network at all.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // ~700 kB that only a coach attaching a drill video ever needs, and
        // that needs a connection to upload anyway — not worth putting on
        // every install. It is fetched over the network the first time it is
        // used, like any other request.
        globIgnores: ['**/mediabunny-*.js'],
        // Read-only offline data: GET requests to the Supabase REST API are
        // served from the network when available and fall back to the last
        // successful response when it isn't.
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              url.hostname.endsWith('.supabase.co') &&
              url.pathname.startsWith('/rest/') &&
              request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-data',
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 7, // one week
              },
            },
          },
        ],
      },
    }),
  ],
})
