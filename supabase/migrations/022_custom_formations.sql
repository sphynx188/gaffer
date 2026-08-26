-- Migration 022 — custom formations, saved per coach
--
-- Stage 3.4 of TACTICS_BOARD_REWORK_PLAN.md ("Manage Formations", in scope for
-- v1): a coach drags a side into a shape they like and keeps it, alongside the
-- 29 built-ins that live in src/components/tactics/formations.ts.
--
-- Per COACH, not per team. A shape is a way of thinking about the game, not a
-- property of one squad — a coach running the same 4-2-3-1 with their U11s and
-- their U14s should save it once. That is why the table keys on `owner_id`
-- rather than `team_id`, and it is the first table in this schema to do so.
--
-- ── On the RLS, which does NOT reuse is_team_owner ────────────────────────
-- Stage 3.4's text says to reuse `is_team_owner`. That helper takes a
-- `check_team_id` and asks whether the caller is an owner-role member of THAT
-- TEAM (rls_policies.sql:36) — there is no team here to pass it. CLAUDE.md's
-- rule is that a new table's *membership* checks must reuse the helpers rather
-- than re-implementing them inline; this is not a membership check, it is
-- single-user ownership.
--
-- So the policy is `owner_id = (select auth.uid())`, which is exactly the
-- shape `team_insert_self_owner` already uses for the one other owner_id
-- column in the schema. The `(select auth.uid())` wrapper rather than a bare
-- call is deliberate and load-bearing: migration 006 changed every policy to
-- this form so Postgres hoists it into an InitPlan and evaluates it once per
-- statement instead of once per row.
--
-- `slots` is jsonb holding the same FormationSlot[] shape the built-ins use
-- ({ role, x, y }, normalized 0-1, home side attacking +x), so a custom
-- formation and a built-in are interchangeable everywhere downstream and
-- widening a slot never needs another migration.

create table formation (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  slots      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Every read is "my formations", so this is the index that matters.
create index on formation (owner_id);

alter table formation enable row level security;

-- Scoped `to authenticated`: an anon caller has no auth.uid(), so the policy
-- would be null rather than true and fail closed anyway — but 018 Part 1 is
-- the lesson that "fails closed today" is not a reason to leave the clause off.
create policy "formation_all_owner" on formation
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
