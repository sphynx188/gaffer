import { supabase } from './supabase'

// Landing-page waitlist insert. Deliberately NOT a store action and NOT
// routed through runSupabaseAction: the landing page must not mount the app
// store, and this needs the PostgrestError *code* (23505 = duplicate email,
// a success case here) which runSupabaseAction deliberately flattens into a
// user-facing message. This is the one sanctioned direct supabase call
// outside the store (landing-page spec, 2026-08-26).
export type WaitlistResult = 'ok' | 'duplicate' | 'error'

export async function joinWaitlist(email: string): Promise<WaitlistResult> {
  try {
    const { error } = await supabase
      .from('early_access_signup')
      .insert({ email: email.trim().toLowerCase() })
    if (!error) return 'ok'
    if (error.code === '23505') return 'duplicate'
    console.error('[waitlist]', error.message)
    return 'error'
  } catch (err) {
    console.error('[waitlist] unexpected', err)
    return 'error'
  }
}
