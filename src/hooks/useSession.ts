import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Single source of truth for "is anyone logged in" — Phase 0.5. Supabase's
// client auto-detects the magic-link token in the URL on redirect back from
// email (detectSessionInUrl defaults to true), fires onAuthStateChange, and
// this hook just mirrors that into React state for App.tsx to gate on.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading }
}
