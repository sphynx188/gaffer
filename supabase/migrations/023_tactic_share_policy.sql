-- Migration 023 — the anon read policy behind /t/:token
--
-- TACTICS_BOARD_REWORK_PLAN.md Stage 8.2, and the thing that stage says
-- "genuinely matters": a shared tactic is a real squad's shape, so the policy
-- must grant read on EXACTLY ONE ROW BY TOKEN and nothing else.
--
-- Migration 020 added `tactic.share_token` and its partial unique index, and
-- deliberately left the policy for this migration — "adding an anon-reachable
-- policy now would open a public surface that nothing in src/ can even use."
-- The sharing UI that mints these tokens ships with this file.
--
-- This mirrors migration 018 in BOTH its parts, because 018's two parts are
-- one idea: do not open a new anon surface next to an old policy that already
-- applies to anon.
--
-- ── Part 1: `to authenticated` on the members policy ──────────────────────
--
-- `tactic_all_members` (migration 012) was created with no `to` clause, so it
-- applies to the `public` role — which includes `anon`. Unlike drill's, it
-- carries no `team_id is null` escape hatch: `tactic.team_id` is NOT NULL and
-- `is_team_member` is false for an unauthenticated caller, so it already fails
-- closed and no tactic is currently exposed. Verified before writing this, not
-- inferred (see the checks recorded at the foot of this file).
--
-- So this half changes no behaviour at all. It is here because leaving a `for
-- all` policy pointed at a role that is about to become a real caller is how
-- 018 Part 1's hole existed in the first place — the next person to add a
-- nullable scope column to `tactic` should not be one edit away from
-- republishing every tactic. Every caller in `src/` is a signed-in coach.
--
-- ── Part 2: the share policy ──────────────────────────────────────────────
--
-- Scoped to non-null tokens AND to a reader who actually presents the token,
-- exactly as `drill_shared_read` is. The second conjunct is the one that
-- matters: scoped to non-null alone, `select * from tactic` as anon returns
-- EVERY shared tactic, so one share link would enumerate all the others.
-- Matching against the request header means a reader gets the single tactic
-- they hold a link for.
--
-- It fails closed in every direction:
--   * no header            -> `->>` yields null -> `share_token = null` is
--                             null, not true -> no rows.
--   * wrong/stale token    -> no row matches -> no rows.
--   * sharing switched off -> share_token set back to null -> excluded by the
--                             first conjunct, so revocation is immediate.
--   * `select` only        -> anon cannot write, and there is no `with check`.
--
-- ── What this deliberately does NOT open ──────────────────────────────────
--
-- No anon policy on `player`. A tactic's entities carry `player_id` and the
-- squad NUMBER, but the roster NAME is never denormalised into `tactic.scene`
-- (SquadPanel resolves names from `rostersByTeam` at render time), so the
-- shared page renders numbers and roles and cannot resolve a name even if it
-- wanted to. `player_all_members` stays `is_team_member(team_id)`, which is
-- false for anon. A share link therefore exposes the tactic row and nothing
-- else in the account — no roster, no other tactic, no team.

-- ── Part 1 ────────────────────────────────────────────────────────────────
drop policy "tactic_all_members" on tactic;

create policy "tactic_all_members" on tactic
  for all to authenticated
  using (is_team_member(team_id))
  with check (is_team_member(team_id));

-- ── Part 2 ────────────────────────────────────────────────────────────────
create policy "tactic_shared_read" on tactic
  for select to anon
  using (
    share_token is not null
    and share_token = current_setting('request.headers', true)::json->>'x-share-token'
  );

-- ── APPLIED 2026-08-26, and verified by hand as Stage 8.2 requires ────────
--
-- Every probe below ran against the live project inside a transaction that was
-- ROLLED BACK, so no tactic was really shared to run them. Two tactics were
-- given tokens at once for probes 1-5, because the failure this policy exists
-- to prevent is one link revealing the other.
--
--   BEFORE APPLYING
--   0. anon, no token, `select count(*) from tactic`  -> 0
--      (confirms Part 1 changed no behaviour: the members policy already
--       failed closed for anon, as migration 020's note claimed)
--
--   AFTER APPLYING — reader presents token A, while tactics A and B are both
--   shared:
--   1. select * from tactic   -> exactly one row, the A tactic. NOT B.
--   2. select * from player   -> 0
--   3. select * from team     -> 0
--   4. select * from session  -> 0
--   5. select * from drill    -> 0
--
--   NEGATIVE CASES
--   6. no x-share-token header at all        -> 0 rows
--   7. token differing in its last character -> 0 rows
--   8. empty-string token                    -> 0 rows
--
--   WRITE ATTEMPTS by a reader holding a VALID link
--   9.  update tactic ... -> matched 0 rows (the policy is `for select`, so
--       the row is invisible to UPDATE's own row scan)
--   10. delete from tactic ... -> matched 0 rows
--   11. insert into tactic ... -> refused: "new row violates row-level
--       security policy for table tactic"
--   12. the row's name afterwards -> unchanged
--   13. tactic row count afterwards -> unchanged (4)
--
-- Re-verified over real HTTP through the anon key, not only in SQL — see
-- HANDOFF.md's Stage 8 entry for the private-window walkthrough and the
-- neighbouring-token 404.
