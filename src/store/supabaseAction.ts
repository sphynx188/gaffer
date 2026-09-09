import type { PostgrestError } from '@supabase/supabase-js'

export type SupabaseCallResult<T> = { data: T | null; error: PostgrestError | null }

export interface ActionOutcome<T> {
  data: T | null
  error: string | null
}

const DEFAULT_ERROR_MESSAGE = "Couldn't save, try again."

// Postgres SQLSTATE → something a coach can act on. Added 2026-09-09 (audit):
// before this, `error.message` went straight to the screen, so a coach could
// be shown "duplicate key value violates unique constraint
// \"drill_share_token_key\"" or "new row violates row-level security policy
// for table \"drill\"" — internals that name tables and constraints. Only the
// families the app can plausibly hit are mapped; anything else falls back to
// the caller's own message. The full raw error still goes to console.error
// below, so nothing is lost for debugging.
const MESSAGE_BY_SQLSTATE: Record<string, string> = {
  '23505': 'That already exists.',
  '23503': "That can't be changed while something else still depends on it.",
  '23514': "That value isn't allowed.",
  '23502': 'A required field is missing.',
  '42501': "You don't have permission to do that.",
  '57014': 'That took too long, try again.',
}

// P0001 is `raise exception` with no explicit errcode — every message an RPC
// in supabase/migrations raises on purpose ("this invite link is no longer
// valid", "You're the only admin of …") arrives with this code, and those
// are written for the coach, so they pass through verbatim. Everything else
// is Postgres or PostgREST talking, and is translated or replaced.
function userFacingMessage(error: PostgrestError, fallback: string): string {
  if (error.code === 'P0001') return error.message || fallback
  return (error.code && MESSAGE_BY_SQLSTATE[error.code]) || fallback
}

/**
 * Centralized wrapper around every Supabase read/write made from the store.
 * Every store action funnels its request through this function, so error
 * translation/logging behaves identically everywhere — no component ever
 * talks to Supabase directly or handles a PostgrestError itself. This is
 * also the one place a future multi-coach RLS denial gets handled (see
 * gaffer_project_plan_final.md §4.5).
 */
export async function runSupabaseAction<T>(
  action: () => PromiseLike<SupabaseCallResult<T>>,
  fallbackMessage: string = DEFAULT_ERROR_MESSAGE
): Promise<ActionOutcome<T>> {
  try {
    const { data, error } = await action()
    if (error) {
      console.error('[supabase]', error.code ?? '', error.message)
      return { data: null, error: userFacingMessage(error, fallbackMessage) }
    }
    return { data, error: null }
  } catch (err) {
    console.error('[supabase] unexpected error', err)
    return { data: null, error: fallbackMessage }
  }
}
