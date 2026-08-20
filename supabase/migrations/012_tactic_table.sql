-- Upgrade Phase 3 (UPGRADE_IMPLEMENTATION_PLAN.md): new Tactic Creator
-- feature. Unlike `drill`, tactics are always team-specific — no
-- coach-owned/unscoped case, so `team_id` is not null (compare drill's
-- nullable team_id + its "unscoped means reusable" RLS carve-out).
--
-- `board` mirrors the shape of a single drill phase but scoped to just
-- what a static tactic needs: players (linked to real roster players via
-- player_id, not a freeform team label like a drill's PhasePlayer),
-- arrows, and annotations — no cones/balls, per the roadmap's "static
-- tactical diagram" scope for v1.

create table tactic (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references team (id) on delete cascade,
  name       text not null,
  board      jsonb not null default '{"players":[],"arrows":[],"annotations":[]}'::jsonb,
  created_at timestamptz not null default now()
);

create index on tactic (team_id);

alter table tactic enable row level security;

-- Simpler than drill's policy (supabase/rls_policies.sql) — no nullable
-- team_id/unscoped case to carve out, so this is the same
-- always-team-scoped shape as `session`'s and `player`'s policies. Reuses
-- the `is_team_member` helper defined once in rls_policies.sql.
create policy "tactic_all_members" on tactic
  for all using (is_team_member(team_id))
  with check (is_team_member(team_id));
