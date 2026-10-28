# Drill Collections and Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every drill is filed under exactly one collection chosen when it's created, can carry any number of club-wide tags, and the library is browsed by collection and narrowed by tags.

**Architecture:** `drill.collection_id` (NOT NULL, guarded by a trigger) replaces the `collection_drill` join table for drills; tags live in `club_tag` + `drill_tag`. Coaches see collection names through a security-definer RPC so they can file into collections they can't open. The client derives "which drills are in which collection" from `drill.collection_id` instead of fetching a join table. The schema change ships in two migrations — 046 is additive and backward-compatible, 047 drops the old shapes once the new client is deployed.

**Tech Stack:** React 19, TypeScript (non-strict), Zustand 5 slices, Supabase (Postgres + RLS + PostgREST), Tailwind v4 tokens, lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-28-drill-collections-and-tags-design.md`

## Global Constraints

- Work in `/Users/max/Desktop/app/gaffer` (its own git repo, branch `main`, committed to directly). The parent folder is not a repo.
- No test suite exists. Verification is: SQL assertion scripts run through the Supabase MCP `execute_sql` tool, `npm run build`, `npm run lint`, and a signed-in Browser-pane walkthrough. The pre-existing `react(preserve-manual-memoization)` lint warnings on `SessionPlanner.tsx` / `AttendancePage.tsx` are expected.
- Live Supabase project id: `zaougjiavbqdlgweidpc`. Schema changes go through the MCP `apply_migration` tool AND a matching file in `supabase/migrations/`.
- Every Supabase call from the client goes through `runSupabaseAction` (`src/store/supabaseAction.ts`). Components never call `supabase.from(...)` directly.
- Storage/correlated policies touching `drill`, `tactic` or `collection` must compare with `x in (select …)` at the policy's top level — those tables have a `name` column that shadows `storage.objects.name` inside a correlated subquery (migrations 019, 024).
- UI uses design tokens only (`bg-panel`, `text-ink-muted`, `border-line`, `bg-accent`, `text-bad`…), `rounded-xl` panels, `rounded-md` controls, `rounded-full` chips, no shadows. Read `DESIGN.md` before UI tasks.
- Copy: the main tags are called **Collections**, the general ones **Tags**. The holding collection is named exactly **Uncategorised**.
- Starter collections (kind `drill`): `1v1, 2v1, 2v2, 3v2, 3v3, 4v4, Rondo, Possession, Small-sided game, Passing, Finishing, Warm-up, Goalkeeping`.
- Starter tags: `Back to goal, 1v1 to pass, 1v1 to shoot, 1v1 to beat, Turning, Receiving, First touch, Dribbling, Combination play, Crossing, Pressing, Counter-attack, Transition, Overloads, Wide areas, Defending`.
- Tags are optional; a collection is required. Multiple picked tags narrow (a drill must have all of them).
- Tactics are out of scope: `collection_tactic`, tactic collections and `TacticsPage` stay as they are.
- Never re-run `013b_backfill_scene.sql` or `020b`. Leave `_to_delete/` and `.impeccable/` untracked.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| File | Change | Responsibility |
|---|---|---|
| `supabase/tests/046_collections_tags_test.sql` | create | RLS + data assertions for collections/tags; raises on any failure |
| `supabase/migrations/046_drill_collections_and_tags.sql` | create | Additive schema, backfill, policies, RPCs, starter set |
| `supabase/migrations/047_drop_collection_drill_and_category.sql` | create | Drops `collection_drill`, `drill.category/subcategory`, transitional default |
| `src/store/types.ts` | modify | `Drill.collection_id/tag_ids`, `Collection.is_uncategorised`, `ClubTag`, `DrillCollectionOption`; later drop `category/subcategory` |
| `src/store/slices/drillSlice.ts` | modify | Row mapping with embedded tags, draft carries filing, `setDrillTags`, `moveDrillsToCollection` |
| `src/store/slices/drillTagSlice.ts` | create | Club tags CRUD + collection picker options |
| `src/store/useStore.ts` | modify | Compose the new slice |
| `src/store/slices/clubSlice.ts` | modify | Stop fetching `collection_drill`; drill-kind delete via RPC; clear new state on club switch |
| `src/store/index.ts` | modify | Export new types |
| `src/hooks/useCollectionDrillIds.ts` | create | Derived `collectionId -> drillIds` map |
| `src/components/ui/ChipPicker.tsx` | create | Searchable toggle-chip list |
| `src/components/design/DrillFilingFields.tsx` | create | Collection + Tags fields, shared by the new-drill form and Details drawer |
| `src/pages/DesignPage.tsx` | modify | New drill form instead of instant draft |
| `src/components/design/editor/DrillDetailsDrawer.tsx` | modify | Filing fields at top; Category/Subcategory removed |
| `src/components/library/libraryPlaces.ts` | modify | Uncategorised ordering/visibility |
| `src/components/library/LibrarySidebar.tsx` | modify | "Manage tags" entry |
| `src/components/library/MoveToCollectionDialog.tsx` | create | Single-choice move dialog |
| `src/components/library/ManageTagsDialog.tsx` | create | Admin add/rename/delete tags |
| `src/components/library/TagFilterRow.tsx` | create | Tag chips with counts under the toolbar |
| `src/components/design/DrillLibrary.tsx` | modify | Wire all of the above; Category → Collection |
| `src/components/design/DrillDetails.tsx` | modify | Shows collection + tags; "Move" replaces "File" |
| `src/pages/HomePage.tsx`, `src/pages/CoachesPage.tsx` | modify | Use derived membership |
| `src/pages/DrillCardPage.tsx`, `src/pages/SharedDrillPage.tsx` | modify | Drop category line; viewer shows collection/tags (signed-in only) |
| `src/components/design/editor/onboarding/tourSteps.ts`, `src/layout/appTourSteps.ts` | modify | One line each about collections |

---

### Task 1: Database tests for collections and tags (written first, failing)

**Files:**
- Create: `supabase/tests/046_collections_tags_test.sql`

**Interfaces:**
- Consumes: nothing yet — this is written against the schema Task 2 creates.
- Produces: a script that returns one row `result = 'passed'` when every check holds, and errors naming the failed check (`T1`…`T16`) otherwise. Tasks 2 and 9 re-run it.

The script impersonates users the way migration 028's header records: `set_config('request.jwt.claims', …)` plus `set local role`, inside a transaction that is rolled back, so nothing it creates survives. It uses the live demo club "FC Barcelona (demo)" (one admin, two coaches — verified 2026-10-28).

- [ ] **Step 1: Write the test script**

```sql
-- supabase/tests/046_collections_tags_test.sql
-- Assertions for migration 046 (drill collections and tags). Run the whole
-- file through the Supabase MCP execute_sql tool. Everything happens inside
-- one transaction that is ROLLED BACK — the probe collection, drill and tag
-- links it creates never persist.
--
-- Persona switching follows 028's header: set_config('request.jwt.claims')
-- then `set local role`. Uses "FC Barcelona (demo)": 1 admin, 2 coaches.
-- Success: the final select returns result = 'passed'. Failure: an error
-- whose message starts with the check id (T1…T16).

begin;

do $$
declare
  cid uuid; admin_id uuid; coach1 uuid; coach2 uuid;
  other_club uuid; other_col uuid; tactic_col uuid; secret_col uuid;
  probe uuid; admin_drill uuid; tag uuid; other_tag uuid; unc uuid;
  n int; ok boolean;
begin
  -- ── Setup, as postgres ────────────────────────────────────────────────
  select id into cid from public.club where name = 'FC Barcelona (demo)';
  select user_id into admin_id from public.club_member where club_id = cid and role = 'admin' order by created_at limit 1;
  select user_id into coach1 from public.club_member where club_id = cid and role <> 'admin' order by created_at limit 1;
  select user_id into coach2 from public.club_member where club_id = cid and role <> 'admin' order by created_at offset 1 limit 1;
  select id into other_club from public.club where id <> cid order by created_at limit 1;
  select id into other_col from public.collection where club_id = other_club and kind = 'drill' limit 1;
  select id into other_tag from public.club_tag where club_id = other_club limit 1;
  select id into tactic_col from public.collection where club_id = cid and kind = 'tactic' limit 1;
  select id into tag from public.club_tag where club_id = cid order by name limit 1;
  select id into admin_drill from public.drill where club_id = cid and created_by = admin_id limit 1;

  if cid is null or admin_id is null or coach1 is null or coach2 is null then
    raise exception 'T0 fixture: FC Barcelona (demo) needs an admin and two coaches';
  end if;

  -- A drill collection no coach has been granted.
  insert into public.collection (club_id, name, kind, created_by)
    values (cid, 'zz rls probe', 'drill', admin_id) returning id into secret_col;

  -- Starter set landed.
  select count(*) into n from public.collection
    where club_id = cid and kind = 'drill' and name in ('1v1','2v1','2v2','3v2','3v3','4v4','Rondo','Possession','Small-sided game','Passing','Finishing','Warm-up','Goalkeeping');
  if n <> 13 then raise exception 'T1 starter collections: expected 13, got %', n; end if;
  select count(*) into n from public.club_tag where club_id = cid and name in ('Back to goal','1v1 to shoot','Wide areas');
  if n <> 3 then raise exception 'T1 starter tags missing, got %', n; end if;

  -- Every drill has a collection.
  select count(*) into n from public.drill where collection_id is null;
  if n <> 0 then raise exception 'T2 % drills without a collection', n; end if;

  -- ── As coach1 ─────────────────────────────────────────────────────────
  perform set_config('request.jwt.claims', json_build_object('sub', coach1, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if not exists (select 1 from public.club_drill_collections(cid) where id = secret_col) then
    raise exception 'T3 picker RPC does not list an ungranted collection';
  end if;
  if exists (select 1 from public.club_drill_collections(other_club)) then
    raise exception 'T4 picker RPC leaked another club''s collections';
  end if;
  if exists (select 1 from public.collection where id = secret_col) then
    raise exception 'T5 coach can read an ungranted collection row';
  end if;

  insert into public.drill (club_id, name, created_by, collection_id)
    values (cid, 'zz rls probe drill', coach1, secret_col) returning id into probe;
  if not exists (select 1 from public.drill where id = probe) then
    raise exception 'T6 coach cannot read their own drill filed in an ungranted collection';
  end if;

  insert into public.drill_tag (drill_id, tag_id) values (probe, tag);
  if not exists (select 1 from public.drill_tag where drill_id = probe) then
    raise exception 'T7 coach cannot tag their own drill';
  end if;

  ok := false;
  begin update public.drill set collection_id = tactic_col where id = probe; exception when others then ok := true; end;
  if tactic_col is not null and not ok then raise exception 'T8 drill accepted a tactic collection'; end if;

  ok := false;
  begin update public.drill set collection_id = other_col where id = probe; exception when others then ok := true; end;
  if other_col is not null and not ok then raise exception 'T9 drill accepted another club''s collection'; end if;

  ok := false;
  begin insert into public.drill_tag (drill_id, tag_id) values (probe, other_tag); exception when others then ok := true; end;
  if other_tag is not null and not ok then raise exception 'T10 drill accepted another club''s tag'; end if;

  if admin_drill is not null then
    update public.drill set collection_id = secret_col where id = admin_drill;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'T11 coach moved someone else''s drill'; end if;
  end if;

  ok := false;
  begin insert into public.club_tag (club_id, name) values (cid, 'zz coach tag'); exception when others then ok := true; end;
  if not ok then raise exception 'T12 coach created a club tag'; end if;

  -- ── As coach2 ─────────────────────────────────────────────────────────
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', coach2, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if exists (select 1 from public.drill where id = probe) or exists (select 1 from public.drill_tag where drill_id = probe) then
    raise exception 'T13 another coach sees a drill in a collection they were not granted';
  end if;

  -- ── As the admin ──────────────────────────────────────────────────────
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', admin_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  if not exists (select 1 from public.drill where id = probe) then
    raise exception 'T14 admin cannot see a coach''s drill';
  end if;

  perform public.delete_drill_collection(secret_col);
  select c.id into unc from public.collection c where c.club_id = cid and c.is_uncategorised;
  if (select collection_id from public.drill where id = probe) is distinct from unc then
    raise exception 'T15 deleting a collection did not move its drill to Uncategorised';
  end if;
  update public.collection set name = 'Renamed' where id = unc;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'T15 admin renamed Uncategorised'; end if;

  -- ── As anon ───────────────────────────────────────────────────────────
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';

  ok := false;
  begin perform 1 from public.club_tag limit 1; exception when others then ok := true; end;
  if not ok and exists (select 1 from public.club_tag) then raise exception 'T16 anon reads club_tag'; end if;
  ok := false;
  begin perform 1 from public.drill_tag limit 1; exception when others then ok := true; end;
  if not ok and exists (select 1 from public.drill_tag) then raise exception 'T16 anon reads drill_tag'; end if;
  ok := false;
  begin perform 1 from public.club_drill_collections(cid); exception when others then ok := true; end;
  if not ok then raise exception 'T16 anon can call club_drill_collections'; end if;

  execute 'reset role';
end $$;

select 'passed' as result;

rollback;
```

- [ ] **Step 2: Run it to confirm it fails before the migration**

Run the whole file through MCP `execute_sql` (project `zaougjiavbqdlgweidpc`).
Expected: an error such as `column "collection_id" does not exist` or `relation "public.club_tag" does not exist`.

- [ ] **Step 3: Commit**

```bash
git add supabase/tests/046_collections_tags_test.sql
git commit -m "test(db): assertions for drill collections and tags (failing until 046)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Migration 046 — collections on the drill, tags, starter set

**Files:**
- Create: `supabase/migrations/046_drill_collections_and_tags.sql`
- Create (outside the repo): `/Users/max/Desktop/app/drill_collections_category_backup_2026-10-28.json`

**Interfaces:**
- Consumes: Task 1's test script.
- Produces (database):
  - `drill.collection_id uuid not null` → `collection(id)` `on delete restrict`
  - `collection.is_uncategorised boolean not null default false`, one per club
  - `club_tag(id, club_id, name, created_at)`, unique `(club_id, lower(name))`
  - `drill_tag(drill_id, tag_id)` PK both
  - RPC `club_drill_collections(cid uuid) returns table(id uuid, name text, is_uncategorised boolean)` — authenticated only
  - RPC `delete_drill_collection(col uuid) returns void` — authenticated only, admin-checked
  - Internal (no client grants): `seed_drill_starter_set(cid uuid, creator uuid)`, `uncategorised_collection(cid uuid) returns uuid`
  - Error messages raised for the coach (`P0001`, shown verbatim by `runSupabaseAction`): `That collection isn't part of this club.`, `That tag isn't part of this club.`

- [ ] **Step 1: Preflight — confirm the backfill assumptions still hold**

Run through MCP `execute_sql`:

```sql
select
  (select count(*) from collection_drill cd join drill d on d.id = cd.drill_id join collection c on c.id = cd.collection_id
     where c.club_id <> d.club_id or c.kind <> 'drill') as cross_club_or_tactic_links,
  (select count(*) from (select drill_id from collection_drill group by drill_id having count(*) > 1) x) as drills_in_many,
  (select count(*) from club c where not exists (select 1 from club_member m where m.club_id = c.id and m.role = 'admin')) as clubs_without_admin,
  (select count(*) from collection where lower(name) = 'uncategorised') as existing_uncategorised;
```

Expected: all four `0`. If any is not, STOP and report — the backfill below assumes each.

- [ ] **Step 2: Back up what 047 will drop**

Run through MCP `execute_sql`:

```sql
select json_build_object(
  'taken_at', now(),
  'collection_drill', (select coalesce(json_agg(cd), '[]'::json) from collection_drill cd),
  'drill_category', (select coalesce(json_agg(json_build_object('id', id, 'club_id', club_id, 'category', category, 'subcategory', subcategory)), '[]'::json)
                     from drill where category is not null or subcategory is not null)
) as backup;
```

Write the returned `backup` JSON verbatim to `/Users/max/Desktop/app/drill_collections_category_backup_2026-10-28.json` (outside the repo, beside the 014/021 backups). Check it parses: `python3 -c "import json;d=json.load(open('/Users/max/Desktop/app/drill_collections_category_backup_2026-10-28.json'));print(len(d['collection_drill']), len(d['drill_category']))"` — expect `38 22` or close (38 links and 22 categorised drills as of 2026-10-28).

- [ ] **Step 3: Write the migration file**

```sql
-- 046_drill_collections_and_tags.sql — every drill in exactly one collection,
-- plus club-wide tags (spec docs/superpowers/specs/2026-10-28-drill-collections-and-tags-design.md).
--
-- Additive and backward-compatible on purpose. 047 drops collection_drill and
-- drill.category/subcategory once the client that reads drill.collection_id is
-- deployed; until then a client from before this migration still works,
-- because drill_collection_guard files a drill inserted with no collection
-- into the club's Uncategorised instead of failing the NOT NULL.
--
-- Coaches may file their OWN drill into ANY drill collection of their club,
-- including ones they were never granted (spec decision): the guard trigger
-- only checks the collection is in the drill's club and is drill-kind, and is
-- security definer so it can see collections the caller's RLS hides.

-- ── Uncategorised ─────────────────────────────────────────────────────────
alter table public.collection add column is_uncategorised boolean not null default false;
create unique index collection_one_uncategorised_per_club on public.collection (club_id) where is_uncategorised;

-- ── Tags ──────────────────────────────────────────────────────────────────
create table public.club_tag (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.club(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create unique index club_tag_club_name_key on public.club_tag (club_id, lower(name));

create table public.drill_tag (
  drill_id uuid not null references public.drill(id) on delete cascade,
  tag_id uuid not null references public.club_tag(id) on delete cascade,
  primary key (drill_id, tag_id)
);
create index drill_tag_tag_id_idx on public.drill_tag (tag_id);

alter table public.club_tag enable row level security;
alter table public.drill_tag enable row level security;

-- ── The drill's collection ────────────────────────────────────────────────
alter table public.drill add column collection_id uuid references public.collection(id) on delete restrict;
create index drill_collection_id_idx on public.drill (collection_id);

-- ── Internal helpers (no client grants) ───────────────────────────────────
create or replace function public.seed_drill_starter_set(cid uuid, creator uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.collection (club_id, name, kind, created_by)
  select cid, n, 'drill', creator
  from unnest(array['1v1','2v1','2v2','3v2','3v3','4v4','Rondo','Possession',
                    'Small-sided game','Passing','Finishing','Warm-up','Goalkeeping']) as n
  where not exists (select 1 from public.collection c
                    where c.club_id = cid and c.kind = 'drill' and lower(c.name) = lower(n));

  insert into public.club_tag (club_id, name)
  select cid, n
  from unnest(array['Back to goal','1v1 to pass','1v1 to shoot','1v1 to beat','Turning','Receiving',
                    'First touch','Dribbling','Combination play','Crossing','Pressing','Counter-attack',
                    'Transition','Overloads','Wide areas','Defending']) as n
  on conflict (club_id, lower(name)) do nothing;
end $$;
revoke execute on function public.seed_drill_starter_set(uuid, uuid) from public, anon, authenticated;

-- The club's Uncategorised, created the first time something needs it.
create or replace function public.uncategorised_collection(cid uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare col uuid; creator uuid;
begin
  select id into col from public.collection where club_id = cid and is_uncategorised;
  if col is not null then return col; end if;
  select coalesce(
    (select user_id from public.club_member where club_id = cid and role = 'admin' order by created_at limit 1),
    (select auth.uid())
  ) into creator;
  insert into public.collection (club_id, name, kind, created_by, is_uncategorised)
    values (cid, 'Uncategorised', 'drill', creator, true)
    returning id into col;
  return col;
end $$;
revoke execute on function public.uncategorised_collection(uuid) from public, anon, authenticated;

-- ── Seed every existing club ──────────────────────────────────────────────
do $$
declare r record;
begin
  for r in
    select c.id,
           (select m.user_id from public.club_member m
             where m.club_id = c.id and m.role = 'admin' order by m.created_at limit 1) as admin_id
    from public.club c
  loop
    if r.admin_id is not null then perform public.seed_drill_starter_set(r.id, r.admin_id); end if;
  end loop;
end $$;

-- ── Backfill collection_id ────────────────────────────────────────────────
-- Preflight (plan Task 2 Step 1) confirmed: no drill is in two collections and
-- no link crosses clubs or kinds.
update public.drill d set collection_id = cd.collection_id
  from public.collection_drill cd where cd.drill_id = d.id;
update public.drill d set collection_id = public.uncategorised_collection(d.club_id)
  where d.collection_id is null;

-- ── Guards ────────────────────────────────────────────────────────────────
create or replace function public.drill_collection_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- Transitional until 047: a pre-046 client inserts without a collection.
  if new.collection_id is null then
    new.collection_id := public.uncategorised_collection(new.club_id);
  end if;
  if not exists (select 1 from public.collection c
                 where c.id = new.collection_id and c.club_id = new.club_id and c.kind = 'drill') then
    raise exception 'That collection isn''t part of this club.';
  end if;
  return new;
end $$;
create trigger drill_collection_guard
  before insert or update of collection_id, club_id on public.drill
  for each row execute function public.drill_collection_guard();

alter table public.drill alter column collection_id set not null;

create or replace function public.drill_tag_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.drill d join public.club_tag t on t.club_id = d.club_id
                 where d.id = new.drill_id and t.id = new.tag_id) then
    raise exception 'That tag isn''t part of this club.';
  end if;
  return new;
end $$;
create trigger drill_tag_guard
  before insert or update on public.drill_tag
  for each row execute function public.drill_tag_guard();

-- ── Old free-text category/subcategory become tags ────────────────────────
-- Skips values that name one of the club's drill collections ("3v2"), which
-- would only duplicate the collection as a tag.
insert into public.club_tag (club_id, name)
select distinct d.club_id, trim(v.val)
from public.drill d
cross join lateral unnest(array[d.category, d.subcategory]) as v(val)
where v.val is not null and length(trim(v.val)) between 1 and 40
  and not exists (select 1 from public.collection c
                  where c.club_id = d.club_id and c.kind = 'drill' and lower(c.name) = lower(trim(v.val)))
on conflict (club_id, lower(name)) do nothing;

insert into public.drill_tag (drill_id, tag_id)
select distinct d.id, t.id
from public.drill d
cross join lateral unnest(array[d.category, d.subcategory]) as v(val)
join public.club_tag t on t.club_id = d.club_id and lower(t.name) = lower(trim(v.val))
where v.val is not null
on conflict do nothing;

-- ── Policies ──────────────────────────────────────────────────────────────
-- Read follows the column now. Own drills and admins are unchanged.
drop policy if exists drill_club_read on public.drill;
create policy drill_club_read on public.drill for select to authenticated
  using (is_club_admin(club_id) or created_by = (select auth.uid()) or can_read_collection(collection_id));

-- Uncategorised can't be created by hand, renamed or deleted.
drop policy if exists collection_admin_write on public.collection;
create policy collection_admin_write on public.collection for insert to authenticated
  with check (is_club_admin(club_id) and not is_uncategorised);
drop policy if exists collection_admin_update on public.collection;
create policy collection_admin_update on public.collection for update to authenticated
  using (is_club_admin(club_id) and not is_uncategorised)
  with check (is_club_admin(club_id) and not is_uncategorised);
drop policy if exists collection_admin_delete on public.collection;
create policy collection_admin_delete on public.collection for delete to authenticated
  using (is_club_admin(club_id) and not is_uncategorised);

create policy club_tag_read on public.club_tag for select to authenticated
  using (is_club_member(club_id));
create policy club_tag_admin_insert on public.club_tag for insert to authenticated
  with check (is_club_admin(club_id));
create policy club_tag_admin_update on public.club_tag for update to authenticated
  using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy club_tag_admin_delete on public.club_tag for delete to authenticated
  using (is_club_admin(club_id));

-- drill_tag rides on the drill's own RLS: readable when the drill is, writable
-- by whoever may edit the drill (drill_club_update's rule).
create policy drill_tag_read on public.drill_tag for select to authenticated
  using (drill_id in (select d.id from public.drill d));
create policy drill_tag_insert on public.drill_tag for insert to authenticated
  with check (drill_id in (select d.id from public.drill d
                           where public.is_club_admin(d.club_id) or d.created_by = (select auth.uid())));
create policy drill_tag_delete on public.drill_tag for delete to authenticated
  using (drill_id in (select d.id from public.drill d
                      where public.is_club_admin(d.club_id) or d.created_by = (select auth.uid())));

-- ── RPCs the client calls ─────────────────────────────────────────────────
-- Names only, for the create/move pickers: a coach can't select collection
-- rows they weren't granted, but may still file into them.
create or replace function public.club_drill_collections(cid uuid)
returns table (id uuid, name text, is_uncategorised boolean)
language sql security definer stable set search_path = '' as $$
  select c.id, c.name, c.is_uncategorised
  from public.collection c
  where c.club_id = cid and c.kind = 'drill' and public.is_club_member(cid)
  order by c.is_uncategorised, lower(c.name);
$$;
revoke execute on function public.club_drill_collections(uuid) from public, anon;
grant execute on function public.club_drill_collections(uuid) to authenticated;

-- Deleting a collection that still holds drills moves them to Uncategorised
-- first, in one transaction (drill.collection_id is ON DELETE RESTRICT).
create or replace function public.delete_drill_collection(col uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare cid uuid; unc boolean;
begin
  select club_id, is_uncategorised into cid, unc from public.collection where id = col and kind = 'drill';
  if cid is null then raise exception 'That collection no longer exists.'; end if;
  if not public.is_club_admin(cid) then raise exception 'Only a club admin can delete a collection.'; end if;
  if unc then raise exception 'Uncategorised can''t be deleted.'; end if;
  if exists (select 1 from public.drill where collection_id = col) then
    update public.drill set collection_id = public.uncategorised_collection(cid) where collection_id = col;
  end if;
  delete from public.collection where id = col;
end $$;
revoke execute on function public.delete_drill_collection(uuid) from public, anon;
grant execute on function public.delete_drill_collection(uuid) to authenticated;

-- ── New clubs get the starter set ─────────────────────────────────────────
create or replace function public.create_club(club_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  if club_name is null or length(trim(club_name)) = 0 then
    raise exception 'club name required'; end if;
  insert into public.club (name) values (trim(club_name)) returning id into cid;
  insert into public.club_member (club_id, user_id, role)
    values (cid, (select auth.uid()), 'admin');
  perform public.seed_drill_starter_set(cid, (select auth.uid()));
  return cid;
end $$;
-- `create or replace` keeps 043's grants (authenticated only).

-- ── Cross-club copy reads the column and carries tags ─────────────────────
create or replace function public.copy_collection_to_club(src_collection uuid, target_club uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  src_club uuid; new_col uuid; new_id uuid; r record;
begin
  select club_id into src_club from public.collection where id = src_collection;
  if src_club is null then raise exception 'collection not found'; end if;
  if not (public.is_club_admin(src_club) and public.is_club_admin(target_club)) then
    raise exception 'caller must be an admin of both clubs';
  end if;

  insert into public.collection (club_id, name, description, created_by, kind)
  select target_club, name, description, (select auth.uid()), kind
  from public.collection where id = src_collection
  returning id into new_col;

  for r in select d.* from public.drill d where d.collection_id = src_collection loop
    insert into public.drill (
      club_id, created_by, collection_id, name, scene, keyframes, duration_seconds, pitch,
      orientation, objective, description, category, subcategory,
      duration_minutes, players_recommended, min_players, max_players,
      age_min, age_max, difficulty, intensity, phase_of_play, session_block,
      setup_minutes, learning_outcome, video_url, video_path, coaching,
      share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), new_col, r.name, r.scene, r.keyframes,
      r.duration_seconds, r.pitch, r.orientation, r.objective, r.description,
      r.category, r.subcategory, r.duration_minutes, r.players_recommended,
      r.min_players, r.max_players, r.age_min, r.age_max, r.difficulty,
      r.intensity, r.phase_of_play, r.session_block, r.setup_minutes,
      r.learning_outcome, r.video_url, r.video_path, r.coaching,
      null, null)
    returning id into new_id;

    -- Tags match the target club's by name; missing ones are created.
    insert into public.club_tag (club_id, name)
      select target_club, t.name
      from public.drill_tag dt join public.club_tag t on t.id = dt.tag_id
      where dt.drill_id = r.id
      on conflict (club_id, lower(name)) do nothing;
    insert into public.drill_tag (drill_id, tag_id)
      select new_id, tt.id
      from public.drill_tag dt
      join public.club_tag t on t.id = dt.tag_id
      join public.club_tag tt on tt.club_id = target_club and lower(tt.name) = lower(t.name)
      where dt.drill_id = r.id;
  end loop;

  for r in
    select t.* from public.tactic t
    join public.collection_tactic ct on ct.tactic_id = t.id
    where ct.collection_id = src_collection
  loop
    insert into public.tactic (
      club_id, created_by, team_id, name, scene, keyframes, duration_seconds,
      pitch, sides, phases, view, description, phase_of_play,
      share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), null, r.name,
      jsonb_set(r.scene, '{entities}', coalesce(
        (select jsonb_agg(e - 'player_id')
         from jsonb_array_elements(r.scene->'entities') e), '[]'::jsonb)),
      r.keyframes, r.duration_seconds, r.pitch, r.sides, r.phases, r.view,
      r.description, r.phase_of_play,
      null, null)
    returning id into new_id;
    insert into public.collection_tactic (collection_id, tactic_id)
      values (new_col, new_id);
  end loop;

  return new_col;
end $$;
```

- [ ] **Step 4: Apply it**

Call MCP `apply_migration` with project `zaougjiavbqdlgweidpc`, name `046_drill_collections_and_tags`, and the file's full contents.
Expected: `{"success":true}`.

- [ ] **Step 5: Run Task 1's tests**

Run `supabase/tests/046_collections_tags_test.sql` through MCP `execute_sql`.
Expected: one row, `result = 'passed'`.

- [ ] **Step 6: Data checks against the backup**

```sql
select
  (select count(*) from drill) as drills,
  (select count(*) from drill where collection_id is null) as unfiled,
  (select count(*) from collection where is_uncategorised) as uncategorised_collections,
  (select count(*) from drill d join collection c on c.id = d.collection_id where c.is_uncategorised) as in_uncategorised,
  (select count(*) from drill d join collection_drill cd on cd.drill_id = d.id where d.collection_id <> cd.collection_id) as mismatched,
  (select count(*) from drill_tag) as drill_tags;
```

Expected: `drills` unchanged (56 on 2026-10-28), `unfiled = 0`, `in_uncategorised` = the count of drills that had no `collection_drill` row (18 on 2026-10-28), `mismatched = 0`, `drill_tags > 0`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/046_drill_collections_and_tags.sql
git commit -m "feat(db): drills filed in exactly one collection, plus club tags (046)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Store — filing on the drill, tags slice, derived membership

**Files:**
- Modify: `src/store/types.ts`
- Modify: `src/store/slices/drillSlice.ts`
- Create: `src/store/slices/drillTagSlice.ts`
- Modify: `src/store/useStore.ts`
- Modify: `src/store/slices/clubSlice.ts` (`clearClubScopedState` only, in this task)
- Modify: `src/store/index.ts`
- Create: `src/hooks/useCollectionDrillIds.ts`

**Interfaces:**
- Consumes: Task 2's columns, tables and RPCs.
- Produces:
  - `Drill.collection_id: string`, `Drill.tag_ids: string[]`
  - `Collection.is_uncategorised: boolean`
  - `interface ClubTag { id: string; club_id: string; name: string; created_at: string }`
  - `interface DrillCollectionOption { id: string; name: string; is_uncategorised: boolean }`
  - `NewDrillInput` gains `collection_id: string` (required) and `tag_ids?: string[]`
  - `DrillUpdateInput` gains `collection_id?: string`
  - Drill slice actions: `setDrillTags(drillId: string, tagIds: string[]): Promise<boolean>`, `moveDrillsToCollection(drillIds: string[], collectionId: string): Promise<number>` (returns how many moved)
  - Tag slice state/actions: `clubTags: ClubTag[]`, `drillCollectionOptions: DrillCollectionOption[]`, `fetchClubTags(): Promise<void>`, `fetchDrillCollectionOptions(): Promise<void>`, `createClubTag(name: string): Promise<ClubTag | null>`, `renameClubTag(id: string, name: string): Promise<boolean>`, `deleteClubTag(id: string): Promise<boolean>`
  - Hook: `useCollectionDrillIds(): Record<string, string[]>` (collectionId → drill ids, drafts excluded)

- [ ] **Step 1: Types**

In `src/store/types.ts`, inside `interface Drill`, add after `club_id` (find the `club_id: string` line in the Drill interface):

```ts
  // The one collection this drill is filed in (migration 046) — required.
  collection_id: string
  // Ids of the club tags on this drill. Not a column: flattened from the
  // embedded `drill_tag` rows by drillSlice's `fromRow`, and stripped again
  // before any write.
  tag_ids: string[]
```

In `interface Collection`, add after `kind: CollectionKind`:

```ts
  // The club's holding collection for drills that predate required filing
  // (migration 046). Can't be renamed, deleted, or picked when creating.
  is_uncategorised: boolean
```

At the end of the file, add:

```ts
// A club's tag (migration 046). Club-wide, any drill can carry any of them.
export interface ClubTag {
  id: string
  club_id: string
  name: string
  created_at: string
}

// One row of the create/move collection picker — names only, from the
// club_drill_collections RPC, which lists every drill collection in the club
// including ones the caller can't open.
export interface DrillCollectionOption {
  id: string
  name: string
  is_uncategorised: boolean
}
```

In `src/store/index.ts`, add `ClubTag` and `DrillCollectionOption` to the `export type { … } from './types'` list.

- [ ] **Step 2: Drill row mapping in drillSlice**

In `src/store/slices/drillSlice.ts`, below the `shareClient` helper, add:

```ts
// Drills come back with their tag links embedded and leave without them:
// `tag_ids` is a client-side field over the drill_tag table (migration 046),
// so it is flattened in here and must never reach an insert or update.
const DRILL_SELECT = '*, drill_tag(tag_id)'

type DrillRow = Omit<Drill, 'tag_ids'> & { drill_tag?: { tag_id: string }[] }

function fromRow(row: DrillRow): Drill {
  const { drill_tag, ...rest } = row
  return { ...rest, tag_ids: (drill_tag ?? []).map((t) => t.tag_id) } as Drill
}

function withoutTags<T extends { tag_ids?: string[] }>(row: T): Omit<T, 'tag_ids'> {
  const { tag_ids: _tagIds, ...rest } = row
  return rest
}
```

Change these call sites:

1. `fetchDrills`: `supabase.from('drill').select('*')` → `supabase.from('drill').select(DRILL_SELECT)`, the action's type parameter `runSupabaseAction<Drill[]>` → `runSupabaseAction<DrillRow[]>`, and right after the `callId` check add `const rows = data?.map(fromRow) ?? null` then use `rows` wherever the function used `data` below that point (the `.map((drill) => …pending…)`, the `visible` set).
2. `fetchSharedDrill`: keep `select('*')` (anon has no `drill_tag` access); change its type parameter to `runSupabaseAction<DrillRow[]>` and its last line `return data?.[0] ?? null` to `return data?.[0] ? fromRow(data[0]) : null`.
3. `createDrill`: build `seeded` from `withoutTags(input)`; `.insert(seeded).select(DRILL_SELECT)`; type `DrillRow[]`; `const drill = data?.[0] ? fromRow(data[0]) : null`. After the insert succeeds and `input.tag_ids?.length`, call `await writeTagLinks(drill.id, [], input.tag_ids)` (defined in Step 4) and set `drill.tag_ids = input.tag_ids` before storing it.
4. `updateDrill`: `.update(patch).eq('id', id).select(DRILL_SELECT)`; type `DrillRow[]`; `const server = data?.[0] ? fromRow(data[0]) : null`.
5. `runFlush` draft insert: `supabase.from('drill').insert({ ...withoutTags(draftRow), ...payload, id: drillId })`. After `if (isDraft && !error) unsavedDrafts.delete(drillId)`, add:

```ts
      // A draft's tags can only be written once its row exists.
      if (isDraft && !error) {
        const tagIds = get().drills.find((d) => d.id === drillId)?.tag_ids ?? []
        if (tagIds.length) await writeTagLinks(drillId, [], tagIds)
      }
```

- [ ] **Step 3: Draft and duplicate carry filing**

In `NewDrillInput` add:

```ts
  // Required at creation (spec 2026-10-28): the collection the drill is filed
  // in, and any tags.
  collection_id: string
  tag_ids?: string[]
```

In `DrillUpdateInput` add:

```ts
  // Moving a drill to another collection. Tags change through setDrillTags.
  collection_id?: string
```

In `startDrillDraft`'s `draft` object, add `tag_ids: input.tag_ids ?? [],` before `...input,`.

In `duplicateDrill`, add `collection_id: source.collection_id,` and `tag_ids: source.tag_ids,` to the `createDrill({ … })` argument, and delete the `category: source.category,` / `subcategory: source.subcategory,` lines only in Task 7 (they still compile now).

- [ ] **Step 4: Tag writes and moves**

Inside `createDrillSlice`, near `releaseVideo`, add:

```ts
  // Brings drill_tag in line with `next`, touching only what changed.
  const writeTagLinks = async (drillId: string, previous: string[], next: string[]) => {
    const add = next.filter((id) => !previous.includes(id))
    const remove = previous.filter((id) => !next.includes(id))
    if (remove.length) {
      const { error } = await runSupabaseAction(
        () => supabase.from('drill_tag').delete().eq('drill_id', drillId).in('tag_id', remove),
        "Couldn't save the drill's tags, try again."
      )
      if (error) return error
    }
    if (add.length) {
      const { error } = await runSupabaseAction(
        () => supabase.from('drill_tag').insert(add.map((tag_id) => ({ drill_id: drillId, tag_id }))),
        "Couldn't save the drill's tags, try again."
      )
      if (error) return error
    }
    return null
  }
```

Add to the `DrillSlice` interface (next to `updateDrill`):

```ts
  // Replaces a drill's tags. Local state first, like updateDrill; a draft
  // has no row yet, so its tags are written by its first save instead.
  setDrillTags: (drillId: string, tagIds: string[]) => Promise<boolean>

  // Files each drill in `collectionId`. Returns how many moved; RLS and the
  // guard trigger decide which ones the caller may move.
  moveDrillsToCollection: (drillIds: string[], collectionId: string) => Promise<number>
```

Implement next to `updateDrill`:

```ts
    setDrillTags: async (drillId, tagIds) => {
      const current = get().drills.find((d) => d.id === drillId)
      if (!current) return false
      const previous = current.tag_ids ?? []
      set({ drills: get().drills.map((d) => (d.id === drillId ? { ...d, tag_ids: tagIds } : d)) })
      if (unsavedDrafts.has(drillId)) return true
      const error = await writeTagLinks(drillId, previous, tagIds)
      if (error) {
        set({
          drillsError: error,
          drills: get().drills.map((d) => (d.id === drillId ? { ...d, tag_ids: previous } : d)),
        })
        return false
      }
      return true
    },

    moveDrillsToCollection: async (drillIds, collectionId) => {
      let moved = 0
      for (const id of drillIds) {
        if (unsavedDrafts.has(id)) {
          set({ drills: get().drills.map((d) => (d.id === id ? { ...d, collection_id: collectionId } : d)) })
          moved++
          continue
        }
        if (await get().updateDrill(id, { collection_id: collectionId })) moved++
      }
      return moved
    },
```

- [ ] **Step 5: The tags slice**

Create `src/store/slices/drillTagSlice.ts`:

```ts
import type { StateCreator } from 'zustand'
import { supabase } from '../../lib/supabase'
import { runSupabaseAction } from '../supabaseAction'
import type { ClubTag, DrillCollectionOption } from '../types'
import type { StoreState } from '../useStore'

// Club tags and the collection picker's options (migration 046, spec
// 2026-10-28). Both are scoped to selectedClubId and cleared on a club switch
// by clubSlice's clearClubScopedState.
export interface DrillTagSlice {
  clubTags: ClubTag[]
  // Every drill collection in the club — names only, including ones this
  // coach can't open, because a coach may file their own drill into any.
  drillCollectionOptions: DrillCollectionOption[]
  drillTagError: string | null

  fetchClubTags: () => Promise<void>
  fetchDrillCollectionOptions: () => Promise<void>
  createClubTag: (name: string) => Promise<ClubTag | null>
  renameClubTag: (id: string, name: string) => Promise<boolean>
  deleteClubTag: (id: string) => Promise<boolean>
}

const byName = (a: ClubTag, b: ClubTag) => a.name.localeCompare(b.name)

export const createDrillTagSlice: StateCreator<StoreState, [], [], DrillTagSlice> = (set, get) => ({
  clubTags: [],
  drillCollectionOptions: [],
  drillTagError: null,

  fetchClubTags: async () => {
    const clubId = get().selectedClubId
    if (!clubId) return
    const { data, error } = await runSupabaseAction<ClubTag[]>(
      () => supabase.from('club_tag').select('*').eq('club_id', clubId).order('name'),
      "Couldn't load tags, try again."
    )
    if (get().selectedClubId !== clubId) return
    set({ drillTagError: error, ...(data ? { clubTags: data } : {}) })
  },

  fetchDrillCollectionOptions: async () => {
    const clubId = get().selectedClubId
    if (!clubId) return
    const { data, error } = await runSupabaseAction<DrillCollectionOption[]>(
      () => supabase.rpc('club_drill_collections', { cid: clubId }),
      "Couldn't load collections, try again."
    )
    if (get().selectedClubId !== clubId) return
    set({ drillTagError: error, ...(data ? { drillCollectionOptions: data } : {}) })
  },

  createClubTag: async (name) => {
    const clubId = get().selectedClubId
    const trimmed = name.trim()
    if (!clubId || !trimmed) return null
    const { data, error } = await runSupabaseAction<ClubTag[]>(
      () => supabase.from('club_tag').insert({ club_id: clubId, name: trimmed }).select(),
      "Couldn't add the tag, try again."
    )
    const tag = data?.[0] ?? null
    set({ drillTagError: error, ...(tag ? { clubTags: [...get().clubTags, tag].sort(byName) } : {}) })
    return tag
  },

  renameClubTag: async (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return false
    const { data, error } = await runSupabaseAction<ClubTag[]>(
      () => supabase.from('club_tag').update({ name: trimmed }).eq('id', id).select(),
      "Couldn't rename the tag, try again."
    )
    const tag = data?.[0] ?? null
    set({
      drillTagError: error,
      ...(tag ? { clubTags: get().clubTags.map((t) => (t.id === id ? tag : t)).sort(byName) } : {}),
    })
    return Boolean(tag)
  },

  deleteClubTag: async (id) => {
    const { error } = await runSupabaseAction<null>(
      () => supabase.from('club_tag').delete().eq('id', id),
      "Couldn't delete the tag, try again."
    )
    if (error) {
      set({ drillTagError: error })
      return false
    }
    // drill_tag rows cascade in the database; mirror that locally.
    set({
      drillTagError: null,
      clubTags: get().clubTags.filter((t) => t.id !== id),
      drills: get().drills.map((d) =>
        d.tag_ids?.includes(id) ? { ...d, tag_ids: d.tag_ids.filter((t) => t !== id) } : d
      ),
    })
    return true
  },
})
```

In `src/store/useStore.ts`: import `createDrillTagSlice, type DrillTagSlice` from `./slices/drillTagSlice`, add `& DrillTagSlice` to `StoreState`, and `...createDrillTagSlice(...args),` to the store.

In `clubSlice.ts` `clearClubScopedState()`, add `clubTags: [],` and `drillCollectionOptions: [],` to the returned object.

- [ ] **Step 6: Derived membership hook**

Create `src/hooks/useCollectionDrillIds.ts`:

```ts
import { useMemo } from 'react'
import { useStore } from '../store'

// Which drills are in which collection, derived from `drill.collection_id`
// (migration 046) — the replacement for fetching the collection_drill join
// table. Drafts are left out: they aren't library items until first saved.
export function useCollectionDrillIds(): Record<string, string[]> {
  const drills = useStore((s) => s.drills)
  const isDrillDraft = useStore((s) => s.isDrillDraft)
  return useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const d of drills) {
      if (!d.collection_id || isDrillDraft(d.id)) continue
      ;(map[d.collection_id] ??= []).push(d.id)
    }
    return map
  }, [drills, isDrillDraft])
}
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: the only errors are callers of `startDrillDraft`/`createDrill` now missing `collection_id` (`src/pages/DesignPage.tsx`). Temporarily keep the build green by leaving DesignPage for Task 4 — if the error blocks, add `collection_id: ''` there with a `// replaced in Task 4` comment and remove it in Task 4 Step 3. Then `npm run lint`: no new warnings.

- [ ] **Step 8: Commit**

```bash
git add src/store src/hooks/useCollectionDrillIds.ts src/pages/DesignPage.tsx
git commit -m "feat(store): drills carry their collection and tags; club tags slice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The New drill form

**Files:**
- Create: `src/components/ui/ChipPicker.tsx`
- Create: `src/components/design/DrillFilingFields.tsx`
- Modify: `src/pages/DesignPage.tsx`

**Interfaces:**
- Consumes: `drillCollectionOptions`, `clubTags`, `fetchDrillCollectionOptions`, `fetchClubTags`, `startDrillDraft`, `createDrill` (Task 3).
- Produces:
  - `ChipPicker({ options, selected, onToggle, ariaLabel, searchThreshold? })` where `options: { id: string; label: string }[]`, `selected: string[]`, `onToggle(id: string): void`
  - `DrillFilingFields({ collectionId, tagIds, onCollectionChange, onTagsChange })` — `collectionId: string | null`, `tagIds: string[]`, `onCollectionChange(id: string): void`, `onTagsChange(ids: string[]): void`. Fetches its own options on mount.

- [ ] **Step 1: ChipPicker**

```tsx
// src/components/ui/ChipPicker.tsx
import { useState } from 'react'
import { Search } from 'lucide-react'

export interface ChipOption {
  id: string
  label: string
}

// A wrap of toggle chips, with a search box once the list is long enough to
// need one. Selection semantics belong to the caller: a single-choice field
// replaces `selected` on toggle, a multi-choice one adds or removes.
export function ChipPicker({
  options,
  selected,
  onToggle,
  ariaLabel,
  searchThreshold = 8,
}: {
  options: ChipOption[]
  selected: string[]
  onToggle: (id: string) => void
  ariaLabel: string
  searchThreshold?: number
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options

  return (
    <div className="space-y-2">
      {options.length > searchThreshold && (
        <label className="flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
          <Search className="h-3.5 w-3.5 shrink-0 text-ink-faint" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            aria-label={`Search ${ariaLabel.toLowerCase()}`}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
          />
        </label>
      )}
      <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
        {shown.map((option) => {
          const on = selected.includes(option.id)
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(option.id)}
              className={
                'min-h-9 rounded-full border px-3 text-sm transition-colors ' +
                (on
                  ? 'border-accent bg-accent/15 text-accent-ink'
                  : 'border-line text-ink-muted hover:border-line-strong hover:text-ink')
              }
            >
              {option.label}
            </button>
          )
        })}
        {shown.length === 0 && <p className="text-xs text-ink-faint">Nothing matches "{query}".</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: DrillFilingFields**

```tsx
// src/components/design/DrillFilingFields.tsx
import { useEffect } from 'react'
import { useStore } from '../../store'
import { ChipPicker } from '../ui/ChipPicker'

// The two fields every drill is filed by (spec 2026-10-28): one required
// collection and any number of tags. Shared by the New drill form and the
// editor's Details drawer so they can't drift apart.
export function DrillFilingFields({
  collectionId,
  tagIds,
  onCollectionChange,
  onTagsChange,
}: {
  collectionId: string | null
  tagIds: string[]
  onCollectionChange: (id: string) => void
  onTagsChange: (ids: string[]) => void
}) {
  const selectedClubId = useStore((s) => s.selectedClubId)
  const options = useStore((s) => s.drillCollectionOptions)
  const tags = useStore((s) => s.clubTags)
  const fetchDrillCollectionOptions = useStore((s) => s.fetchDrillCollectionOptions)
  const fetchClubTags = useStore((s) => s.fetchClubTags)

  useEffect(() => {
    void fetchDrillCollectionOptions()
    void fetchClubTags()
  }, [fetchDrillCollectionOptions, fetchClubTags, selectedClubId])

  // Uncategorised is a holding pen for drills that predate this, never a
  // choice — a drill sitting there shows no chip picked.
  const collections = options.filter((o) => !o.is_uncategorised).map((o) => ({ id: o.id, label: o.name }))
  const inUncategorised = options.some((o) => o.is_uncategorised && o.id === collectionId)

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-ink-muted">
          Collection <span className="text-bad">*</span>
        </legend>
        {inUncategorised && (
          <p className="text-xs text-warn">This drill is in Uncategorised — pick the collection it belongs to.</p>
        )}
        <ChipPicker
          options={collections}
          selected={collectionId ? [collectionId] : []}
          onToggle={(id) => onCollectionChange(id)}
          ariaLabel="Collection"
        />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-ink-muted">Tags</legend>
        <ChipPicker
          options={tags.map((t) => ({ id: t.id, label: t.name }))}
          selected={tagIds}
          onToggle={(id) => onTagsChange(tagIds.includes(id) ? tagIds.filter((t) => t !== id) : [...tagIds, id])}
          ariaLabel="Tags"
        />
      </fieldset>
    </div>
  )
}
```

- [ ] **Step 3: DesignPage becomes the form**

Replace the body of `src/pages/DesignPage.tsx` (keep the file's leading comments above the component, and replace the `useEffect` that starts a draft immediately):

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { configFromPreset, findPreset } from '../components/design/canvas/pitchPresets'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { DrillFilingFields } from '../components/design/DrillFilingFields'

// Create → Drill (spec 2026-10-28): name, a required collection and optional
// tags, THEN the editor. The draft mechanism is unchanged — nothing is
// written until the first edit, so backing out of the editor still leaves no
// stray row; the draft just starts out filed.
export function DesignPage() {
  const navigate = useNavigate()
  const startDrillDraft = useStore((s) => s.startDrillDraft)
  const createDrill = useStore((s) => s.createDrill)
  const drillsError = useStore((s) => s.drillsError)
  const [name, setName] = useState('')
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!collectionId || creating) return
    setCreating(true)
    const preset = findPreset('full')!
    const input = {
      name: name.trim() || 'New drill',
      orientation: preset.orientation,
      pitch: configFromPreset(preset),
      collection_id: collectionId,
      tag_ids: tagIds,
    }
    const draft = startDrillDraft(input)
    if (draft) {
      navigate(`/design/${draft.id}`, { replace: true })
      return
    }
    const created = await createDrill(input)
    setCreating(false)
    if (created) navigate(`/design/${created.id}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New drill" description="File it in a collection so the club can find it later." />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New drill"
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <DrillFilingFields
            collectionId={collectionId}
            tagIds={tagIds}
            onCollectionChange={setCollectionId}
            onTagsChange={setTagIds}
          />
          {drillsError && <p className="text-sm text-bad">{drillsError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!collectionId || creating}
              className="min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 lg:min-h-9"
            >
              {creating ? 'Creating…' : 'Create drill'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
```

`PageHeader` takes `title`, `description?` and `actions?` (verified). Remove any temporary `collection_id: ''` added in Task 3 Step 7.

- [ ] **Step 4: Build, lint, and check in the browser**

Run: `npm run build && npm run lint` — expected clean (apart from the known warnings).
Start the dev server (`preview_start` name `gaffer`), sign in as a test account, open Create → Drill. Expected: Name, Collection chips (no "Uncategorised"), Tags chips; Create disabled until a collection is picked; picking one + two tags and creating opens the editor; drawing one thing and reloading shows the drill saved (check in SQL: `select collection_id, (select count(*) from drill_tag where drill_id = d.id) from drill d order by created_at desc limit 1` → the picked collection and `2`).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ChipPicker.tsx src/components/design/DrillFilingFields.tsx src/pages/DesignPage.tsx
git commit -m "feat(drills): pick a collection and tags before the editor opens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Collection and tags in the Details drawer

**Files:**
- Modify: `src/components/design/editor/DrillDetailsDrawer.tsx`

**Interfaces:**
- Consumes: `DrillFilingFields` (Task 4), `updateDrill`, `setDrillTags` (Task 3).

- [ ] **Step 1: Add the fields at the top of the Basic tab**

In the `tab === 'basic'` block (`<div key={drill.id} className="space-y-3">`), insert as its first child:

```tsx
              <DrillFilingFields
                collectionId={drill.collection_id}
                tagIds={drill.tag_ids ?? []}
                onCollectionChange={(id) => {
                  if (id !== drill.collection_id) patch({ collection_id: id })
                }}
                onTagsChange={(ids) => void setDrillTags(drill.id, ids)}
              />
```

Add `const setDrillTags = useStore((s) => s.setDrillTags)` beside the component's other store reads, and `import { DrillFilingFields } from '../DrillFilingFields'`.

- [ ] **Step 2: Remove Category and Subcategory**

Delete the `<TextField id="details-category" … />` block and the `<TextField id="details-subcategory" … />` block.

- [ ] **Step 3: Build and check**

Run: `npm run build && npm run lint` — clean.
In the browser: open a drill, Details → Basic shows Collection + Tags at the top; switching collection and toggling a tag persists across a reload. Open a migrated drill that's in Uncategorised: the amber "pick the collection it belongs to" line shows and no chip is selected.

- [ ] **Step 4: Commit**

```bash
git add src/components/design/editor/DrillDetailsDrawer.tsx
git commit -m "feat(drills): collection and tags in the editor's Details drawer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Library — collections from the drill, tag filter, move, manage tags

**Files:**
- Create: `src/components/library/TagFilterRow.tsx`
- Create: `src/components/library/MoveToCollectionDialog.tsx`
- Create: `src/components/library/ManageTagsDialog.tsx`
- Modify: `src/components/library/libraryPlaces.ts`
- Modify: `src/components/library/LibrarySidebar.tsx`
- Modify: `src/components/design/DrillLibrary.tsx`
- Modify: `src/components/design/DrillDetails.tsx`

**Interfaces:**
- Consumes: `useCollectionDrillIds`, `clubTags`, `drillCollectionOptions`, `fetchClubTags`, `fetchDrillCollectionOptions`, `moveDrillsToCollection`, `createClubTag`, `renameClubTag`, `deleteClubTag` (Task 3); `deleteCollection` (changed in Task 7 Step 1 — do that step first if executing out of order).
- Produces:
  - `TagFilterRow({ tags, selected, onChange })` — `tags: { id: string; name: string; count: number }[]`, `selected: string[]`, `onChange(ids: string[]): void`
  - `MoveToCollectionDialog({ open, onClose, options, currentId, count, onMove })` — `options: DrillCollectionOption[]`, `currentId: string | null`, `onMove(collectionId: string): Promise<void>`
  - `ManageTagsDialog({ open, onClose, tags, usage, onCreate, onRename, onDelete })` — `usage: Record<string, number>`, `onCreate(name): Promise<unknown>`, `onRename(id, name): Promise<unknown>`, `onDelete(id): Promise<unknown>`
  - `LibrarySidebar` gains optional `onManageTags?: () => void`

- [ ] **Step 1: Uncategorised in the places model**

In `buildLibraryPlaces` (`src/components/library/libraryPlaces.ts`), change the `ours` sort and the collection loop:

```ts
  const ours = collections
    .filter((c) => c.club_id === selectedClubId && c.kind === kind && !licensedCollectionIds.has(c.id))
    .slice()
    // Uncategorised (migration 046) always last.
    .sort((a, b) => Number(a.is_uncategorised) - Number(b.is_uncategorised) || a.name.localeCompare(b.name))
```

```ts
  for (const c of ours) {
    const ids = idsIn(c.id)
    // Uncategorised only matters while something is waiting to be sorted.
    if (c.is_uncategorised && ids.length === 0) continue
    places.push({ id: `c:${c.id}`, kind: 'collection', title: c.name, ids, collectionId: c.id })
  }
```

- [ ] **Step 2: Sidebar counts and Manage tags**

In `LibrarySidebar.tsx`: add `onManageTags?: () => void` to the props (destructure it). In `PlaceRow`, directly after the title `<span className="min-w-0 flex-1 truncate" title={place.title}>…</span>` inside the row `<button>`, add:

```tsx
        {(place.kind === 'collection' || place.kind === 'licensed') && (
          <span className="shrink-0 text-xs tabular-nums text-ink-faint">{place.ids.length}</span>
        )}
```

(The button already reserves `pr-8` for the row menu, so the count sits clear of it.) After the Collections `<ul>`/empty `<p>` block, add:

```tsx
      {isAdmin && onManageTags && (
        <button
          type="button"
          onClick={onManageTags}
          className="mt-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
        >
          <Tags className="h-3.5 w-3.5" aria-hidden />
          Manage tags
        </button>
      )}
```

Add `Tags` to the lucide import.

- [ ] **Step 3: TagFilterRow**

```tsx
// src/components/library/TagFilterRow.tsx

// Narrows the current place by tag (spec 2026-10-28). Only tags some drill in
// view actually carries, each with its count; picking several narrows — a
// drill must have all of them.
export function TagFilterRow({
  tags,
  selected,
  onChange,
}: {
  tags: { id: string; name: string; count: number }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  if (tags.length === 0) return null
  return (
    <div role="group" aria-label="Filter by tag" className="mb-3 flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => {
        const on = selected.includes(tag.id)
        return (
          <button
            key={tag.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter((id) => id !== tag.id) : [...selected, tag.id])}
            className={
              'flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors ' +
              (on
                ? 'border-accent bg-accent/15 text-accent-ink'
                : 'border-line text-ink-muted hover:border-line-strong hover:text-ink')
            }
          >
            {tag.name}
            <span className="tabular-nums text-ink-faint">{tag.count}</span>
          </button>
        )
      })}
      {selected.length > 0 && (
        <button type="button" onClick={() => onChange([])} className="px-1.5 text-xs text-ink-muted hover:text-ink">
          Clear
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: MoveToCollectionDialog**

```tsx
// src/components/library/MoveToCollectionDialog.tsx
import { useState } from 'react'
import { Check, Folder } from 'lucide-react'
import type { DrillCollectionOption } from '../../store'
import { Modal } from '../ui/Modal'

// A drill lives in exactly one collection (migration 046), so filing is a
// move, never an add. Lists every drill collection in the club — a coach may
// move their own drill into one they can't open — except Uncategorised.
export function MoveToCollectionDialog({
  open,
  onClose,
  options,
  currentId,
  count,
  onMove,
}: {
  open: boolean
  onClose: () => void
  options: DrillCollectionOption[]
  currentId: string | null
  count: number
  onMove: (collectionId: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const choices = options.filter((o) => !o.is_uncategorised)
  const canSubmit = !submitting && selectedId !== null && selectedId !== currentId

  const handleSubmit = async () => {
    if (!canSubmit || !selectedId) return
    setSubmitting(true)
    await onMove(selectedId)
    setSubmitting(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move to collection"
      description={`${count} drill${count === 1 ? '' : 's'} selected`}
      footer={
        <>
          <button type="button" onClick={onClose} className="px-2 py-1.5 text-sm text-ink-muted hover:text-ink">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {submitting ? 'Moving…' : 'Move'}
          </button>
        </>
      }
    >
      <ul className="max-h-80 space-y-0.5 overflow-y-auto">
        {choices.map((option) => {
          const selected = selectedId === option.id
          const current = currentId === option.id
          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => setSelectedId(option.id)}
                aria-pressed={selected}
                className={
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ' +
                  (selected ? 'bg-accent/15 text-accent-ink' : 'text-ink hover:bg-panel-raised')
                }
              >
                <Folder className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                {current && <span className="shrink-0 text-xs text-ink-faint">Current</span>}
                {selected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}
```

- [ ] **Step 5: ManageTagsDialog**

```tsx
// src/components/library/ManageTagsDialog.tsx
import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { ClubTag } from '../../store'
import { Modal } from '../ui/Modal'

const FIELD =
  'min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30'

// Admin-only (club_tag's write policies). Deleting asks first and says how
// many drills lose the tag; renaming changes it on every drill at once.
export function ManageTagsDialog({
  open,
  onClose,
  tags,
  usage,
  onCreate,
  onRename,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  tags: ClubTag[]
  usage: Record<string, number>
  onCreate: (name: string) => Promise<unknown>
  onRename: (id: string, name: string) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
}) {
  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const add = async () => {
    if (!newName.trim()) return
    await onCreate(newName)
    setNewName('')
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage tags" description="Tags are shared by every drill in the club.">
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add()
            }}
            placeholder="New tag, e.g. Back to goal"
            aria-label="New tag name"
            maxLength={40}
            className={FIELD}
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={!newName.trim()}
            className="flex items-center gap-1 rounded-md bg-accent px-3 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add
          </button>
        </div>
        <ul className="max-h-80 space-y-0.5 overflow-y-auto">
          {tags.map((tag) => (
            <li key={tag.id} className="flex min-h-9 items-center gap-2 rounded-md px-2 hover:bg-panel-raised">
              {editing?.id === tag.id ? (
                <input
                  autoFocus
                  value={editing.name}
                  maxLength={40}
                  onChange={(e) => setEditing({ id: tag.id, name: e.target.value })}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      await onRename(tag.id, editing.name)
                      setEditing(null)
                    }
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  onBlur={() => setEditing(null)}
                  aria-label={`Rename ${tag.name}`}
                  className={FIELD}
                />
              ) : confirmDelete === tag.id ? (
                <>
                  <span className="min-w-0 flex-1 text-sm text-ink">
                    Delete "{tag.name}"?{' '}
                    <span className="text-ink-muted">
                      {usage[tag.id] ? `It comes off ${usage[tag.id]} drill${usage[tag.id] === 1 ? '' : 's'}.` : 'No drills use it.'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDelete(tag.id)
                      setConfirmDelete(null)
                    }}
                    className="text-sm font-medium text-bad"
                  >
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirmDelete(null)} className="text-sm text-ink-muted">
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{tag.name}</span>
                  <span className="text-xs tabular-nums text-ink-faint">{usage[tag.id] ?? 0}</span>
                  <button
                    type="button"
                    onClick={() => setEditing({ id: tag.id, name: tag.name })}
                    aria-label={`Rename ${tag.name}`}
                    className="rounded p-1 text-ink-muted hover:text-ink"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(tag.id)}
                    aria-label={`Delete ${tag.name}`}
                    className="rounded p-1 text-ink-muted hover:text-bad"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
          {tags.length === 0 && <li className="px-2 py-3 text-sm text-ink-faint">No tags yet.</li>}
        </ul>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 6: Wire DrillLibrary**

In `src/components/design/DrillLibrary.tsx`:

1. Imports: remove `FolderMinus` and `AddToCollectionDialog`; add `FolderInput, Tags` from lucide (keep `FolderPlus` only if still used — it isn't after this step; remove it), `import { useCollectionDrillIds } from '../../hooks/useCollectionDrillIds'`, `import { TagFilterRow } from '../library/TagFilterRow'`, `import { MoveToCollectionDialog } from '../library/MoveToCollectionDialog'`, `import { ManageTagsDialog } from '../library/ManageTagsDialog'`.
2. `Filters`: delete `category: string` and its `EMPTY_FILTERS` entry; delete `categoryOptions` (the `useMemo`), the `filters.category` check, the `categoryOptions` prop on `DrillFilters` and the Category `Dropdown` block inside `DrillFilters` (the one with `value={filters.category}`).
3. Replace `const collectionDrillIds = useStore((s) => s.collectionDrillIds)` with `const collectionDrillIds = useCollectionDrillIds()`. Remove `addDrillToCollection` / `removeDrillFromCollection` reads. Add:

```ts
  const clubTags = useStore((s) => s.clubTags)
  const collectionOptions = useStore((s) => s.drillCollectionOptions)
  const fetchClubTags = useStore((s) => s.fetchClubTags)
  const fetchDrillCollectionOptions = useStore((s) => s.fetchDrillCollectionOptions)
  const moveDrillsToCollection = useStore((s) => s.moveDrillsToCollection)
  const createClubTag = useStore((s) => s.createClubTag)
  const renameClubTag = useStore((s) => s.renameClubTag)
  const deleteClubTag = useStore((s) => s.deleteClubTag)
  const [tagFilter, setTagFilter] = useState<string[]>([])
```

and extend the club-data effect:

```ts
  useEffect(() => {
    void fetchClubData()
    void fetchClubTags()
    void fetchDrillCollectionOptions()
  }, [fetchClubData, fetchClubTags, fetchDrillCollectionOptions, selectedClubId])
```

4. Names for display:

```ts
  const tagName = useMemo(() => new Map(clubTags.map((t) => [t.id, t.name])), [clubTags])
  const collectionName = useMemo(() => {
    const map = new Map<string, string>()
    for (const o of collectionOptions) map.set(o.id, o.name)
    for (const c of collections) map.set(c.id, c.name)
    return map
  }, [collectionOptions, collections])
  const tagNamesOf = (d: Drill) => (d.tag_ids ?? []).map((id) => tagName.get(id)).filter((n): n is string => Boolean(n))
```

5. Search and tag narrowing inside `matched`: the haystack becomes `[d.name, collectionName.get(d.collection_id), ...tagNamesOf(d), d.objective, pitchLabel(d)]`, and add as the first check after search:

```ts
      if (tagFilter.length && !tagFilter.every((t) => d.tag_ids?.includes(t))) return false
```

Add `tagFilter`, `collectionName`, `tagName` to its dependency array.

6. Tag chips for the place (above `matched`):

```ts
  const placeTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of placeDrills) for (const id of d.tag_ids ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
    return clubTags.filter((t) => counts.has(t.id)).map((t) => ({ id: t.id, name: t.name, count: counts.get(t.id)! }))
  }, [placeDrills, clubTags])
```

In the sidebar's `onSelectPlace`, also call `setTagFilter([])`. Render `<TagFilterRow tags={placeTags} selected={tagFilter} onChange={setTagFilter} />` directly after `<LibraryToolbar … />`. Include `tagFilter.length > 0` in `narrowed`.

7. Sort/columns: rename the `category` column to `{ key: 'collection', label: 'Collection', … }`, `COMPACT_COLUMN_KEYS = ['collection', 'duration']`, the sort option `{ value: 'collection', label: 'Collection' }`, and the comparator case:

```ts
    case 'collection':
      primary = text(collectionName.get(a.collection_id)).localeCompare(text(collectionName.get(b.collection_id)))
      break
```

`compareDrills` needs the name map: change its signature to `compareDrills(a, b, sort, collectionName: Map<string, string>)` and pass it from the `sorted` memo (add to deps). A stored sort of `'category'` falls through to the default (name) case — harmless.

8. Items: `metaLine` replaces `drill.category` with `collectionName.get(drill.collection_id)`, and appends `tagNamesOf(drill).join(', ') || null` before the `'Video'` entry; `cells.category` becomes `cells.collection: collectionName.get(drill.collection_id) ?? null`. Search placeholder: `"Search name, collection, tag, objective…"`.

9. Moves replace add/remove. Delete `handleAddToCollection`, `handleCreateAndAdd`, `handleRemoveFromPlace`, and `collectionNamesFor`. Change the `LibraryDialog` union: remove `addToCollection`, add `| { kind: 'move'; ids: string[] }` and `| { kind: 'manageTags' }`. Add:

```ts
  const handleMove = async (collectionId: string, ids: string[]) => {
    const moved = await moveDrillsToCollection(ids, collectionId)
    const name = collectionName.get(collectionId) ?? 'the collection'
    showToast(`Moved ${moved} ${moved === 1 ? 'drill' : 'drills'} to ${name}`)
    selection.clear()
  }
```

Row menu: replace the `if (isAdmin) { … 'file' … 'unfile' … }` block with:

```ts
    if (editable) {
      items.push({
        key: 'move',
        label: 'Move to collection…',
        icon: FolderInput,
        onSelect: () => setDialog({ kind: 'move', ids: [drill.id] }),
      })
    }
```

Selection bar: replace both collection `SelectionAction`s with one, shown when at least one selected drill is editable:

```tsx
        {deletableSelected.length > 0 && (
          <SelectionAction
            icon={FolderInput}
            label="Move to collection"
            onClick={() => setDialog({ kind: 'move', ids: deletableSelected })}
          />
        )}
```

Dialogs: replace the `addToCollection` dialog with

```tsx
      {dialog?.kind === 'move' && (
        <MoveToCollectionDialog
          open
          onClose={() => setDialog(null)}
          options={collectionOptions}
          currentId={dialog.ids.length === 1 ? (drills.find((d) => d.id === dialog.ids[0])?.collection_id ?? null) : null}
          count={dialog.ids.length}
          onMove={(collectionId) => handleMove(collectionId, dialog.ids)}
        />
      )}
      {dialog?.kind === 'manageTags' && (
        <ManageTagsDialog
          open
          onClose={() => setDialog(null)}
          tags={clubTags}
          usage={Object.fromEntries(clubTags.map((t) => [t.id, drills.filter((d) => d.tag_ids?.includes(t.id)).length]))}
          onCreate={createClubTag}
          onRename={renameClubTag}
          onDelete={deleteClubTag}
        />
      )}
```

Pass `onManageTags={() => setDialog({ kind: 'manageTags' })}` to `LibrarySidebar`.

10. Collection menu: hide rename/delete for Uncategorised —

```ts
    const collection = homeCollections.find((c) => c.id === collectionId)
    if (!collection) return []
    const items: RowMenuItem[] = [
      { key: 'access', label: 'Coach access…', icon: UserCog, onSelect: () => setDialog({ kind: 'access', collectionId, name: collection.name }) },
    ]
    if (!collection.is_uncategorised) {
      items.unshift({ key: 'rename', label: 'Rename', icon: Pencil, onSelect: () => setDialog({ kind: 'renameCollection', collectionId, name: collection.name }) })
      items.push({ key: 'delete', label: 'Delete collection', icon: Trash2, danger: true, onSelect: () => setDialog({ kind: 'deleteCollection', collectionId, name: collection.name }) })
    }
    return items
```

Delete-collection confirm message:

```ts
          message={(() => {
            const n = collectionDrillIds[dialog.collectionId]?.length ?? 0
            return n
              ? `Delete "${dialog.name}"? Its ${n} ${n === 1 ? 'drill moves' : 'drills move'} to Uncategorised.`
              : `Delete "${dialog.name}"? It's empty.`
          })()}
```

After a successful delete, also `void fetchDrillCollectionOptions()`; after `createCollection` / `updateCollection` succeed, too.

Empty-state copy for a collection: `'This collection is empty. Create a drill in it, or move drills here from anywhere in the library.'`

11. DrillDetails props: replace `canFile={isAdmin}`, `collectionNames={collectionNamesFor(activeDrill.id)}` and `onAddToCollection={…}` with `canMove={canEdit(activeDrill)}`, `collectionName={collectionName.get(activeDrill.collection_id) ?? null}`, `tagNames={tagNamesOf(activeDrill)}`, `onMove={() => setDialog({ kind: 'move', ids: [activeDrill.id] })}`.

- [ ] **Step 7: DrillDetails pane**

In `src/components/design/DrillDetails.tsx`: props `canFile`, `collectionNames`, `onAddToCollection` become `canMove: boolean`, `collectionName: string | null`, `tagNames: string[]`, `onMove: () => void`. `subtitle={drill.category}` → `subtitle={collectionName ?? undefined}`. Replace the "In collections" section with:

```tsx
      <DetailSection label="Collection">
        <p className="text-xs text-ink">{collectionName ?? 'Uncategorised'}</p>
      </DetailSection>
      {tagNames.length > 0 && (
        <DetailSection label="Tags">
          <div className="flex flex-wrap gap-1">
            {tagNames.map((name) => (
              <Badge key={name} tone="neutral">
                {name}
              </Badge>
            ))}
          </div>
        </DetailSection>
      )}
```

The "File" button becomes "Move" (`canMove && …`, icon `FolderInput`, `onClick={onMove}`); update the lucide import (`FolderPlus` → `FolderInput`).

- [ ] **Step 8: Build, lint, browser check**

Run: `npm run build && npm run lint` — clean.
Browser, signed in as an admin:
- Sidebar lists collections with counts; Uncategorised last (while non-empty); "Manage tags" under Collections.
- In a collection, the tag chip row shows tags with counts; picking two narrows to drills with both; Clear resets; changing place clears it.
- Row menu → Move to collection… moves one drill; selecting three → Move to collection moves all three, toast says 3.
- Delete a non-empty collection: the confirm names the count; afterwards its drills are in Uncategorised.
- Manage tags: add, rename (Enter), delete (confirm shows usage).
- Table: Collection column, sortable.

- [ ] **Step 9: Commit**

```bash
git add src/components/library src/components/design/DrillLibrary.tsx src/components/design/DrillDetails.tsx
git commit -m "feat(library): browse by collection, narrow by tags, move and manage tags

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Retire the old membership and category code paths

**Files:**
- Modify: `src/store/slices/clubSlice.ts`
- Modify: `src/pages/HomePage.tsx`, `src/pages/CoachesPage.tsx`
- Modify: `src/pages/DrillCardPage.tsx`, `src/pages/SharedDrillPage.tsx`, `src/pages/DrillViewPage.tsx`
- Modify: `src/store/types.ts`, `src/store/slices/drillSlice.ts`

**Interfaces:**
- Consumes: `useCollectionDrillIds` (Task 3); `delete_drill_collection` RPC (Task 2).
- Produces: `clubSlice` without `collectionDrillIds`, `addDrillToCollection`, `removeDrillFromCollection`; `deleteCollection(id)` routes drill-kind collections through the RPC and refetches drills.

- [ ] **Step 1: clubSlice**

1. Remove `collectionDrillIds` from the `ClubSlice` interface, its initial state, `clearClubScopedState`, the `deleteCollection` destructure, and `fetchClubData` (drop the `collection_drill` query from the `Promise.all`, from `firstError`, and the loop that builds the map).
2. Remove `addDrillToCollection` and `removeDrillFromCollection` (interface + implementation).
3. `deleteCollection`:

```ts
  deleteCollection: async (id) => {
    const kind = get().collections.find((c) => c.id === id)?.kind
    set({ clubDataLoading: true, clubDataError: null })
    // Drill collections go through the RPC (migration 046): it moves any
    // drills still filed there to Uncategorised before deleting, which a
    // plain delete can't do (drill.collection_id is ON DELETE RESTRICT).
    const { error } = await runSupabaseAction<null>(
      () =>
        kind === 'drill'
          ? supabase.rpc('delete_drill_collection', { col: id })
          : supabase.from('collection').delete().eq('id', id),
      "Couldn't delete collection, try again."
    )
    if (error) {
      set({ clubDataLoading: false, clubDataError: error })
      return false
    }
    set((state) => {
      const { [id]: _tacticIds, ...restTacticIds } = state.collectionTacticIds
      const { [id]: _access, ...restAccess } = state.collectionAccess
      return {
        clubDataLoading: false,
        clubDataError: null,
        collections: state.collections.filter((c) => c.id !== id),
        collectionTacticIds: restTacticIds,
        collectionAccess: restAccess,
      }
    })
    if (kind === 'drill') {
      // Moved drills changed collection, and Uncategorised may be new.
      await Promise.all([get().fetchDrills(), get().fetchClubData()])
    }
    return true
  },
```

- [ ] **Step 2: HomePage and CoachesPage**

In both files replace `const collectionDrillIds = useStore((s) => s.collectionDrillIds)` with `const collectionDrillIds = useCollectionDrillIds()` and add `import { useCollectionDrillIds } from '../hooks/useCollectionDrillIds'`. Both pages already read `drills` or trigger `fetchDrills`? Check: `grep -n "fetchDrills\|s.drills" src/pages/HomePage.tsx src/pages/CoachesPage.tsx`. If CoachesPage doesn't fetch drills, add `const fetchDrills = useStore((s) => s.fetchDrills)` and `useEffect(() => { void fetchDrills() }, [fetchDrills, selectedClubId])` so its counts aren't zero on a cold load.

- [ ] **Step 3: Category out of the remaining pages**

- `src/pages/DrillCardPage.tsx`: delete the `{drill.category && ( … )}` block (lines ~171-175).
- `src/store/slices/drillSlice.ts`: delete `subcategory?: string | null` (and `category` if present) from `DrillUpdateInput`, and the `category:` / `subcategory:` lines in `duplicateDrill`.
- `src/store/types.ts`: delete `category: string | null` and `subcategory: string | null` from `Drill`, and update the comment at line ~327 that mentions them.
- `SharedDrill` (in `SharedDrillPage.tsx`) — add an optional `filing?: { collection: string | null; tags: string[] }` prop; when present, render under the header's chips:

```tsx
        {filing && (filing.collection || filing.tags.length > 0) && (
          <p className="mt-2 text-xs text-ink-muted">
            {[filing.collection, ...filing.tags].filter(Boolean).join(' · ')}
          </p>
        )}
```

  The public page doesn't pass it (spec: no collection/tags for anon). `DrillViewPage.tsx` passes it, computed from the store: collection name from `collections` or `drillCollectionOptions` by `drill.collection_id`, tag names from `clubTags` (fetch both on mount alongside `fetchDrills`).

- [ ] **Step 4: Build — this is the check that nothing still reads the old shapes**

Run: `npm run build && npm run lint`
Expected: clean. Then `grep -rn "collectionDrillIds\b" src | grep -v useCollectionDrillIds` shows only the derived-hook call sites, and `grep -rn "category\b\|subcategory" src --include='*.ts*'` shows no drill field uses (tactic/other unrelated hits are fine — inspect each).

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "refactor: drill collection membership comes from the drill; category retired

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Tours

**Files:**
- Modify: `src/components/design/editor/onboarding/tourSteps.ts`
- Modify: `src/layout/appTourSteps.ts`

- [ ] **Step 1: Copy updates**

`tourSteps.ts`, the step titled `'Name your drill'` — body becomes:

`'Tap the name at any time to rename it, and use Details to change its collection or tags. Everything here is autosaved as you go — there is no separate save button.'`

`appTourSteps.ts`, the `'first-drill'` step — append to its body: `' You'll file it in a collection first, so the club can find it later.'` (read the current body and keep it intact before the appended sentence). The step at line ~103 (`'Every drill and tactic you make lands in the club library, …'`) — replace `or group into collections for a block of training` with `filed in its collection and searchable by tag`.

- [ ] **Step 2: Build and commit**

Run: `npm run build` — clean.

```bash
git add src/components/design/editor/onboarding/tourSteps.ts src/layout/appTourSteps.ts
git commit -m "docs(tours): mention collections and tags

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Full walkthrough, deploy, then migration 047

**Files:**
- Create: `supabase/migrations/047_drop_collection_drill_and_category.sql`
- Modify: `CLAUDE.md`, `HANDOFF.md`

**Interfaces:**
- Consumes: everything above, deployed.

- [ ] **Step 1: Signed-in walkthrough (Browser pane, test accounts)**

As an admin: create a drill with a collection + 2 tags; edit both in Details; filter by two tags; bulk-move 2 drills; delete a non-empty collection; add/rename/delete a tag; duplicate a drill (copy keeps collection + tags).
As a plain coach (FC Barcelona demo coach or a test coach): the New drill picker lists every collection; create a drill in a collection you weren't granted; it shows under your own folder; that collection does not appear in your sidebar.
Licensing: in a club with a licence out, file a new drill into the licensed collection; in the receiving club it appears under "Licensed to us".
Record anything that fails and fix it before continuing.

- [ ] **Step 2: Push and deploy the client**

```bash
git push
```

Confirm the production deploy at `gaffer-khaki.vercel.app` is serving the new build (open Create → Drill there and see the form). 047 must not run before this — the old client reads `collection_drill` and `category`.

- [ ] **Step 3: Write migration 047**

```sql
-- 047_drop_collection_drill_and_category.sql — finishes 046 once the client
-- that reads drill.collection_id is deployed. Backup of everything dropped:
-- ../drill_collections_category_backup_2026-10-28.json (taken before 046).

-- No more silent fallback: a drill must be created with its collection.
create or replace function public.drill_collection_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.collection c
                 where c.id = new.collection_id and c.club_id = new.club_id and c.kind = 'drill') then
    raise exception 'That collection isn''t part of this club.';
  end if;
  return new;
end $$;

-- copy_collection_to_club without category/subcategory.
create or replace function public.copy_collection_to_club(src_collection uuid, target_club uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  src_club uuid; new_col uuid; new_id uuid; r record;
begin
  select club_id into src_club from public.collection where id = src_collection;
  if src_club is null then raise exception 'collection not found'; end if;
  if not (public.is_club_admin(src_club) and public.is_club_admin(target_club)) then
    raise exception 'caller must be an admin of both clubs';
  end if;

  insert into public.collection (club_id, name, description, created_by, kind)
  select target_club, name, description, (select auth.uid()), kind
  from public.collection where id = src_collection
  returning id into new_col;

  for r in select d.* from public.drill d where d.collection_id = src_collection loop
    insert into public.drill (
      club_id, created_by, collection_id, name, scene, keyframes, duration_seconds, pitch,
      orientation, objective, description,
      duration_minutes, players_recommended, min_players, max_players,
      age_min, age_max, difficulty, intensity, phase_of_play, session_block,
      setup_minutes, learning_outcome, video_url, video_path, coaching,
      share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), new_col, r.name, r.scene, r.keyframes,
      r.duration_seconds, r.pitch, r.orientation, r.objective, r.description,
      r.duration_minutes, r.players_recommended,
      r.min_players, r.max_players, r.age_min, r.age_max, r.difficulty,
      r.intensity, r.phase_of_play, r.session_block, r.setup_minutes,
      r.learning_outcome, r.video_url, r.video_path, r.coaching,
      null, null)
    returning id into new_id;

    insert into public.club_tag (club_id, name)
      select target_club, t.name
      from public.drill_tag dt join public.club_tag t on t.id = dt.tag_id
      where dt.drill_id = r.id
      on conflict (club_id, lower(name)) do nothing;
    insert into public.drill_tag (drill_id, tag_id)
      select new_id, tt.id
      from public.drill_tag dt
      join public.club_tag t on t.id = dt.tag_id
      join public.club_tag tt on tt.club_id = target_club and lower(tt.name) = lower(t.name)
      where dt.drill_id = r.id;
  end loop;

  for r in
    select t.* from public.tactic t
    join public.collection_tactic ct on ct.tactic_id = t.id
    where ct.collection_id = src_collection
  loop
    insert into public.tactic (
      club_id, created_by, team_id, name, scene, keyframes, duration_seconds,
      pitch, sides, phases, view, description, phase_of_play,
      share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), null, r.name,
      jsonb_set(r.scene, '{entities}', coalesce(
        (select jsonb_agg(e - 'player_id')
         from jsonb_array_elements(r.scene->'entities') e), '[]'::jsonb)),
      r.keyframes, r.duration_seconds, r.pitch, r.sides, r.phases, r.view,
      r.description, r.phase_of_play,
      null, null)
    returning id into new_id;
    insert into public.collection_tactic (collection_id, tactic_id)
      values (new_col, new_id);
  end loop;

  return new_col;
end $$;

drop table public.collection_drill;
drop function if exists public.drill_in_readable_collection(uuid);
alter table public.drill drop column category, drop column subcategory;
```

- [ ] **Step 4: Apply 047 and re-run the tests**

MCP `apply_migration` (name `047_drop_collection_drill_and_category`). Then run `supabase/tests/046_collections_tags_test.sql` again — expected `result = 'passed'`. Reload the deployed app's library and editor — no errors in the console (`read_console_messages`).

- [ ] **Step 5: Docs**

`CLAUDE.md`, Data model section: replace the `collection_drill` description with: drills are filed by `drill.collection_id` (NOT NULL, migration 046) — one collection per drill, guarded by `drill_collection_guard`; tags are `club_tag` + `drill_tag`, flattened to `Drill.tag_ids` by `drillSlice`'s `fromRow` and stripped before writes; coaches see collection names via `club_drill_collections` and may file their own drill into any drill collection; deleting a drill collection goes through `delete_drill_collection`, which moves its drills to Uncategorised. `collection_tactic` is unchanged.
`HANDOFF.md`: add a session entry recording 046/047, the backup file path, and the Task 9 walkthrough results.

- [ ] **Step 6: Commit and push**

```bash
git add supabase/migrations/047_drop_collection_drill_and_category.sql CLAUDE.md HANDOFF.md
git commit -m "feat(db): drop collection_drill and drill category fields (047)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

## Self-review notes

- Spec §1 data model → Task 2 (schema), Task 3 (types/store). §2 permissions → Task 2 policies/RPCs, Task 1 tests. §3 create/edit → Tasks 4, 5; duplicate + cross-club copy → Task 3 Step 3, Task 2 copy function. §3 tours → Task 8. §4 library → Task 6. §5 starter set + migration steps 1-7 → Tasks 2 and 9 (split into 046/047 so the deployed client never meets a dropped column; the spec's single migration became two for that reason). Testing → Task 1, Task 2 Step 6, Task 9 Step 1.
- Licensed-in drills show no tag names in the receiving club (their `club_tag` rows belong to the licensor and `club_tag_read` is members-only). Not in the spec; acceptable for now and visible as "no tags" rather than an error, since `tagNamesOf` drops unknown ids.
