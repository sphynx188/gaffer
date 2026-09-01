-- 039_club_invite.sql — coach onboarding by INVITE TOKEN instead of by an
-- admin creating the login and choosing the password.
--
-- Why this exists (auth rework Phase 1):
--
-- `club_member`'s primary key is (club_id, user_id), so a membership could
-- not exist until the account did. That is the whole reason `create-coach`
-- (the edge function this replaces) had to mint the login itself with the
-- service-role key AND pick the coach's password — which the admin then read
-- out to them. Every admin therefore knew every coach's password, and nothing
-- ever rotated it.
--
-- It is also why third-party sign-in was useless to coaches: membership was
-- bound to an email an admin had typed, so a coach arriving via Google (or,
-- worse, Apple's Hide My Email relay address) authenticated as a DIFFERENT
-- user with no membership, and `App.tsx`'s "no memberships" branch pushed
-- them into creating a stray club instead of joining their own.
--
-- An invite decouples the two: the token carries the club binding, so the
-- identity a coach eventually authenticates with is irrelevant. Password,
-- Google and Apple all redeem the same invite equally well, and no email ever
-- has to match.
create table if not exists public.club_invite (
  -- 128-bit CSPRNG hex, minted by the same `mintShareToken()` the drill and
  -- tactic share links use (src/store/shareToken.ts). Reused rather than
  -- copied: it is the one function standing between a club and the open
  -- internet, and it must not exist twice and drift.
  token        text primary key,
  club_id      uuid not null references public.club(id) on delete cascade,
  role         text not null default 'coach' check (role in ('admin', 'coach')),
  -- What the admin wants this person called in the roster. Prefills the
  -- coach's own name field at redemption, so an invited coach still shows up
  -- correctly without the admin having to know their real name up front.
  display_name text,
  -- The admin's own record of who a link was meant for. Deliberately NOT used
  -- to authorize anything — matching on it is exactly the coupling this table
  -- exists to remove.
  invited_email text,
  created_by   uuid not null references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '14 days',
  redeemed_at  timestamptz,
  redeemed_by  uuid references auth.users(id) on delete set null
);

create index if not exists club_invite_club_idx on public.club_invite (club_id);

alter table public.club_invite enable row level security;

-- Admins manage their own club's invites. There is deliberately NO anon or
-- authenticated read policy: the pre-auth path goes through
-- `peek_club_invite` below, which is security definer and returns only a club
-- name. That is strictly tighter than the `drill_shared_read` (018) shape,
-- because the client never needs to read a row from this table at all.
create policy club_invite_admin_read on public.club_invite
  for select to authenticated using (public.is_club_admin(club_id));

create policy club_invite_admin_insert on public.club_invite
  for insert to authenticated with check (public.is_club_admin(club_id) and created_by = (select auth.uid()));

create policy club_invite_admin_delete on public.club_invite
  for delete to authenticated using (public.is_club_admin(club_id));

-- What the /join/:token screen shows BEFORE anyone signs in: enough to tell
-- the visitor which club they are joining and in what role, and nothing else.
-- No member list, no email, no ids. Guessing a token is a 128-bit search, so
-- there is nothing to enumerate.
--
-- Returns zero rows for a token that is unknown, expired or already redeemed,
-- so the join screen renders one "this link is no longer valid" state without
-- having to distinguish cases it should not leak anyway.
create or replace function peek_club_invite(invite_token text)
returns table (club_name text, role text)
language sql stable security definer set search_path = '' as $$
  select c.name, i.role
  from public.club_invite i
  join public.club c on c.id = i.club_id
  where i.token = invite_token
    and i.redeemed_at is null
    and i.expires_at > now();
$$;

-- Redeems an invite for whoever is signed in RIGHT NOW, whatever provider
-- they used. `club_member_admin_insert` (028) only lets an admin write this
-- table, and an invited coach is by definition not one yet, so this has to be
-- security definer.
--
-- The explicit `caller is null` check comes FIRST and is not optional — see
-- 036: `auth.uid()` is NULL for an anon caller, and a comparison against NULL
-- inside an `IF` falls through without raising, which is precisely how the
-- first version of `update_club_member_name` shipped an unauthenticated hole.
--
-- Idempotent on purpose: a double-tap, a second tab, or a redeem that races
-- its own page reload must not fail the coach out of their club. The insert
-- absorbs the duplicate on (club_id, user_id) and the update only fires while
-- the invite is still unredeemed, so the second call returns the same club id
-- and changes nothing.
create or replace function redeem_club_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := (select auth.uid());
  inv    public.club_invite;
begin
  if caller is null then
    raise exception 'not signed in';
  end if;

  -- FOR UPDATE so two concurrent redemptions of the same link serialise
  -- rather than both passing the `redeemed_at is null` test.
  select * into inv from public.club_invite
    where token = invite_token
      and redeemed_at is null
      and expires_at > now()
    for update;

  if not found then
    -- Already a member from an earlier redeem of this same link? Then this is
    -- the harmless repeat case, not a failure — return the club rather than
    -- erroring a coach out of a club they are already in.
    select i.* into inv from public.club_invite i
      where i.token = invite_token and i.redeemed_by = caller;
    if found then
      return inv.club_id;
    end if;
    raise exception 'this invite link is no longer valid';
  end if;

  insert into public.club_member (club_id, user_id, role, display_name)
  values (inv.club_id, caller, inv.role, nullif(trim(inv.display_name), ''))
  on conflict (club_id, user_id) do nothing;

  update public.club_invite
    set redeemed_at = now(), redeemed_by = caller
    where token = invite_token and redeemed_at is null;

  return inv.club_id;
end $$;
