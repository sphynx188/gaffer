import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

// Single source of truth for "is anyone logged in". Provider-agnostic —
// works the same whether the session came from signInWithPassword or from
// a password-recovery redirect link (supabase's client auto-detects the
// token in the URL on redirect back from email, detectSessionInUrl
// defaults to true), fires onAuthStateChange, and this hook just mirrors
// that into React state for App.tsx to gate on.
export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  // Fires once when the user lands here via a password-reset email link —
  // supabase-js establishes a real session from the recovery token before
  // App.tsx gets a chance to see it, so `session` alone can't distinguish
  // "signed in normally" from "here to set a new password." App.tsx uses
  // this to intercept that case with a password form instead of routing
  // straight into the app.
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { session, loading, isPasswordRecovery, clearPasswordRecovery: () => setIsPasswordRecovery(false) }
}
