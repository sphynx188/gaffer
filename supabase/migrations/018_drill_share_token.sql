-- Migration 018 — drill.share_token, and closing the anon hole that made it unsafe
--
-- Stage 10.4 of DRILL_CREATOR_REWORK_PLAN.md: a public read-only `/d/:token`
-- route so a coach can text an assistant a link that animates, mirroring
-- Teloframe's Player Explanation. The plan's own warning on this item — "this
-- publishes drill content on a guessable-if-short URL — use a 128-bit token and
-- make sharing explicitly opt-in per drill" — is what shapes everything below.
--
-- ── Part 1: the pre-existing hole (fix this first, or none of Part 2 means
--    anything) ──────────────────────────────────────────────────────────────
--
-- `drill_all_members_or_unscoped` in rls_policies.sql was created with no `to`
-- clause, so it applies to the `public` role — which includes `anon`. Its
-- USING clause is `team_id is null or is_team_member(team_id)`. For an
-- unauthenticated caller `is_team_member` is false, but `team_id is null` is
-- simply TRUE, so every coach-owned drill was readable — and, since the policy
-- is `for all` with the same WITH CHECK, writable — by anyone holding the anon
-- key. That key ships in the browser bundle; it is not a secret.
--
-- Verified live before writing this, not inferred: inserting a `team_id is
-- null` drill and selecting it back under `set local role anon` returned the
-- row. The probe row was deleted immediately. No drill in the project is
-- currently team_id-null, so nothing is exposed today — this was latent, armed
-- by the first coach-owned drill anyone creates.
--
-- The fix is the `to authenticated` this policy should always have carried.
-- Nothing about the app's behaviour changes: every caller in `src/` is a
-- signed-in coach. This is deliberately fixed here rather than left for later,
-- because Stage 10.4 adds the project's first anon-reachable surface and
-- "sharing is opt-in per drill" is false while anon can already read drills
-- nobody opted into.
--
-- ── Part 2: the share token ───────────────────────────────────────────────
--
-- `share_token` is null until a coach explicitly turns sharing on, and null
-- again the moment they turn it off — opt-in per drill, revocable, exactly as
-- the plan asks. Tokens are 128 bits from `crypto.getRandomValues`, rendered as
-- 32 hex characters (see drillSlice.enableDrillSharing).
--
-- The anon policy is the plan's "public-select policy scoped to non-null
-- tokens", tightened with one extra conjunct: the reader must actually present
-- the token. Scoped to non-null alone, `select * from drill` as anon returns
-- EVERY shared drill — so anyone holding one share link could enumerate all the
-- others, which is not what "opt-in per drill" is supposed to buy. Matching the
-- token against the request header means a reader gets exactly the drill they
-- have a link for and nothing else. Absent header → `->>` yields null →
-- `share_token = null` is null, not true → no rows. It fails closed.

-- ── Part 1 ────────────────────────────────────────────────────────────────
drop policy "drill_all_members_or_unscoped" on drill;

create policy "drill_all_members_or_unscoped" on drill
  for all to authenticated
  using (
    team_id is null or is_team_member(team_id)
  )
  with check (
    team_id is null or is_team_member(team_id)
  );

-- ── Part 2 ────────────────────────────────────────────────────────────────
alter table drill add column share_token text;

-- Unique so a token always identifies at most one drill, and partial so the
-- many un-shared drills (all null) don't collide with each other.
create unique index drill_share_token_key on drill (share_token)
  where share_token is not null;

create policy "drill_shared_read" on drill
  for select to anon
  using (
    share_token is not null
    and share_token = current_setting('request.headers', true)::json->>'x-share-token'
  );
