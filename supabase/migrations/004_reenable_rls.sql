-- Migration 004 — Re-enable RLS (Phase 0.5.2)
--
-- Context: RLS was disabled table-by-table on 2026-08-18 (DB migrations
-- temp_disable_rls_team_diagnostic, temp_disable_rls_remaining_tables) as a
-- temporary unblock after every authenticated write (direct insert AND
-- RPC-wrapped) failed RLS's WITH CHECK evaluation with 42501 on both Gaffer
-- projects, despite the schema/policies/JWT all checking out correct under
-- manual SQL simulation. See gaffer_mvp_build_steps.md Phase 0.5.2 for the
-- full story. The policies created by rls_policies.sql were never dropped —
-- this migration is a pure re-enable, not a rebuild.
--
-- Companion rollback: ../disable_rls.sql. If writes start 42501'ing again
-- after this runs, run that file to instantly flip back to the
-- known-working disabled state — no need to re-derive anything under
-- pressure. It is the exact inverse of this file's first block (and doesn't
-- touch the grants below, so re-running this file later is a clean re-apply).
--
-- Safe to re-run: ENABLE ROW LEVEL SECURITY and REVOKE/GRANT are all
-- idempotent no-ops if already in the target state.

-- ── Re-enable RLS on all 8 tables ──────────────────────────────────────────

alter table team           enable row level security;
alter table team_coaches   enable row level security;
alter table player         enable row level security;
alter table player_notes   enable row level security;
alter table session        enable row level security;
alter table availability   enable row level security;
alter table drill          enable row level security;
alter table session_drills enable row level security;

-- ── Tighten SECURITY DEFINER helper function grants ────────────────────────
-- `create function` grants EXECUTE to PUBLIC by default in Postgres, so the
-- security advisor flags is_team_member/is_team_owner/handle_new_team as
-- directly callable by anon and authenticated via /rest/v1/rpc/<fn>.
--
-- handle_new_team is only ever fired by the on_team_created trigger, never
-- called directly by any role, and is not referenced by any RLS policy —
-- safe to revoke from everyone.
--
-- is_team_member / is_team_owner are different: every membership-based
-- policy in rls_policies.sql calls one of them from its USING/WITH CHECK
-- clause, and Postgres checks EXECUTE privilege for whichever role is
-- running the query the policy is attached to — not just direct RPC
-- callers. That means BOTH anon and authenticated need to keep EXECUTE, or
-- an anon-role query against any policy-protected table (e.g. the app
-- querying before a magic-link session resolves) throws a hard
-- "permission denied for function is_team_member" instead of gracefully
-- returning zero rows. Revoking anon's grant here was tried and reverted
-- (see migration fix_anon_rls_helper_grant_regression) — it doesn't add
-- real security, since auth.uid() is always null for anon so the function
-- already returns false, but it does break graceful degradation. The
-- security advisor's WARN on these two functions is an accepted, understood
-- false positive — do not "fix" it by revoking anon/authenticated again.

revoke execute on function public.is_team_member(uuid) from public;
revoke execute on function public.is_team_owner(uuid) from public;
revoke execute on function public.handle_new_team() from public;

grant execute on function public.is_team_member(uuid) to anon, authenticated;
grant execute on function public.is_team_owner(uuid) to anon, authenticated;
-- handle_new_team gets no grants — trigger-only, invoked via its owner's
-- privileges regardless of caller.
