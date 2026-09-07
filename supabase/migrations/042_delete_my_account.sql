-- 042_delete_my_account.sql — the account-deletion path (iOS plan stage 14, Q13;
-- referenced, not duplicated, by gaffer-macos-build-plan.md stage 14).
--
-- Both native apps ship outside a browser and need a deletion path a person can
-- actually reach. This is that path, and it is deliberately an RPC rather than a
-- client-side sequence of deletes: the caller must not be able to choose WHICH of
-- the steps below run, and half of them touch rows RLS would never let a coach
-- delete directly.
--
-- What it does, and the three things it deliberately does NOT do:
--
--   1. Refuses if the caller is the sole admin of a club that still has other
--      members. Letting that through would strand a club with coaches in it and
--      nobody who can add, remove or license anything — an unrecoverable state,
--      because `is_club_admin` is the only way back in. The client shows the
--      message verbatim (see the `hint` note below).
--   2. Leaves every drill, tactic and collection they created IN PLACE. This is
--      free by construction: `drill.created_by`, `tactic.created_by` and
--      `collection.created_by` are plain uuid columns with NO foreign key to
--      `auth.users` (027 added them that way), so the rows survive their author
--      and stay readable through `club_id`, which is what the club actually
--      reads them by.
--   3. Deletes the auth user last, so a failure anywhere above leaves the
--      account intact rather than half-deleted.
--
-- ── The shelved team module is the whole difficulty here ────────────────────
--
-- `team_id` was DEMOTED, not dropped, by 027, and three FKs to `auth.users`
-- survive from that era with ON DELETE NO ACTION rather than CASCADE:
-- `team.owner_id`, `team_coaches.user_id` and `player_notes.author_id`. Any one
-- of them BLOCKS `delete from auth.users` outright, so on this database the
-- naive version of this function fails with a foreign-key violation for every
-- legacy account — which is every account that predates club tenancy.
--
-- The obvious fix is the dangerous one. `drill.team_id` and `tactic.team_id`
-- reference `team` ON DELETE **CASCADE**, so deleting the caller's teams to
-- clear the block would take every board still carrying that `team_id` with
-- them. On this database that is 9 drills and 2 tactics belonging to the test
-- club — i.e. the naive fix silently destroys exactly what point 2 above
-- promises to preserve, and it would do it to the club, not just to the leaver.
--
-- So the team rows are SEVERED before they are removed: `team_id` is nulled on
-- the boards first (both columns are nullable — 027 dropped the not-null on
-- `tactic.team_id`, and coach-wide drills already had it null), which drops the
-- vestigial link the shelved module owns while leaving `club_id`, the live one,
-- untouched. The team's own dormant contents (players, sessions, availability)
-- do cascade, and should: they are the leaver's roster, not the club's library.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  blocked_club text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  -- The guard. "Sole admin" is per club and only bites when someone else is
  -- still in the room: a club where the leaver is the only member at all is
  -- theirs alone to walk away from.
  select c.name into blocked_club
  from public.club_member me
  join public.club c on c.id = me.club_id
  where me.user_id = uid
    and me.role = 'admin'
    and (select count(*) from public.club_member a
          where a.club_id = me.club_id and a.role = 'admin') = 1
    and (select count(*) from public.club_member m
          where m.club_id = me.club_id) > 1
  limit 1;

  if blocked_club is not null then
    -- The message is the copy: `supabaseAction.ts` and `SupabaseAction.swift`
    -- both show an RPC's own text verbatim (only RLS/constraint SQLSTATEs get
    -- replaced with caller wording), so this sentence is what the coach reads.
    -- The machine-readable half rides in `hint`, which PostgREST returns in the
    -- body and both clients keep: a client that wants to branch on this case
    -- matches 'sole_admin' rather than parsing English. Deliberately NOT a
    -- custom SQLSTATE — PostgREST maps unknown codes to HTTP 500, where the
    -- default `raise exception` (P0001) is the 400 this actually is.
    raise exception
      'You''re the only admin of %. Make another coach an admin, or remove the others, before deleting your account.',
      blocked_club
      using hint = 'sole_admin';
  end if;

  -- Shelved team module: sever the vestigial link, THEN remove the rows that
  -- block the auth delete. Order matters — see the header.
  update public.drill set team_id = null
    where team_id in (select id from public.team where owner_id = uid);
  update public.tactic set team_id = null
    where team_id in (select id from public.team where owner_id = uid);
  delete from public.player_notes where author_id = uid;
  delete from public.team_coaches where user_id = uid;
  delete from public.team where owner_id = uid;

  -- The club world. Both of these already cascade off `auth.users`; doing them
  -- explicitly means the function states its own contract instead of depending
  -- on an FK action someone could change later without reading this file.
  delete from public.club_invite where created_by = uid;
  delete from public.club_member where user_id = uid;

  -- Untouched on purpose: `club_invite.invited_email`. Matching on it would
  -- re-introduce exactly the email/identity coupling 039 exists to remove, and
  -- an invite an admin addressed to someone is the ADMIN's row to revoke.

  delete from auth.users where id = uid;
end $$;

-- Never anon: this is the one function in the schema whose whole job is to
-- destroy the caller's identity, and an anonymous caller has none.
--
-- `from public` alone is NOT enough here, which is worth stating because the
-- rest of this schema gets it wrong quietly. Supabase's default privileges
-- grant EXECUTE on every new function in `public` to `anon`, `authenticated`
-- and `service_role` DIRECTLY, so revoking the PUBLIC grant leaves the anon
-- grant sitting there untouched — verified on this database after the first
-- apply, where the grantee list still read `{anon, authenticated, ...}`. The
-- `not signed in` guard above means an anon call fails anyway; this is the
-- second lock, so the privilege matches the intent rather than relying on the
-- function's own first line forever.
revoke execute on function public.delete_my_account() from public;
revoke execute on function public.delete_my_account() from anon;
grant execute on function public.delete_my_account() to authenticated;
