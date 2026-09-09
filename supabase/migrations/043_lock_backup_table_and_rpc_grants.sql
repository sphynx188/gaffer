-- 043_lock_backup_table_and_rpc_grants.sql — two hardening fixes from the
-- 2026-09-09 pre-deployment security audit.
--
-- 1. `_keyframe_grid_backup_20260902` (041's restore point) was created with
--    `create table ... as select`, which on Supabase means RLS OFF and the
--    default grants — anon had SELECT/INSERT/UPDATE/DELETE/TRUNCATE on it, and
--    the audit read rows from it over PostgREST with nothing but the public
--    anon key. Enabling RLS with no policies locks it to everyone except the
--    `postgres` role that would run 041's restore statement, and revoking the
--    table grants is the second lock (same belt-and-braces reasoning as 042).
--    Not dropped: HANDOFF still says to keep it until the grid has had real
--    use. Drop it in a later migration when that day comes.
--
-- 2. Five RPCs that only a signed-in coach ever calls were executable by
--    `anon` through Supabase's default function grants. Each already refuses
--    an anonymous caller on its first line, so this changes no behaviour —
--    it makes the privilege match the intent. Deliberately NOT touched: the
--    RLS helpers (is_*, can_read_collection, *_in_readable_collection) and
--    `peek_club_invite`. The helpers are evaluated inside policies as the
--    querying role, so anon needs EXECUTE on them or every anon SELECT
--    errors instead of returning zero rows (that regression already happened
--    once — see migration `fix_anon_rls_helper_grant_regression`), and
--    peek_club_invite is called by /join/:token BEFORE sign-in by design.
--    Verified against pg_policies before writing this: none of the five is
--    referenced by any policy.

alter table public._keyframe_grid_backup_20260902 enable row level security;
revoke all on table public._keyframe_grid_backup_20260902 from anon, authenticated;

revoke execute on function public.create_club(text) from public, anon;
revoke execute on function public.delete_club(uuid) from public, anon;
revoke execute on function public.copy_collection_to_club(uuid, uuid) from public, anon;
revoke execute on function public.update_club_member_name(uuid, uuid, text) from public, anon;
revoke execute on function public.redeem_club_invite(text) from public, anon;

grant execute on function public.create_club(text) to authenticated;
grant execute on function public.delete_club(uuid) to authenticated;
grant execute on function public.copy_collection_to_club(uuid, uuid) to authenticated;
grant execute on function public.update_club_member_name(uuid, uuid, text) to authenticated;
grant execute on function public.redeem_club_invite(text) to authenticated;
