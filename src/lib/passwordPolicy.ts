// The password rule, stated once (2026-09-02).
//
// It has to agree with the Supabase project's own Auth settings — minimum
// length 8, requiring lowercase, uppercase and a digit — because Supabase is
// what actually enforces it. When the two disagree the client is the one that
// looks broken: the form accepts the password, the request goes out, and the
// coach gets a raw server error on submit for something the field could have
// told them while they were typing.
//
// One module rather than the numbers inlined per input: there are four
// password fields across Login and ResetPassword, and the previous "6" was
// already written into two placeholders and four `minLength` attributes.
// That is the same shape of duplication that let `canEditDoc`'s rule drift
// into seven copies — cheap to centralise now, annoying later.
//
// Deliberately NOT a strength meter or a leaked-password check. Supabase's
// HaveIBeenPwned integration is a Pro feature and is off on this project;
// this is the free tier's substitute, and pretending to score entropy on top
// of it would be theatre.

export const PASSWORD_MIN_LENGTH = 8

/** Shown under the field before anything is typed — the rule, not an error. */
export const PASSWORD_HINT = '8+ characters, with a capital, a lowercase and a number'

/** Placeholder copy, kept in step with the hint above. */
export const PASSWORD_PLACEHOLDER = 'At least 8 characters'

/**
 * Returns a message naming what is MISSING, or null when the password passes.
 *
 * Names the specific gap ("needs a capital letter") rather than restating the
 * whole rule, because a coach who typed nine lowercase letters already knows
 * it is long enough — repeating the full policy back at them makes them
 * re-check the parts they got right.
 */
export function validatePassword(password: string): string | null {
  const missing: string[] = []
  if (password.length < PASSWORD_MIN_LENGTH) missing.push(`${PASSWORD_MIN_LENGTH} characters or more`)
  if (!/[a-z]/.test(password)) missing.push('a lowercase letter')
  if (!/[A-Z]/.test(password)) missing.push('a capital letter')
  if (!/[0-9]/.test(password)) missing.push('a number')
  if (missing.length === 0) return null

  // "needs a capital letter and a number" reads better than a comma list of
  // two, and the three-item case still needs the Oxford-less join.
  const list =
    missing.length === 1
      ? missing[0]
      : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`
  return `Your password needs ${list}.`
}
