import type { PostgrestError } from '@supabase/supabase-js'

export type SupabaseCallResult<T> = { data: T | null; error: PostgrestError | null }

export interface ActionOutcome<T> {
  data: T | null
  error: string | null
}

const DEFAULT_ERROR_MESSAGE = "Couldn't save, try again."

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
      console.error('[supabase]', error.message)
      return { data: null, error: error.message || fallbackMessage }
    }
    return { data, error: null }
  } catch (err) {
    console.error('[supabase] unexpected error', err)
    return { data: null, error: fallbackMessage }
  }
}
