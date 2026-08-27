-- 027_club_tenancy.sql — club tenancy core (spec §4). Additive only.
-- Backfill role recon (Task 0, 2026-08-28): team_coaches.role has exactly one
-- distinct value, 'owner' — used as-is below, no substitution needed.
-- Backfill probe results (recorded after apply, confirmed via execute_sql):
--   drill_nulls=0, drills=17 (matches recon prediction 8+9); tactic_nulls=0,
--   tactics=5 (matches recon prediction 3+2). Three 'My Club' rows created,
--   one per team-owning account (club_member.role='admin' in each, 1:1):
--   7db7f9b6.. -> 4ba4e69f.. (0 drills/tactics, owns 2 empty teams)
--   502de2cf.. -> a88ff958.. (maxburatto68@gmail.com, legacy admin, 8/3)
--   88482373.. -> e13c5237.. (gaffertest2026v2@gmail.com, test account, 9/2)

create table club (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table club_member (
  club_id uuid not null references club(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin','coach')),
  display_name text,
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index club_member_user_id_idx on club_member (user_id);

create table collection (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references club(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create index collection_club_id_idx on collection (club_id);

create table collection_drill (
  collection_id uuid not null references collection(id) on delete cascade,
  drill_id uuid not null references drill(id) on delete cascade,
  primary key (collection_id, drill_id)
);
create index collection_drill_drill_id_idx on collection_drill (drill_id);

create table collection_tactic (
  collection_id uuid not null references collection(id) on delete cascade,
  tactic_id uuid not null references tactic(id) on delete cascade,
  primary key (collection_id, tactic_id)
);
create index collection_tactic_tactic_id_idx on collection_tactic (tactic_id);

create table collection_access (
  collection_id uuid not null references collection(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (collection_id, user_id)
);
create index collection_access_user_id_idx on collection_access (user_id);

create table club_license (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references collection(id) on delete cascade,
  target_club_id uuid not null references club(id) on delete cascade,
  granted_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index club_license_collection_id_idx on club_license (collection_id);
create index club_license_target_club_id_idx on club_license (target_club_id);

-- Default-deny until 028's policies land:
alter table club enable row level security;
alter table club_member enable row level security;
alter table collection enable row level security;
alter table collection_drill enable row level security;
alter table collection_tactic enable row level security;
alter table collection_access enable row level security;
alter table club_license enable row level security;

-- Documents join the club world. team_id on drill is DEMOTED, not dropped
-- (spec v2.1): shelved dormant components still reference it.
alter table drill add column club_id uuid references club(id);
alter table drill add column created_by uuid default auth.uid();
alter table tactic add column club_id uuid references club(id);
alter table tactic add column created_by uuid default auth.uid();
alter table tactic alter column team_id drop not null;

-- Backfill: one club per team-owning account; their documents follow.
do $$
declare o record; cid uuid;
begin
  for o in select distinct tc.user_id from team_coaches tc where tc.role = 'owner'
  loop
    insert into club (name) values ('My Club') returning id into cid;
    insert into club_member (club_id, user_id, role) values (cid, o.user_id, 'admin');
    update drill d set club_id = cid, created_by = o.user_id
      where d.club_id is null and d.team_id in (
        select t.id from team t
        join team_coaches x on x.team_id = t.id and x.role = 'owner'
        where x.user_id = o.user_id);
    update tactic tt set club_id = cid, created_by = o.user_id
      where tt.club_id is null and tt.team_id in (
        select t.id from team t
        join team_coaches x on x.team_id = t.id and x.role = 'owner'
        where x.user_id = o.user_id);
  end loop;
end $$;

-- Coach-wide drills (team_id null) belong to the legacy primary account.
-- Recon (Task 0, 2026-08-28) confirmed this is a no-op on current data (0
-- drills have team_id is null) — kept as a correct safety net regardless.
update drill d set
  club_id = (select cm.club_id from club_member cm
             join auth.users u on u.id = cm.user_id
             where u.email = 'maxburatto68@gmail.com' and cm.role = 'admin' limit 1),
  created_by = (select id from auth.users where email = 'maxburatto68@gmail.com')
where d.club_id is null;

alter table drill alter column club_id set not null;
alter table drill alter column created_by set not null;
alter table tactic alter column club_id set not null;
alter table tactic alter column created_by set not null;
create index drill_club_id_idx on drill (club_id);
create index drill_created_by_idx on drill (created_by);
create index tactic_club_id_idx on tactic (club_id);
create index tactic_created_by_idx on tactic (created_by);
