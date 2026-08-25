import { createClient } from '@supabase/supabase-js'

// Exported for the one caller that needs a second, differently-configured
// client rather than this shared one: the public share page builds a
// session-less client carrying an `x-share-token` header (drillSlice
// .fetchSharedDrill, rework plan Stage 10.4). Everything else in the app uses
// `supabase` below.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.example to .env.local and fill in ' +
      'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from your Supabase project settings.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
