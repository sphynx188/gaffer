-- Gaffer database schema
-- Source of truth: gaffer_project_plan_final.md §5 / gaffer_mvp_build_steps.md 0.2
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query) on a
-- fresh project, top to bottom, once.
--
-- IMPORTANT: this script only creates the schema. RLS is NOT enabled here —
-- that is Phase 0.3. Until RLS policies are written and enabled, every table
-- below is readable/writable by anyone holding the project's anon key (that's
-- how Supabase/PostgREST works by default). Do not share the deployed URL or
-- commit real data until 0.3 is done.

-- ── Enums ───────────────────────────────────────────────────────────────

create type pitch_format as enum ('11v11', 'small_sided');
create type coach_role as enum ('owner', 'coach');
create type availability_status as enum ('available', 'unavailable', 'unconfirmed');

-- ── Tables (created in FK-dependency order) ────────────────────────────────

create table team (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  format     pitch_format not null,
  owner_id   uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create table team_coaches (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references team (id) on delete cascade,
  user_id    uuid not null references auth.users (id),
  role       coach_role not null default 'coach',
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table player (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references team (id) on delete cascade,
  name         text not null,
  position     text,
  dob          date,
  squad_number smallint,
  created_at   timestamptz not null default now()
);

create table player_notes (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references player (id) on delete cascade,
  author_id  uuid not null references auth.users (id),
  body       text not null,
  created_at timestamptz not null default now()
);

create table session (
  id               uuid primary key default gen_random_uuid(),
  team_id          uuid not null references team (id) on delete cascade,
  date             date not null,
  duration_minutes integer not null,
  physical_load    smallint check (physical_load between 1 and 5),
  equipment        text,
  coaching_notes   text,
  season_label     text,
  created_at       timestamptz not null default now()
);

create table availability (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references session (id) on delete cascade,
  player_id    uuid not null references player (id) on delete cascade,
  status       availability_status not null default 'unconfirmed',
  reason       text,
  responded_at timestamptz,
  unique (session_id, player_id)
);

create table drill (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid references team (id) on delete cascade, -- nullable: null = coach-owned, reusable across every team
  name         text not null,
  pitch_format pitch_format not null,
  phases       jsonb not null default '[]'::jsonb,
  created_at   timestamptz not null default now()
);

create table session_drills (
  id                       uuid primary key default gen_random_uuid(),
  session_id               uuid not null references session (id) on delete cascade,
  drill_id                 uuid not null references drill (id) on delete cascade,
  order_index              integer not null,
  planned_duration_minutes integer,
  notes                    text
);

-- ── Indexes on FK columns (RLS joins + list-view filters will hit these) ──

create index on team_coaches (team_id);
create index on team_coaches (user_id);
create index on player (team_id);
create index on player_notes (player_id);
create index on session (team_id);
create index on availability (session_id);
create index on availability (player_id);
create index on drill (team_id);
create index on session_drills (session_id);
create index on session_drills (drill_id);

-- ── Auto-seed team_coaches when a team is created ──────────────────────────
-- Build guide 0.2 step 5: "Seed yourself as a row in team_coaches the moment
-- you create your first team." Implemented as a trigger so it's automatic
-- for every team, not just the first.

create function public.handle_new_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into team_coaches (team_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger on_team_created
  after insert on team
  for each row
  execute function public.handle_new_team();

-- ── Enable RLS (policies come in Phase 0.3) ────────────────────────────────
-- RLS on with zero policies = fully locked down (nobody gets access via the
-- anon/authenticated PostgREST roles) until 0.3 adds real policies. Queries
-- run from the SQL editor still work for manual testing below, since those
-- execute as the privileged postgres role and bypass RLS entirely.

alter table team           enable row level security;
alter table team_coaches   enable row level security;
alter table player         enable row level security;
alter table player_notes   enable row level security;
alter table session        enable row level security;
alter table availability   enable row level security;
alter table drill          enable row level security;
alter table session_drills enable row level security;
