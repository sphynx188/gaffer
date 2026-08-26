// The share-link token minter, shared by drillSlice and tacticSlice
// (TACTICS_BOARD_REWORK_PLAN.md Stage 8.2).
//
// Extracted rather than copied into the second slice: this is the only thing
// standing between a drill or a tactic and the open internet once a coach opts
// in, so it is exactly the function that must not exist twice and drift.
//
// `crypto.getRandomValues` rather than `Math.random` — Math.random is not a
// CSPRNG in any engine. 128 bits, rendered as 32 hex characters, matching the
// `x-share-token` values migrations 018 and 023 match against.
export function mintShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}
