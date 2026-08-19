import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
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
