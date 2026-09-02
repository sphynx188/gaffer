// The /join/:token half of invite onboarding (migration 039).
//
// Deliberately NOT part of `clubSlice`: `peekInvite` runs before anyone is
// signed in, when there is no club, no membership and no store state to scope
// against — the whole point of the screen it feeds is that it renders for a
// visitor who does not have an account yet. Keeping both calls here means the
// join screen never has to reach into a slice whose invariants assume a
// signed-in coach with a selected club.
import { supabase } from '../lib/supabase'
import type { ClubInvitePreview } from './types'

// What the join screen shows before sign-in: which club, and in what role.
// Returns null for a token that is unknown, expired or already redeemed —
// `peek_club_invite` returns zero rows for all three, so they collapse into
// one "this link is no longer valid" state rather than telling a stranger
// which of the three it was.
export async function peekInvite(token: string): Promise<ClubInvitePreview | null> {
  const { data, error } = await supabase.rpc('peek_club_invite', { invite_token: token })
  if (error || !data || data.length === 0) return null
  return data[0] as ClubInvitePreview
}

// Redeems for whoever is signed in right now, whatever provider they used —
// that indifference is the entire reason the invite carries a token rather
// than an email. Returns the club id joined, or an error message to show.
//
// Safe to call more than once: `redeem_club_invite` is idempotent, so a
// double-tap or a reload mid-redeem returns the same club instead of failing
// the coach out of a club they are already in.
export async function redeemInvite(token: string): Promise<{ clubId: string } | { error: string }> {
  const { data, error } = await supabase.rpc('redeem_club_invite', { invite_token: token })
  if (error) return { error: error.message || "Couldn't join the club, try again." }
  if (!data) return { error: 'this invite link is no longer valid' }
  return { clubId: data as string }
}

// Where an invite link points. Built in one place so the Coaches tab (which
// copies it) and the router (which parses it) can't drift.
export function inviteUrl(token: string): string {
  return `${window.location.origin}/join/${token}`
}
