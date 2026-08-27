# Club Tenancy & Library Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans
> (recommended for this plan — tasks are strongly sequential against one live
> database) or superpowers:subagent-driven-development to implement this plan
> task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Gaffer into a multi-tenant club drill-and-tactic library
platform (club → admin → coaches, collections-based visibility, cross-club
copy and licensing), demo-ready with seeded personas.

**Architecture:** Additive Supabase migrations add `club`/`club_member`/
`collection`/`collection_access`/`club_license` and put `club_id`+`created_by`
on `drill` and `tactic`; a full RLS rewrite moves visibility from team
membership to club role + collection grants. The React app gains a `clubSlice`
in the single shared Zustand store, a role-aware shell (Drill Library · Tactic
Library · Admin), and an admin console. Teams/players/sessions/attendance are
shelved: routes and nav removed, code and tables dormant.

**Tech Stack:** React 19 + Vite + TS (non-strict), Zustand 5 slices, Supabase
(Postgres/Auth/RLS/Edge Functions via the configured MCP server, project
`zaougjiavbqdlgweidpc`), Tailwind v4 tokens, Konva editors (untouched).

**Spec:** `docs/superpowers/specs/2026-08-27-club-tenancy-design.md` (v2) —
read it first; this plan argues from it. One deliberate deviation, reflected
in the spec's v2.1 amendment: `drill.team_id` is **demoted, not dropped** this
cycle (dropping it would force edits to shelved dormant components that still
reference it; the drop moves to the team-module-reinstatement milestone).

## Global Constraints

- All commands run from `/Users/max/Desktop/app/gaffer` — the parent dir is
  not a git repo. `cd` explicitly in every fresh shell.
- **Never stage files you did not change.** The tree carries pre-existing
  uncommitted work (PlayerRoster/DrillLibrary/TimelineEditor/TacticsPage/
  sceneActions/drillSlice/playerSlice deltas). Every commit lists explicit
  paths. If one of those files must be edited (DrillLibrary.tsx, TacticsPage.tsx,
  drillSlice.ts are in scope), edit *around* the existing uncommitted hunks,
  leave them intact, and commit the file (their delete-feature hunks ride
  along — acceptable, they are complete and self-contained; note it in the
  commit body).
- One Zustand store, sliced (`src/store/useStore.ts`); components never call
  `supabase.from(...)` — store actions via `runSupabaseAction` only
  (exceptions: `supabase.functions.invoke` in a slice, documented; the
  removed `waitlist.ts` precedent).
- Migrations: numbered files under `supabase/migrations/` AND applied live via
  MCP `apply_migration`. Numbers below (026–029) are assumed; **claim the real
  next free number at apply time** (`ls supabase/migrations/`) and rename —
  023→025 precedent.
- **Never run `013b_backfill_scene.sql` or `020b`** (inert and inverted;
  standing rule).
- `_to_delete/` stays untouched. Dormant shelved files stay untouched unless a
  type change breaks their compile — prefer keeping types backward-compatible
  (`team_id` stays on `Drill`/`Tactic` types) so they never need edits.
- UI: dark-only, tokens from `design.md` (`bg-panel`, `text-ink-muted`,
  `border-line`, `bg-accent`, `text-ok/warn/bad`); shared grid constant for
  header+rows; read `design.md` before writing any UI.
- Verification per task: `npm run build` + `npm run lint` (3 pre-existing
  warnings are the known baseline; the uncommitted tree may add ~2 more —
  record the Task 0 baseline and compare against *that*) + the task's live
  probes. No test suite exists.
- RLS SQL rules: wrap `auth.uid()` as `(select auth.uid())`; helpers are
  `security definer` with `set search_path = ''` and schema-qualified refs;
  index every FK and RLS-filtered column.
- Time fields stay float seconds; scene jsonb shapes are untouched everywhere.

## Model & Effort Per Task

Switch with `/model <id>` between tasks (e.g. `/model claude-sonnet-5`); where
the build exposes a reasoning-effort control (the `/model` picker, or
`/config` in an interactive terminal), set the effort column too. The point is
to spend the expensive tier where a mistake is unrecoverable or invisible, and
the cheap tier on mechanical work — an all-Opus-max night costs a great deal
and buys nothing on a file deletion.

| Task | Model | Effort | Why |
|---|---|---|---|
| 0 Recon | Sonnet 5 | medium | Gathering facts; breadth over depth. |
| 1 Landing removal | Sonnet 5 | medium | Deletions + one trivial migration. |
| 2 Schema + backfill | **Opus 5** | high | One-shot DDL against the live DB; a wrong backfill is painful to unwind. |
| 3 **RLS core** | **Opus 5** | **xhigh** | The security boundary and the only stop-the-line task. Spend here. |
| 4 clubSlice + bootstrap | **Opus 5** | high | New store architecture every later task consumes. |
| 5 Drill library rescope | **Opus 5** | high | Touches shipped code + the call-site trap in 5.0. |
| 6 Tactic library rescope | Sonnet 5 | high | Mirrors Task 5; escalate to Opus if the editor fights back. |
| 7 Shell / shelving | Sonnet 5 | medium | Mechanical, but mind `noUnusedLocals` (see task). |
| 8 Coaches + Edge Function | **Opus 5** | high | Privilege check in a service-role context — auth-sensitive. |
| 9 Collections UI | Sonnet 5 | medium | CRUD over an API that already exists. |
| 10 Cross-club copy | **Opus 5** | high | Column-by-column duplication; silent omissions are the risk. |
| 11 Licensing | **Opus 5** | high | Security-adjacent; revocation must actually revoke. |
| 12 Demo seed | Sonnet 5 | medium | Scripted data entry, verified by SQL. |
| 13 Rehearsal + handoff | **Opus 5** | medium | Diagnosing whatever the rehearsal surfaces. |

If the run falls behind, downgrade Tasks 6/9/12 before touching 3, 8, 10 or 11.

## Tooling: MCP servers & connectors

**Use (already configured):**
- **Supabase MCP** — the spine of this plan. `apply_migration` for every
  numbered migration, `execute_sql` for probes and seeds,
  `deploy_edge_function` for Task 8, `get_advisors` after Task 3 (it flags
  RLS-disabled tables and policy gaps — run it as a free second opinion on the
  security core), `generate_typescript_types` after Task 2 to cross-check
  hand-written types.
- **Browser pane** (`preview_start` name `gaffer`) — every live verification.

**Use (activate at the start of the run):**
- **Serena** — semantic code navigation over the TS codebase. Activated for
  this repo on 2026-08-28 (`activate_project` → project name `gaffer`;
  a `.serena/` dir now exists at the repo root — do not commit it, and do NOT
  run its `onboarding` tool: this plan plus CLAUDE.md already carry the
  context onboarding would generate). It earned its place before the run
  started by finding the Task 5.0 call-site trap that grep-by-guess missed.
  Use it for exactly two things:
  - `find_referencing_symbols` **before changing any store action's
    signature** — the plan's biggest structural risk is a rescoped action
    breaking a call site nobody listed.
  - `find_symbol` to locate a component's real definition instead of
    guessing file paths (several recon values in Task 0 are lookups it
    answers directly).
  Keep using Read/Edit for the actual edits; Serena's editing tools are not
  needed and mixing them adds no value here.

**Do not bother with:** Vercel (unauthenticated in this environment, and the
app is not deployed through it), Chrome/computer-use (the Browser pane covers
every check this plan makes), Google Drive, Context7 (the two APIs in play —
supabase-js and Deno's `serve` — are used here in shapes already written out
verbatim in this plan; reach for it only if an Edge Function API surprises
you).

## Overnight Run Ground Rules

This plan is designed to execute unattended, end to end, in one night.

1. **No user input is required mid-run.** Everything needed (credentials
   minted here, MCP access, anon key in `.env.local`) is available to the
   executor. If something turns out to genuinely need Max (it shouldn't),
   skip that step, continue with what does not depend on it, and record it in
   HANDOFF.md.
2. **The database is live production.** The only destructive DB act in this
   plan is dropping `early_access_signup` (Task 1, dumped first). Everything
   else is additive. If a migration errors midway, do NOT improvise
   destructive fixes — record state in HANDOFF.md and continue with app-side
   tasks that don't depend on it.
3. **Stop-the-line conditions:** an RLS probe showing a cross-tenant leak
   must be fixed before proceeding to any later task — a leak is worse than
   an unfinished feature. Everything else fails soft (skip, record, continue).
4. **Cut-lines, in order** (apply only if the run is running out of room):
   (1) seed thumbnails → leave null, cards show placeholder; (2) Task 11
   licensing UI → skip, licensing stays SQL-proven only, note for D-day.
5. **Verification is empirical**: SQL probes via MCP `execute_sql`, HTTP
   probes via `curl` with real persona JWTs, UI via the Browser pane dev
   server (launch config `gaffer`; the `gaffer-landing` config is removed in
   Task 1). Browser-pane known traps (HANDOFF): reload before believing a
   dead control; check a fresh tab before believing a console error; confirm
   writes against the database, not the network log; clicks that trigger CSS
   transitions may time out while still succeeding.
6. **Finish ritual regardless of how far the run got:** HANDOFF.md session
   log written, all commits pushed nowhere (local only), final build/lint
   recorded.

---

### Task 0: Preflight & recon

**Files:**
- Create: branch `club-tenancy` (code isolation; DB changes are shared
  regardless — that's accepted)
- Create: `docs/superpowers/plans/2026-08-27-recon-notes.md` (recon results;
  committed so later tasks and the morning review can see them)

**Interfaces:**
- Produces: `RECON.*` values referenced by later tasks: next free migration
  number; exact current `pg_policies` rows for `drill`/`tactic`/storage;
  `team_coaches.role` distinct values; full column lists for `drill` and
  `tactic` from `information_schema`; the legacy account emails/ids
  (`RECON.LEGACY_ADMIN_EMAIL`, expected: Max's account + the test account
  `gaffertest2026v2@gmail.com`); baseline lint warning count; the drill/tactic
  editor + card + share route paths from `src/App.tsx`; the share-page viewer
  component names for drill and tactic (the components `/d/:token` and
  `/t/:token` render).

- [x] **Step 1: Branch and baseline.**

```bash
cd /Users/max/Desktop/app/gaffer
git checkout -b club-tenancy
npm run build && npm run lint
```
Expected: build clean; record the exact lint warning count/list as baseline.

- [x] **Step 2: DB recon via MCP** (`execute_sql`, read-only):

```sql
select distinct role from team_coaches;
select tablename, policyname, cmd, roles from pg_policies
  where schemaname='public' and tablename in ('drill','tactic') order by 1,2;
select policyname, cmd from pg_policies
  where schemaname='storage' and tablename='objects' order by 1;
select column_name, data_type, is_nullable from information_schema.columns
  where table_schema='public' and table_name='drill' order by ordinal_position;
select column_name, data_type, is_nullable from information_schema.columns
  where table_schema='public' and table_name='tactic' order by ordinal_position;
select id, email, created_at from auth.users order by created_at;
select count(*) from early_access_signup;
```
Also `ls supabase/migrations/` for the next free number.

- [x] **Step 3: Code recon.** Read `src/App.tsx`, `src/layout/AppShell.tsx`,
`src/hooks/useSession.ts`, `src/store/useStore.ts`, the share-route page
components, and `design.md`. Record in the recon notes: every route path and
which component renders it; the nav arrays (`NAV_ITEMS_TEAM` etc.); the shape
of `runSupabaseAction`; the share-viewer component names and their props.

**Already established on 2026-08-28 (re-confirm cheaply, don't re-derive):**

- `fetchDrills` call sites (7): `DrillLibrary`, `DesignPage:34`,
  `DrillEditorPage:26`, `DrillCardPage:81`, `TeamOverviewPage:33`,
  `SessionItemsPanel:133`, slice `drillSlice.ts:152/458`.
- `fetchTactics` call sites (6): `TacticsPage:48`, `TacticEditorPage:26`,
  `TacticCardPage:61`, `SessionItemsPanel:110`, slice `tacticSlice.ts:221/527`.
- `selectedTeamId` readers (17 files) — the ones that matter because they stay
  active: `DesignPage`, `DrillEditorPage`, `DrillCardPage`, `TacticEditorPage`,
  `TacticCardPage`, `TacticsPage`, `DrillLibrary`, `SquadPanel`, `AppShell`,
  `App`. The rest are shelved.
- `tsconfig.app.json`: `"include": ["src"]`, `noUnusedLocals: true`,
  `noUnusedParameters: true`, non-strict. Consequences are spelled out in
  Tasks 5, 6 and 7 — read them before editing signatures.
- `formation` table is `owner_id`-scoped (per user), NOT team-scoped —
  untouched by this rework.
- `TeamSwitcher.tsx` is the component Task 4's club switcher replaces.
- `_to_delete/` sits outside `src/`, so it never compiles. Leave it.

- [x] **Step 3b: Activate Serena for this repo** if a fresh session has not:
`activate_project` with `/Users/max/Desktop/app/gaffer` (project name
`gaffer`). **Do not run its `onboarding` tool** — CLAUDE.md plus this plan
already carry that context. Add `.serena/` to `.gitignore` if it is not
already ignored, so its cache never lands in a commit.

- [x] **Step 4: Commit recon notes.**

```bash
git add docs/superpowers/plans/2026-08-27-recon-notes.md
git commit -m "docs: recon notes for club tenancy run"
```

---

### Task 1: Remove the landing page

**Files:**
- Delete: `src/pages/landing/` (whole dir), `src/lib/waitlist.ts`
- Modify: `src/App.tsx` (signed-out branch), `.claude/launch.json` (remove
  `gaffer-landing` entry)
- Create: `supabase/migrations/026_drop_early_access_signup.sql`

**Interfaces:**
- Produces: signed-out `/` renders `Login`; no `/login` route remains (any
  hit on it redirects `/`); signed-in behavior and `/d/:token` / `/t/:token`
  / password-recovery routing unchanged.

- [x] **Step 1: Dump then drop the waitlist table.** If Task 0 found
`count(*) > 0`, first `select * from early_access_signup` via MCP and save the
rows to `../early_access_signup_backup_2026-08-27.json` (outside the repo —
014/021 precedent). Then write and `apply_migration`:

```sql
-- 026_drop_early_access_signup.sql
-- Landing page removed 2026-08-27 (spec §2.7). Pre-drop dump (if any rows):
-- ../early_access_signup_backup_2026-08-27.json. Migration 025 created this
-- table; per house rules 025 stays in the repo untouched.
drop table if exists early_access_signup;
```

- [x] **Step 2: Delete the landing code.** Remove `src/pages/landing/` and
`src/lib/waitlist.ts`. In `src/App.tsx`, replace the signed-out routed branch
with what preceded the landing (per its own git history —
`git show 96b1c0f^:src/App.tsx` shows the prior shape): signed-out renders
`Login` directly (keeping the `ResetPassword` / recovery branch exactly as
is). Remove the `gaffer-landing` block from `.claude/launch.json`.

- [x] **Step 3: Verify.** `npm run build && npm run lint` (baseline
warnings only). Start the Browser pane (`preview_start` name `gaffer`),
signed-out: `/` shows the sign-in form; `/some-junk-path` redirects to `/`;
sign in with the test account (`gaffertest2026v2@gmail.com` / `TestPass123!`)
→ app loads as before.

- [x] **Step 4: Commit.**

```bash
git add -A src/pages/landing src/lib/waitlist.ts src/App.tsx .claude/launch.json supabase/migrations/026_drop_early_access_signup.sql
git commit -m "feat: remove public landing page; drop early_access_signup (migration 026)"
```

---

### Task 2: Tenancy schema — tables, columns, backfill (additive migration)

**Files:**
- Create: `supabase/migrations/027_club_tenancy.sql`
- Modify: `src/store/types.ts`, `src/store/index.ts` (re-exports)

**Interfaces:**
- Produces (DB): tables `club`, `club_member`, `collection`,
  `collection_drill`, `collection_tactic`, `collection_access`,
  `club_license`; `drill.club_id uuid not null`, `drill.created_by uuid not
  null default auth.uid()`; same pair on `tactic`; `tactic.team_id` now
  nullable. RLS **enabled with no policies** on all new tables (default-deny
  until Task 3).
- Produces (TS): types below, exactly as named — later tasks import them.

```ts
export type ClubRole = 'admin' | 'coach'
export interface Club { id: string; name: string; created_at: string }
export interface ClubMembership {
  club_id: string; user_id: string; role: ClubRole
  display_name: string | null; created_at: string
  club: Club            // joined on fetch
}
export interface ClubMemberRow {
  club_id: string; user_id: string; role: ClubRole
  display_name: string | null; created_at: string
}
export interface Collection {
  id: string; club_id: string; name: string
  description: string | null; created_by: string; created_at: string
}
export interface ClubLicense {
  id: string; collection_id: string; target_club_id: string
  granted_by: string; created_at: string; revoked_at: string | null
}
// Drill gains: club_id: string; created_by: string
//   (team_id STAYS on the type — vestigial, no new code writes or reads it)
// Tactic gains: club_id: string; created_by: string; team_id: string | null
```

- [x] **Step 1: Write migration 027.** The backfill derives ownership from
`team_coaches` (Task 0 confirmed the owner role value — the SQL below assumes
`'owner'`; substitute the recon value if different).

```sql
-- 027_club_tenancy.sql — club tenancy core (spec §4). Additive only.
-- Backfill probes recorded at the bottom of this header after apply.

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
-- <LEGACY_ADMIN_EMAIL> comes from Task 0 recon.
update drill d set
  club_id = (select cm.club_id from club_member cm
             join auth.users u on u.id = cm.user_id
             where u.email = '<LEGACY_ADMIN_EMAIL>' and cm.role = 'admin' limit 1),
  created_by = (select id from auth.users where email = '<LEGACY_ADMIN_EMAIL>')
where d.club_id is null;

alter table drill alter column club_id set not null;
alter table drill alter column created_by set not null;
alter table tactic alter column club_id set not null;
alter table tactic alter column created_by set not null;
create index drill_club_id_idx on drill (club_id);
create index drill_created_by_idx on drill (created_by);
create index tactic_club_id_idx on tactic (club_id);
create index tactic_created_by_idx on tactic (created_by);
```

- [x] **Step 2: Apply via MCP** (`apply_migration`), then assert via
`execute_sql`:

```sql
select count(*) filter (where club_id is null) as drill_nulls,
       count(*) as drills from drill;
select count(*) filter (where club_id is null) as tactic_nulls,
       count(*) as tactics from tactic;
select c.name, cm.role, u.email from club c
  join club_member cm on cm.club_id = c.id join auth.users u on u.id = cm.user_id;
```
Expected: zero nulls; one club per legacy account, each with one admin row.
Record the output in 027's header comment.

- [x] **Step 3: Update `src/store/types.ts`** with the Interfaces block above
(add fields to `Drill`/`Tactic`; new interfaces; re-export any new names from
`src/store/index.ts` matching how existing types are re-exported).

- [x] **Step 4: Verify + commit.** `npm run build && npm run lint` (baseline).
The live app must still work fully — old team-based policies are still in
force; do a quick signed-in Browser check that the drill library still lists
drills (the app ignores the new columns so nothing observable changes).

```bash
git add supabase/migrations/027_club_tenancy.sql src/store/types.ts src/store/index.ts
git commit -m "feat: club tenancy schema — clubs, collections, licenses, document backfill (migration 027)"
```

---

### Task 3: RLS rewrite — helpers, policies, storage, create_club (the security core)

**Files:**
- Create: `supabase/migrations/028_club_rls.sql`

**Interfaces:**
- Produces (DB): helper functions `is_club_member(uuid)`,
  `is_club_admin(uuid)`, `can_read_collection(uuid)`,
  `drill_in_readable_collection(uuid)`, `tactic_in_readable_collection(uuid)`,
  and RPC `create_club(text) returns uuid` — later tasks call these names
  exactly. Drill/tactic visibility switches from team to club/collection.
  `drill_shared_read` / `tactic_shared_read` (018/023) are untouched.

- [x] **Step 1: Write migration 028.** The old team-based drill/tactic policy
names come from Task 0 recon — drop them by their real names (the `drop
policy` lines below name the likely candidates; fix to the recon list, and do
NOT drop the two `_shared_read` policies).

```sql
-- 028_club_rls.sql — the tenancy security core (spec §5).
-- Probe results are appended to this header after apply (see plan Task 3
-- Steps 3–5): per-persona SQL sweep, HTTP sweep, share-token re-probe.

-- ---------- helpers (security definer, pinned search_path) ----------
create or replace function is_club_member(cid uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.club_member
    where club_id = cid and user_id = (select auth.uid()));
$$;

create or replace function is_club_admin(cid uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.club_member
    where club_id = cid and user_id = (select auth.uid()) and role = 'admin');
$$;

-- Readable = admin of the owning club, OR granted + (home member or active
-- license into one of my clubs), OR admin of a club holding an active
-- license (so a receiving admin can see what they're dispersing).
create or replace function can_read_collection(col uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (
    select 1 from public.collection c
    where c.id = col and (
      public.is_club_admin(c.club_id)
      or exists (select 1 from public.club_license l
                 where l.collection_id = c.id and l.revoked_at is null
                   and public.is_club_admin(l.target_club_id))
      or (
        exists (select 1 from public.collection_access ca
                where ca.collection_id = c.id and ca.user_id = (select auth.uid()))
        and (
          public.is_club_member(c.club_id)
          or exists (select 1 from public.club_license l
                     where l.collection_id = c.id and l.revoked_at is null
                       and public.is_club_member(l.target_club_id))
        )
      )
    )
  );
$$;

create or replace function drill_in_readable_collection(d uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.collection_drill cd
    where cd.drill_id = d and public.can_read_collection(cd.collection_id));
$$;

create or replace function tactic_in_readable_collection(t uuid)
returns boolean language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.collection_tactic ct
    where ct.tactic_id = t and public.can_read_collection(ct.collection_id));
$$;

-- Bootstrap RPC: any signed-in user can found a club and become its admin.
create or replace function create_club(club_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare cid uuid;
begin
  if (select auth.uid()) is null then raise exception 'not signed in'; end if;
  if club_name is null or length(trim(club_name)) = 0 then
    raise exception 'club name required'; end if;
  insert into public.club (name) values (trim(club_name)) returning id into cid;
  insert into public.club_member (club_id, user_id, role)
    values (cid, (select auth.uid()), 'admin');
  return cid;
end $$;

-- ---------- club / membership ----------
create policy club_member_read on club for select to authenticated
  using (
    is_club_member(id)
    or exists (select 1 from club_license l
               join collection c on c.id = l.collection_id
               where c.club_id = club.id and l.revoked_at is null
                 and is_club_member(l.target_club_id))  -- see licensor's name
  );

create policy club_member_rows_read on club_member for select to authenticated
  using (is_club_member(club_id));
create policy club_member_admin_insert on club_member for insert to authenticated
  with check (is_club_admin(club_id));
create policy club_member_admin_update on club_member for update to authenticated
  using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy club_member_admin_delete on club_member for delete to authenticated
  using (is_club_admin(club_id));

-- ---------- collections ----------
create policy collection_read on collection for select to authenticated
  using (can_read_collection(id));
create policy collection_admin_write on collection for insert to authenticated
  with check (is_club_admin(club_id));
create policy collection_admin_update on collection for update to authenticated
  using (is_club_admin(club_id)) with check (is_club_admin(club_id));
create policy collection_admin_delete on collection for delete to authenticated
  using (is_club_admin(club_id));

create policy collection_drill_read on collection_drill for select to authenticated
  using (can_read_collection(collection_id));
create policy collection_drill_admin_write on collection_drill for insert to authenticated
  with check (is_club_admin((select c.club_id from collection c where c.id = collection_id)));
create policy collection_drill_admin_delete on collection_drill for delete to authenticated
  using (is_club_admin((select c.club_id from collection c where c.id = collection_id)));

create policy collection_tactic_read on collection_tactic for select to authenticated
  using (can_read_collection(collection_id));
create policy collection_tactic_admin_write on collection_tactic for insert to authenticated
  with check (is_club_admin((select c.club_id from collection c where c.id = collection_id)));
create policy collection_tactic_admin_delete on collection_tactic for delete to authenticated
  using (is_club_admin((select c.club_id from collection c where c.id = collection_id)));

-- Grants: home admin, or a receiving admin dispersing a licensed collection
-- to a member of their own club (spec §9 — one grant mechanism).
create policy collection_access_read on collection_access for select to authenticated
  using (
    user_id = (select auth.uid())
    or is_club_admin((select c.club_id from collection c where c.id = collection_id))
    or exists (select 1 from club_license l
               where l.collection_id = collection_access.collection_id
                 and l.revoked_at is null and is_club_admin(l.target_club_id))
  );
create policy collection_access_grant on collection_access for insert to authenticated
  with check (
    is_club_admin((select c.club_id from collection c where c.id = collection_id))
    or exists (select 1 from club_license l
               join club_member m on m.club_id = l.target_club_id
                 and m.user_id = collection_access.user_id
               where l.collection_id = collection_access.collection_id
                 and l.revoked_at is null and is_club_admin(l.target_club_id))
  );
create policy collection_access_revoke on collection_access for delete to authenticated
  using (
    is_club_admin((select c.club_id from collection c where c.id = collection_id))
    or exists (select 1 from club_license l
               where l.collection_id = collection_access.collection_id
                 and l.revoked_at is null and is_club_admin(l.target_club_id))
  );

-- ---------- licenses ----------
create policy club_license_read on club_license for select to authenticated
  using (
    is_club_admin((select c.club_id from collection c where c.id = collection_id))
    or is_club_admin(target_club_id)
  );
create policy club_license_grant on club_license for insert to authenticated
  with check (is_club_admin((select c.club_id from collection c where c.id = collection_id)));
create policy club_license_revoke on club_license for update to authenticated
  using (is_club_admin((select c.club_id from collection c where c.id = collection_id)))
  with check (is_club_admin((select c.club_id from collection c where c.id = collection_id)));

-- ---------- documents: club world replaces team world ----------
-- Names below per Task 0 recon; KEEP drill_shared_read / tactic_shared_read.
drop policy if exists drill_all_members on drill;
drop policy if exists drill_team_members on drill;
drop policy if exists tactic_all_members on tactic;

create policy drill_club_read on drill for select to authenticated
  using (
    is_club_admin(club_id)
    or created_by = (select auth.uid())
    or drill_in_readable_collection(id)
  );
create policy drill_club_insert on drill for insert to authenticated
  with check (is_club_member(club_id) and created_by = (select auth.uid()));
create policy drill_club_update on drill for update to authenticated
  using (is_club_admin(club_id) or created_by = (select auth.uid()))
  with check (is_club_member(club_id)
              and (is_club_admin(club_id) or created_by = (select auth.uid())));
create policy drill_club_delete on drill for delete to authenticated
  using (is_club_admin(club_id) or created_by = (select auth.uid()));

create policy tactic_club_read on tactic for select to authenticated
  using (
    is_club_admin(club_id)
    or created_by = (select auth.uid())
    or tactic_in_readable_collection(id)
  );
create policy tactic_club_insert on tactic for insert to authenticated
  with check (is_club_member(club_id) and created_by = (select auth.uid()));
create policy tactic_club_update on tactic for update to authenticated
  using (is_club_admin(club_id) or created_by = (select auth.uid()))
  with check (is_club_member(club_id)
              and (is_club_admin(club_id) or created_by = (select auth.uid())));
create policy tactic_club_delete on tactic for delete to authenticated
  using (is_club_admin(club_id) or created_by = (select auth.uid()));
```

- [x] **Step 2: Rewrite the storage policies.** Read the current
`drill-thumbnails` policies (Task 0 recon), then in the same migration replace
their team-based subqueries. Keep 019/024's `in (select ...)` shape — never a
correlated subquery (`name`-shadowing trap, documented twice in those
migrations). The subqueries lean on the documents' OWN new RLS (invoker
context), which is precisely the visibility we want:

```sql
-- (exact policy names from recon; the shape is what matters)
drop policy if exists "thumbnails members read" on storage.objects;
drop policy if exists "thumbnails members write" on storage.objects;
-- ...(each recon-listed thumbnail policy)...

create policy thumbnails_visible_read on storage.objects for select to authenticated
  using (bucket_id = 'drill-thumbnails' and (
    name in (select d.id::text || '.png' from drill d)
    or name in (select t.id::text || '.png' from tactic t)
  ));
create policy thumbnails_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'drill-thumbnails' and (
    name in (select d.id::text || '.png' from drill d
             where is_club_admin(d.club_id) or d.created_by = (select auth.uid()))
    or name in (select t.id::text || '.png' from tactic t
             where is_club_admin(t.club_id) or t.created_by = (select auth.uid()))
  ));
create policy thumbnails_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'drill-thumbnails' and (
    name in (select d.id::text || '.png' from drill d
             where is_club_admin(d.club_id) or d.created_by = (select auth.uid()))
    or name in (select t.id::text || '.png' from tactic t
             where is_club_admin(t.club_id) or t.created_by = (select auth.uid()))
  ));
create policy thumbnails_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'drill-thumbnails' and (
    name in (select d.id::text || '.png' from drill d
             where is_club_admin(d.club_id) or d.created_by = (select auth.uid()))
    or name in (select t.id::text || '.png' from tactic t
             where is_club_admin(t.club_id) or t.created_by = (select auth.uid()))
  ));
```

- [x] **Step 3: Apply, then run the SQL probe suite** via `execute_sql`. The
per-persona pattern (repeat per probe user id):

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '<USER_UUID>', 'role', 'authenticated')::text, true);
-- probes:
select count(*) from drill;             -- expected count for this persona
select count(*) from tactic;
select count(*) from collection;
select count(*) from club;
rollback;
```
Run for: the legacy admin (expect: all their drills/tactics), the test
account (expect: only its own), and a made-up uuid (expect: 0 everywhere).
**Any cross-tenant row = stop-the-line** (Ground Rule 3).

- [x] **Step 4: Share-token re-probe (018/023 suite, over HTTP).** Enable
sharing on one drill and one tactic (as the test account through the UI or
by minting tokens via the store path), then with `ANON` and `URL` from
`.env.local`:

```bash
# valid token → exactly one row; every negative → []
curl -s "$URL/rest/v1/drill?select=id,name" -H "apikey: $ANON" -H "x-share-token: $TOKEN"
curl -s "$URL/rest/v1/drill?select=id,name" -H "apikey: $ANON" -H "x-share-token: ${TOKEN%?}x"
curl -s "$URL/rest/v1/drill?select=id,name" -H "apikey: $ANON"
curl -s "$URL/rest/v1/tactic?select=id,name" -H "apikey: $ANON" -H "x-share-token: $TTOKEN"
# anon sweep with a valid drill token held — all must be []:
for t in availability drill_shared_nothing player player_notes session session_drills session_tactics team team_coaches tactic collection collection_drill collection_access club club_member club_license; do
  echo "$t: $(curl -s "$URL/rest/v1/$t?select=*" -H "apikey: $ANON" -H "x-share-token: $TOKEN")"; done
```
(A held *drill* token must expose nothing anywhere except that one drill row.)
Turn sharing back off afterwards; confirm zero live tokens by SQL.

- [x] **Step 5: Live app sanity.** Sign in as the test account in the Browser
pane: drill library still lists its drills (they're `created_by` the test
account and it is its club's admin — both read branches cover it); open one
drill in the editor, move an entity, confirm the save persists after reload
(update policy path). Record all probe outputs in 028's header.

- [x] **Step 6: Commit.**

```bash
git add supabase/migrations/028_club_rls.sql
git commit -m "feat: club RLS — helpers, document/collection/license policies, storage rewrite (migration 028)"
```

---

### Task 4: clubSlice, session bootstrap, Create-your-club, club switcher

**Files:**
- Create: `src/store/slices/clubSlice.ts`, `src/components/CreateClub.tsx`
- Modify: `src/store/useStore.ts` (wire slice), `src/App.tsx`,
  `src/layout/AppShell.tsx` (switcher mount point only — full nav rework is
  Task 7), `src/store/index.ts`

**Interfaces:**
- Consumes: types from Task 2; `create_club` RPC from Task 3;
  `runSupabaseAction` (existing).
- Produces (store API — exact names later tasks call):

```ts
interface ClubSlice {
  memberships: ClubMembership[]
  membershipsLoading: boolean
  membershipsError: string | null
  selectedClubId: string | null
  clubMembers: ClubMemberRow[]
  collections: Collection[]
  collectionDrillIds: Record<string, string[]>
  collectionTacticIds: Record<string, string[]>
  collectionAccess: Record<string, string[]>   // collectionId -> userIds
  licensesOut: ClubLicense[]                   // granted BY selected club
  licensesIn: ClubLicense[]                    // granted TO selected club
  fetchMemberships: () => Promise<void>
  selectClub: (clubId: string) => void
  createClub: (name: string) => Promise<boolean>
  fetchClubData: () => Promise<void>           // members/collections/joins/access/licenses for selectedClubId
  createCollection: (name: string, description: string | null) => Promise<Collection | null>
  updateCollection: (id: string, patch: { name?: string; description?: string | null }) => Promise<boolean>
  deleteCollection: (id: string) => Promise<boolean>
  addDrillToCollection: (collectionId: string, drillId: string) => Promise<boolean>
  removeDrillFromCollection: (collectionId: string, drillId: string) => Promise<boolean>
  addTacticToCollection: (collectionId: string, tacticId: string) => Promise<boolean>
  removeTacticFromCollection: (collectionId: string, tacticId: string) => Promise<boolean>
  grantCollectionAccess: (collectionId: string, userId: string) => Promise<boolean>
  revokeCollectionAccess: (collectionId: string, userId: string) => Promise<boolean>
  createCoach: (input: { email: string; password: string; displayName: string }) => Promise<string | null>
  grantLicense: (collectionId: string, targetClubId: string) => Promise<boolean>
  revokeLicense: (licenseId: string) => Promise<boolean>
  copyCollectionToClub: (collectionId: string, targetClubId: string) => Promise<boolean>
}
// Derived helpers exported from the slice file:
export const selectMyRole = (s: StoreState): ClubRole | null =>
  s.memberships.find(m => m.club_id === s.selectedClubId)?.role ?? null
export const canEditDoc = (s: StoreState, doc: { club_id: string; created_by: string }, userId: string | null) =>
  (selectMyRole(s) === 'admin' && doc.club_id === s.selectedClubId) || doc.created_by === userId
```

- [x] **Step 1: Write the slice.** Follow `teamSlice.ts`'s exact idioms:
every Supabase call through `runSupabaseAction`; `selectedClubId` persisted to
`localStorage` under `gaffer-selected-club` and reconciled against the fetched
membership list (mirror how `selectedTeamId` reconciles in `fetchTeams`);
`selectClub` clears club-scoped arrays (collections, members, licenses, and
the drill/tactic arrays via the existing clear patterns) before refetching.
Representative implementations (the rest follow the same
`runSupabaseAction` + local-state pattern):

```ts
fetchMemberships: async () => {
  set({ membershipsLoading: true, membershipsError: null })
  const rows = await runSupabaseAction<ClubMembership[]>(
    () => supabase.from('club_member')
      .select('club_id, user_id, role, display_name, created_at, club:club_id (id, name, created_at)')
      .order('created_at'),
    (msg) => set({ membershipsError: msg }),
  )
  // reconcile selectedClubId exactly as teamSlice reconciles selectedTeamId
  ...
},
createClub: async (name) => {
  const id = await runSupabaseAction<string>(
    () => supabase.rpc('create_club', { club_name: name }),
    (msg) => set({ membershipsError: msg }),
  )
  if (!id) return false
  await get().fetchMemberships(); get().selectClub(id); return true
},
createCoach: async ({ email, password, displayName }) => {
  // functions.invoke is not Postgrest — direct call, error handled here
  const { data, error } = await supabase.functions.invoke('create-coach', {
    body: { club_id: get().selectedClubId, email, password, display_name: displayName },
  })
  if (error || data?.error) { set({ clubActionError: error?.message ?? data.error }); return null }
  await get().fetchClubData(); return data.user_id as string
},
```

`fetchClubData` loads, for `selectedClubId`: `club_member` rows;
`collection` rows (RLS returns home + licensed-in); `collection_drill` /
`collection_tactic` / `collection_access` for those collections;
`club_license` where the club is source (join through its collections) or
target. Store the joins in the three `Record<string, string[]>` maps.

- [x] **Step 2: Bootstrap + Create-your-club.** In `App.tsx`'s signed-in
branch: call `fetchMemberships()` once on session start (same place
`fetchTeams` is called today — keep `fetchTeams` in place until Task 7
removes it). While `membershipsLoading`, render the existing loading state.
If `memberships.length === 0`, render `CreateClub` INSTEAD of the routed app:
a centered `Card` (design.md) with one name field and a "Create club" button
calling `createClub(name)`; on success the routed app appears. If
`memberships.length > 1`, `AppShell` renders a small club-name `<select>`
(design tokens, `bg-panel border-line`) in the nav header calling
`selectClub`; with one membership, render the club name as static text.

- [x] **Step 3: Verify.** Build/lint. Browser: test account signs in →
membership fetched (its backfilled club), app renders as before (libraries
still team-scoped — fine until Tasks 5–7). Sign up a brand-new throwaway
account (`overnight-check@gafferdemo.app` / `Check2026!`) → sees
Create-your-club; create "Scratch FC" → app renders with empty state; delete
the scratch club + membership + user note in HANDOFF (leave the user; deleting
auth users client-side isn't possible — record it as scratch).

- [x] **Step 4: Commit.**

```bash
git add src/store/slices/clubSlice.ts src/components/CreateClub.tsx src/store/useStore.ts src/store/index.ts src/App.tsx src/layout/AppShell.tsx
git commit -m "feat: clubSlice, membership bootstrap, create-your-club, club switcher"
```

---

### Task 5: Drill library rescope — folders, collections, read-only viewer

**Files:**
- Modify: `src/components/design/DrillLibrary.tsx`,
  `src/store/slices/drillSlice.ts` (fetch + create + duplicate),
  `src/App.tsx` (add `/drills/:drillId/view` route)
- Modify (**the call-site trap — found via Serena 2026-08-28, do not skip**):
  `src/pages/DrillEditorPage.tsx:26`, `src/pages/DrillCardPage.tsx:81`,
  `src/pages/DesignPage.tsx:34` — all three call `fetchDrills(selectedTeamId)`
  behind an `if (selectedTeamId)` gate, all three STAY ACTIVE after shelving,
  and `selectedTeamId` is never set once the team module is gone. Left alone,
  the drill editor and the print card silently fetch nothing and render empty
  — and `npm run build` stays green, so nothing catches it but a human
  opening a drill.
- Do NOT modify (shelved, but they still typecheck — `tsconfig.app.json` is
  `"include": ["src"]`): `src/pages/TeamOverviewPage.tsx:33`,
  `src/components/SessionItemsPanel.tsx:133`. They also call
  `fetchDrills(teamId)`, which is why Step 1 keeps an optional parameter
  rather than removing it.
- Create: `src/components/design/LibraryGroups.tsx` (shared grouping UI —
  Task 6 reuses it), `src/pages/DrillViewPage.tsx`

**Interfaces:**
- Consumes: `collections`, `collectionDrillIds`, `licensesIn`, `memberships`,
  `selectedClubId`, `canEditDoc`, `selectMyRole` (Task 4); recon's
  share-viewer component for drills.
- Produces: `fetchDrills()` (no longer takes a teamId — club-visibility
  scoped), `createDrill(input)` writing `club_id: selectedClubId` (and never
  `team_id`), `duplicateDrill(id)` landing the copy as
  `created_by = me, club_id = selectedClubId, share_token/thumbnail_url null`
  ("duplicate into my folder"); `LibraryGroups` component with props
  `{ groups: LibraryGroup[]; renderCard: (id: string) => ReactNode }` where

```ts
export interface LibraryGroup {
  key: string; title: string
  kind: 'mine' | 'collection' | 'licensed' | 'folder'
  ids: string[]
}
export function buildLibraryGroups(args: {
  docs: { id: string; created_by: string }[]
  collections: Collection[]
  collectionDocIds: Record<string, string[]>
  licensedCollectionIds: Set<string>       // collections whose club_id !== selectedClubId
  myUserId: string | null
  isAdmin: boolean
  members: ClubMemberRow[]                 // for admin folder titles
}): LibraryGroup[]
```

- [x] **Step 0: Re-run the call-site census before editing anything.** Files
move; this plan was written on 2026-08-27. Confirm the list above still holds:

Serena: `find_referencing_symbols` on `fetchDrills` in
`src/store/slices/drillSlice.ts` (or `find_symbol` with pattern `fetchDrills`,
`max_matches: 15`). Cross-check with `grep -rn "fetchDrills(" src`.
Expected (2026-08-28): 7 call sites — DrillLibrary, DesignPage,
DrillEditorPage, DrillCardPage, TeamOverviewPage, SessionItemsPanel, plus the
slice itself. Anything new in that list gets the same treatment as Step 1b.

- [x] **Step 1a: Rescope `drillSlice`, keeping the parameter optional.** The
signature keeps an ignored, underscore-prefixed parameter so the two shelved
callers still compile — `noUnusedParameters: true` is on, so the underscore is
load-bearing, not cosmetic:

```ts
// interface (was: fetchDrills: (teamId: string) => Promise<void>)
fetchDrills: (_teamId?: string) => Promise<void>

// implementation — RLS alone decides visibility now:
fetchDrills: async () => {
  set({ drillsLoading: true, drillsError: null })
  const rows = await runSupabaseAction<Drill[]>(
    () => supabase.from('drill').select('*').order('created_at', { ascending: false }),
    (msg) => set({ drillsError: msg }),
  )
  set({ drills: rows ?? [], drillsLoading: false })
},
```

`createDrill` sets `club_id` from `selectedClubId` and omits `team_id`
entirely (DB default leaves it null; `created_by` defaults to `auth.uid()`).
`duplicateDrill` explicitly sets `created_by` to the caller and nulls
`share_token`/`thumbnail_url` on the copy. Do not touch the file's
pre-existing uncommitted delete-action hunks.

- [x] **Step 1b: Un-gate the three active pages.** In `DrillEditorPage.tsx`,
`DrillCardPage.tsx` and `DesignPage.tsx`, the effect currently reads
`if (selectedTeamId) fetchDrills(selectedTeamId)`. Drop the gate and the
argument, and remove `selectedTeamId` from the component and the dependency
array (leave it if the component still uses it elsewhere — `noUnusedLocals`
will tell you):

```ts
useEffect(() => {
  void fetchDrills()
}, [fetchDrills])
```

Verify each one by eye afterwards: **`npm run build` cannot catch this class
of bug** — an un-run fetch is green at compile time and empty at runtime.

- [x] **Step 2: Grouped library.** Implement `buildLibraryGroups` (order: My
drills → home collections (a–z) → licensed collections (badged) → for admins,
one folder per other member with any unfiled docs, titled from
`display_name`). Rework `DrillLibrary.tsx`'s list area to render groups via
`LibraryGroups` (collapsible sections; existing card component and the
existing filters apply *within* the flattened visible set). Remove the
"Select a team to browse" gate. Licensed groups show a `Licensed` chip
(`text-warn` tone token).

- [x] **Step 3: Read-only viewer.** `DrillViewPage` renders the same viewer
component the `/d/:token` share page uses (recon name), fed from the store by
id instead of by token fetch. Card click routing: `canEditDoc(...)` → the
existing editor route; otherwise → `/drills/:drillId/view`. The viewer page
shows name + a "Duplicate to my drills" button calling `duplicateDrill`.

- [x] **Step 4: Verify.** Build/lint. Browser as test account (its club's
admin): library shows "My drills" with all 5 test drills, no team gate;
create a drill → appears in My drills; SQL-check the row has
`club_id`/`created_by` set and `team_id is null`. Read-only path can't be
fully exercised until coach personas exist (Task 12 rehearses it); assert the
routing branch by SQL-inserting nothing — instead temporarily verify
`canEditDoc` false-path renders by visiting `/drills/<id>/view` directly.

- [x] **Step 5: Commit** (note the pre-existing hunks riding along):

```bash
git add src/components/design/DrillLibrary.tsx src/components/design/LibraryGroups.tsx src/pages/DrillViewPage.tsx src/store/slices/drillSlice.ts src/App.tsx
git commit -m "feat: drill library rescoped to club visibility — folders, collections, read-only viewer"
```

---

### Task 6: Tactic library rescope + roster-free tactic editor

**Files:**
- Modify: `src/pages/TacticsPage.tsx`, `src/store/slices/tacticSlice.ts`
  (`fetchTactics` is declared at `:221`, implemented at `:527`),
  `src/components/tactics/SquadPanel.tsx` (confirmed to read `selectedTeamId`),
  `src/App.tsx` (add `/tactics/:tacticId/view`)
- Modify (**same call-site trap as Task 5, confirmed via Serena**):
  `src/pages/TacticEditorPage.tsx:26-30` and `src/pages/TacticCardPage.tsx:69-72`
  — both do `if (!selectedTeamId) return; void fetchTactics(selectedTeamId)`,
  both stay active, both go silently empty once team selection is gone. Note
  `TacticEditorPage` also calls `fetchPlayers(selectedTeamId)` on the same
  gate: drop that call entirely (rosters are shelved; Step 2 hides the UI that
  consumed it).
- Do NOT modify (shelved, still typechecks): `src/components/SessionItemsPanel.tsx:110`.
- Leave alone: `fetchCustomFormations()` — the `formation` table is
  `owner_id`-scoped per user, not team-scoped, so custom formations are
  unaffected by tenancy. Seeded personas simply start with none.
- Create: `src/pages/TacticViewPage.tsx`

**Interfaces:**
- Consumes: `LibraryGroups`/`buildLibraryGroups` (Task 5 — same shapes, docs
  are tactics), `canEditDoc`; recon's tactic share-viewer component.
- Produces: `fetchTactics()` parameterless; `createTactic(input)` writing
  `club_id`, `team_id: null`; the tactic editor fully functional with
  `team_id === null`.

- [x] **Step 1: Rescope `tacticSlice`** exactly as Task 5 Steps 0/1a/1b did
for drills — run the census first (`find_referencing_symbols` on
`fetchTactics`; expected 6 sites as of 2026-08-28), keep the ignored
`_teamId?: string` parameter so the shelved `SessionItemsPanel` caller
compiles, make the body club-scoped:

```ts
fetchTactics: (_teamId?: string) => Promise<void>   // interface

fetchTactics: async () => {
  set({ tacticsLoading: true, tacticsError: null })
  const rows = await runSupabaseAction<Tactic[]>(
    () => supabase.from('tactic').select('*').order('created_at', { ascending: false }),
    (msg) => set({ tacticsError: msg }),
  )
  set({ tactics: rows ?? [], tacticsLoading: false })
},
```

Then un-gate `TacticEditorPage` and `TacticCardPage` (drop the
`if (!selectedTeamId) return`, the argument, and — in the editor —
the `fetchPlayers` call). `createTactic` writes `club_id` + `team_id: null`;
add `duplicateTactic` mirroring `duplicateDrill` (caller's folder,
`share_token`/`thumbnail_url` nulled).

- [x] **Step 2: Roster-free editor.** In the squad panel and anywhere else
recon found roster reads (`fetchTeamRoster`, `rostersByTeam`,
`player_id`-binding UI): gate every roster surface behind `tactic.team_id !=
null` — and since new/copied tactics are always null this cycle, the visible
result is formation-driven generic squads (role + squad-number labels, all
existing formation/entity behavior intact). Do not delete the roster code
paths — they are the shelved module's re-entry point.

- [x] **Step 3: Grouped tactic library + viewer.** `TacticsPage` list area →
`LibraryGroups` (same grouping fn); card routing via `canEditDoc` to editor
or `/tactics/:tacticId/view`; `TacticViewPage` reuses the tactic share
viewer + "Duplicate to my tactics".

- [x] **Step 4: Verify.** Build/lint. Browser as test account: tactics page
lists the existing tactic under My tactics; create a new tactic → editor
opens with formation tools, NO roster panel content, place entities, save,
reload, intact; SQL-check `team_id is null, club_id set`. Open the OLD
tactic (has `team_id`) → editor still renders it correctly (roster UI may
show — it is dormant-legal, do not regress it).

- [x] **Step 5: Commit.**

```bash
git add src/pages/TacticsPage.tsx src/pages/TacticViewPage.tsx src/store/slices/tacticSlice.ts src/components/tactics/SquadPanel.tsx src/App.tsx
git commit -m "feat: tactic library rescoped to club; roster-free tactic editor"
```

---

### Task 7: Shell rework — shelve the team module

**Files:**
- Modify: `src/layout/AppShell.tsx`, `src/App.tsx`
- Untouched but now unrouted (the shelf): Dashboard, Teams, Calendar,
  Overview, PlayerRoster, SessionPlanner, AttendancePage and their nav
  entries; `teamSlice`/`playerSlice`/`sessionSlice`/`availabilitySlice`/
  `sessionDrillSlice`/`sessionTacticSlice` stay wired in the store (harmless
  — nothing calls their fetches once routes are gone).

**Interfaces:**
- Produces: signed-in nav = **Drill Library** (`/drills`, also the home
  route `/` redirect) · **Tactic Library** (`/tactics`) · **Admin**
  (`/admin`, rendered only when `selectMyRole(s) === 'admin'`; the `/admin`
  routes themselves exist from Task 8 — until then the entry may 404-redirect
  to `/`, acceptable for one task's window, or add the entry in Task 8
  instead: **do the latter**, it keeps every commit shippable). Team-scoped
  paths removed from the router; direct hits on old team URLs redirect `/`.
  `/d/:token`, `/t/:token`, card routes, editor routes, recovery: unchanged.

- [ ] **Step 1: Rework `AppShell`.** Collapse the two tab sets
(`NAV_ITEMS_TEAM` / coach-level) into one list: Drill Library, Tactic
Library. Keep the rail/drawer mechanics exactly as they are (expand-on-hover
rail, hamburger below `lg`). Remove `TEAM_SCOPED_PATHS` switching. Keep the
club switcher/name from Task 4 in the shell header.

- [ ] **Step 2: Rework routes.** In `App.tsx`: `/` → redirect `/drills`;
`/drills` renders the drill library page; `/tactics` as-is; remove the
team-scoped route registrations (leave their imports deleted — the files
stay); wildcard → `/drills`. Editor/card/share routes keep their exact
existing paths (Task 0 recon list — do not break share links).

- [ ] **Step 3: Verify.** Build/lint. Two compile hazards specific to this
task, both from `tsconfig.app.json`:
  - `"include": ["src"]` — the shelved page components are unrouted but **still
    typechecked**. They must keep compiling: that is why `Drill.team_id` stays
    on the type (Task 2) and why the fetch actions keep an optional
    `_teamId?` parameter (Tasks 5/6). Do not "clean up" either.
  - `noUnusedLocals: true` — every import and local you orphan by deleting a
    route is a build ERROR, not a warning. Deleting a route means deleting its
    import in the same edit. `TeamSwitcher` is the likely straggler: it is
    replaced by Task 4's club switcher, so its import and usage come out of
    `AppShell` here, while the file itself stays on the shelf.

Then in the Browser: nav shows exactly the two libraries; old `/teams`-era
URLs redirect home; hamburger works at 375px. **Then open each of the four
still-active document routes and confirm they actually render content, not an
empty state** — drill editor, tactic editor, a drill card, a tactic card.
This is the moment Tasks 5/6 Step 1b pays off (or, if skipped, the moment the
regression appears); a green build proves nothing here.

- [ ] **Step 4: Commit.**

```bash
git add src/layout/AppShell.tsx src/App.tsx
git commit -m "feat: library-centric shell — team module shelved (routes/nav removed, code dormant)"
```

---

### Task 8: Admin console I — Coaches page + create-coach Edge Function

**Files:**
- Create: `supabase/functions/create-coach/index.ts`,
  `src/pages/admin/AdminLayout.tsx`, `src/pages/admin/CoachesPage.tsx`
- Modify: `src/App.tsx` (routes `/admin` → redirect `/admin/coaches`,
  `/admin/coaches`), `src/layout/AppShell.tsx` (Admin nav entry, role-gated)

**Interfaces:**
- Consumes: `clubMembers`, `createCoach`, `fetchClubData`, `selectMyRole`.
- Produces: deployed Edge Function `create-coach` accepting
  `{ club_id, email, password, display_name }` with the caller's JWT,
  returning `{ user_id }` or `{ error }`; `AdminLayout` (sub-nav: Coaches ·
  Collections · Licenses · Transfer — later entries added by their tasks)
  guarding on `selectMyRole !== 'admin'` → redirect `/`.

- [ ] **Step 1: Write the Edge Function.**

```ts
// supabase/functions/create-coach/index.ts
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { club_id, email, password, display_name } = await req.json()
    if (!club_id || !email || !password) return json({ error: 'club_id, email, password required' }, 400)
    const url = Deno.env.get('SUPABASE_URL')!
    const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: caller } = await asCaller.auth.getUser()
    if (!caller?.user) return json({ error: 'not signed in' }, 401)
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: mem } = await admin.from('club_member').select('role')
      .eq('club_id', club_id).eq('user_id', caller.user.id).maybeSingle()
    if (mem?.role !== 'admin') return json({ error: 'not an admin of this club' }, 403)
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (error) return json({ error: error.message }, 400)
    const { error: e2 } = await admin.from('club_member').insert({
      club_id, user_id: created.user.id, role: 'coach',
      display_name: display_name ?? null,
    })
    if (e2) return json({ error: e2.message }, 400)
    return json({ user_id: created.user.id })
  } catch (e) {
    return json({ error: String(e) }, 400)
  }
})
```
Deploy via MCP `deploy_edge_function` (name `create-coach`, default JWT
verification ON).

- [ ] **Step 2: Coaches page.** `AdminLayout`: role guard + sub-nav
(design.md tokens; shared `ROW_GRID` constant for the members table header +
rows). `CoachesPage`: table of `clubMembers` (display name, role, joined
date) + a "Create coach" form (display name / email / password fields,
submit → `createCoach`, success appends to the table via the refetch inside
the action, error shown in `text-bad`).

- [ ] **Step 3: Verify.** Build/lint. Browser as test account (admin of its
club): `/admin/coaches` renders self as admin; create coach
`overnight.coach@gafferdemo.app` / `OvernightCoach2026!` "Night Coach" →
appears in table. Sign out; sign in AS that coach: sees empty libraries (no
grants yet), NO Admin nav entry, `/admin/coaches` direct hit redirects `/`.
Negative probe via curl: call the function with the coach's JWT →
`{"error":"not an admin of this club"}`. Keep this coach — Task 9 uses it,
Task 12's cleanup notes it.

- [ ] **Step 4: Commit.**

```bash
git add supabase/functions/create-coach/index.ts src/pages/admin/AdminLayout.tsx src/pages/admin/CoachesPage.tsx src/App.tsx src/layout/AppShell.tsx
git commit -m "feat: admin console — coaches page + create-coach edge function"
```

---

### Task 9: Admin console II — Collections: CRUD, filing, grants

**Files:**
- Create: `src/pages/admin/CollectionsPage.tsx`
- Modify: `src/App.tsx` (`/admin/collections`), `src/pages/admin/AdminLayout.tsx`
  (sub-nav entry)

**Interfaces:**
- Consumes: `collections`, `collectionDrillIds`, `collectionTacticIds`,
  `collectionAccess`, `clubMembers`, `drills`, `tactics`, and the eight
  collection actions from Task 4's slice API.
- Produces: the admin can do everything spec §6.2(2) names; no new store API.

- [ ] **Step 1: Build the page.** Left column: collection list (+ "New
collection" inline form → `createCollection`) with rename/delete
(`updateCollection`/`deleteCollection`, delete confirms inline like the
tree's existing delete-confirm pattern). Right column for the selected
collection, three stacked panels:
  1. **Drills** — two lists ("In collection" / "Available", from
     `collectionDrillIds[id]` vs the rest of `drills`), add/remove buttons →
     `addDrillToCollection`/`removeDrillFromCollection`.
  2. **Tactics** — identical shape over `collectionTacticIds`/`tactics`.
  3. **Coach access** — one row per non-admin `clubMembers` entry with a
     toggle bound to `collectionAccess[id].includes(user_id)` →
     `grantCollectionAccess`/`revokeCollectionAccess`.

- [ ] **Step 2: Verify (the visibility flip, live).** As test-account admin:
create collection "Passing Pack", file 2 drills + 1 tactic into it, grant it
to Night Coach (Task 8). Sign in as Night Coach: both libraries now show the
"Passing Pack" group with exactly those documents, read-only (card opens the
viewer, not the editor); "Duplicate to my drills" produces an editable copy
in their folder (SQL-check `created_by`). Back as admin: revoke the grant;
coach's next reload shows the group gone (own duplicate stays). Build/lint.

- [ ] **Step 3: Commit.**

```bash
git add src/pages/admin/CollectionsPage.tsx src/pages/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat: admin collections — CRUD, drill/tactic filing, per-coach grants"
```

---

### Task 10: Cross-club copy — SQL function + Transfer page

**Files:**
- Create: `supabase/migrations/029_copy_collection.sql`,
  `src/pages/admin/TransferPage.tsx`
- Modify: `src/App.tsx` (`/admin/transfer`), `src/pages/admin/AdminLayout.tsx`

**Interfaces:**
- Consumes: `memberships` (target = other clubs where my role is admin),
  `collections`, `copyCollectionToClub` (Task 4 slice API — implemented here
  as `supabase.rpc('copy_collection_to_club', ...)` via `runSupabaseAction`).
- Produces (DB): `copy_collection_to_club(src_collection uuid, target_club
  uuid) returns uuid` (the new collection's id).

- [ ] **Step 1: Write migration 029.** The explicit drill column list below
mirrors `src/store/types.ts` post-Task 2; reconcile it against Task 0's
`information_schema` output before applying (add/remove columns to match —
`team_id` is deliberately NOT copied, `share_token`/`thumbnail_url` are
deliberately nulled).

```sql
-- 029_copy_collection.sql — cross-club copy (spec §8).
create or replace function copy_collection_to_club(src_collection uuid, target_club uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  src_club uuid; new_col uuid; new_id uuid; r record;
begin
  select club_id into src_club from public.collection where id = src_collection;
  if src_club is null then raise exception 'collection not found'; end if;
  if not (public.is_club_admin(src_club) and public.is_club_admin(target_club)) then
    raise exception 'caller must be an admin of both clubs';
  end if;

  insert into public.collection (club_id, name, description, created_by)
  select target_club, name, description, (select auth.uid())
  from public.collection where id = src_collection
  returning id into new_col;

  for r in
    select d.* from public.drill d
    join public.collection_drill cd on cd.drill_id = d.id
    where cd.collection_id = src_collection
  loop
    insert into public.drill (
      club_id, created_by, name, scene, keyframes, duration_seconds, pitch,
      orientation, objective, description, category, subcategory,
      duration_minutes, players_recommended, min_players, max_players,
      age_min, age_max, difficulty, intensity, phase_of_play, session_block,
      setup_minutes, learning_outcome, video_url, coaching,
      share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), r.name, r.scene, r.keyframes,
      r.duration_seconds, r.pitch, r.orientation, r.objective, r.description,
      r.category, r.subcategory, r.duration_minutes, r.players_recommended,
      r.min_players, r.max_players, r.age_min, r.age_max, r.difficulty,
      r.intensity, r.phase_of_play, r.session_block, r.setup_minutes,
      r.learning_outcome, r.video_url, r.coaching,
      null, null)
    returning id into new_id;
    insert into public.collection_drill (collection_id, drill_id)
      values (new_col, new_id);
  end loop;

  for r in
    select t.* from public.tactic t
    join public.collection_tactic ct on ct.tactic_id = t.id
    where ct.collection_id = src_collection
  loop
    insert into public.tactic (
      club_id, created_by, team_id, name, scene, keyframes, duration_seconds,
      pitch, sides, phases, view, share_token, thumbnail_url)
    values (
      target_club, (select auth.uid()), null, r.name,
      -- strip legacy roster bindings from entities:
      jsonb_set(r.scene, '{entities}', coalesce(
        (select jsonb_agg(e - 'player_id')
         from jsonb_array_elements(r.scene->'entities') e), '[]'::jsonb)),
      r.keyframes, r.duration_seconds, r.pitch, r.sides, r.phases, r.view,
      null, null)
    returning id into new_id;
    insert into public.collection_tactic (collection_id, tactic_id)
      values (new_col, new_id);
  end loop;

  return new_col;
end $$;
```

- [ ] **Step 2: Transfer page.** Collection selector + target-club selector
(memberships where `role='admin'` and `club_id !== selectedClubId`; if none,
the page explains an admin must belong to a second club) + Copy button →
`copyCollectionToClub`; success panel offers "Switch to <club>" via
`selectClub`.

- [ ] **Step 3: Verify.** Can't be exercised until a second club exists — do
it NOW with scratch data instead of waiting: via `execute_sql`, create club
"Copy Target FC" + admin membership for the test account. Browser: Transfer
page shows it as a target; copy "Passing Pack" → switch club → both
libraries show the copies, editable (open one drill, move an entity, save);
SQL-assert: copied tactic scene has no `player_id` keys
(`select count(*) from tactic t, jsonb_array_elements(t.scene->'entities') e
where t.club_id='<target>' and e ? 'player_id'` → 0), all copies have
`share_token is null` and `team_id is null`; source club rows untouched
(counts unchanged). Then delete the scratch club (cascades memberships/
collections/documents by FK) and SQL-confirm source counts once more.
Build/lint.

- [ ] **Step 4: Commit.**

```bash
git add supabase/migrations/029_copy_collection.sql src/pages/admin/TransferPage.tsx src/pages/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat: cross-club copy — copy_collection_to_club (migration 029) + transfer page"
```

---

### Task 11: Licensing — grant, receive, disperse, revoke

**Files:**
- Create: `src/pages/admin/LicensesPage.tsx`
- Modify: `src/App.tsx` (`/admin/licenses`), `src/pages/admin/AdminLayout.tsx`

**Interfaces:**
- Consumes: `licensesOut`, `licensesIn`, `collections` (RLS already returns
  licensed-in collections to the receiving admin), `grantLicense`,
  `revokeLicense`, `grantCollectionAccess` (dispersal reuses it — spec §9),
  `clubMembers`.
- Produces: full license lifecycle in UI; coach libraries already render
  licensed groups (Task 5/6's `licensed` group kind — a collection whose
  `club_id !== selectedClubId` and appears via a grant).

- [ ] **Step 1: Build the page.** Two sections. **Outgoing:** grant form
(collection selector + target-club selector — same source as Transfer's) →
`grantLicense`; table of `licensesOut` with collection name, target club
name, granted date, and Revoke → `revokeLicense` (sets `revoked_at`, inline
confirm). **Incoming:** table of `licensesIn` (active only) with collection
name, source club name, and per-coach dispersal toggles identical to
CollectionsPage's coach-access panel (bound to the same
`collectionAccess`/`grantCollectionAccess`/`revokeCollectionAccess`).

- [ ] **Step 2: Verify the whole lifecycle** with scratch "License Target
FC" (created via SQL like Task 10's, test account as its admin, plus move
Night Coach's membership there for the coach-side check — SQL update, restore
after): grant → incoming appears for target admin; disperse to the coach →
coach's library shows the licensed group, badge visible, viewer-only, no
write path (attempt an update via curl with the coach's JWT → 0 rows);
revoke at source → target admin's incoming row gone, coach's group gone on
reload, their duplicated-earlier copies unaffected. Restore memberships,
delete scratch club. Record probe outputs in HANDOFF. Build/lint.

- [ ] **Step 3: Commit.**

```bash
git add src/pages/admin/LicensesPage.tsx src/pages/admin/AdminLayout.tsx src/App.tsx
git commit -m "feat: licensing — grant/revoke, incoming dispersal, read-only licensed libraries"
```

---

### Task 12: Demo seed — personas, clubs, libraries

**Files:**
- Create: `scripts/seed-demo-users.mjs`, `scripts/seed-demo.sql`

**Interfaces:**
- Produces: the four persona logins (fixed credentials, also recorded in
  DEMO_SCRIPT.md):
  `barca.admin@gafferdemo.app` / `BarcaAdmin2026!` (admin of both clubs),
  `barca.u12@gafferdemo.app` / `BarcaU12Coach2026!`,
  `barca.u18@gafferdemo.app` / `BarcaU18Coach2026!`,
  `riverside.coach@gafferdemo.app` / `RiversideCoach2026!`;
  clubs **FC Barcelona (demo)** (4 collections, ~16 drills, ~4 tactics,
  grants: U12 coach ← "U12 Foundation" + "U14 Passing Block", U18 coach ←
  "U18 Tactical" + "First Team Pressing") and **Riverside Academy**
  (near-empty).

- [ ] **Step 1: Persona script** (idempotent — signs in when the user
already exists):

```js
// scripts/seed-demo-users.mjs — run: node --env-file=.env.local scripts/seed-demo-users.mjs
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const anon = process.env.VITE_SUPABASE_ANON_KEY
const PERSONAS = [
  ['barca.admin@gafferdemo.app', 'BarcaAdmin2026!'],
  ['barca.u12@gafferdemo.app', 'BarcaU12Coach2026!'],
  ['barca.u18@gafferdemo.app', 'BarcaU18Coach2026!'],
  ['riverside.coach@gafferdemo.app', 'RiversideCoach2026!'],
]
for (const [email, password] of PERSONAS) {
  const c = createClient(url, anon)
  let { data, error } = await c.auth.signUp({ email, password })
  if (error || !data?.user?.id) {
    ;({ data, error } = await c.auth.signInWithPassword({ email, password }))
    if (error) throw new Error(`${email}: ${error.message}`)
  }
  console.log(email, data.user.id)
}
```

- [ ] **Step 2: Seed SQL** (`scripts/seed-demo.sql`, applied via MCP
`execute_sql`; idempotent via the existence check; `<LEGACY_ADMIN_EMAIL>`
from recon supplies the template drills/tactics):

```sql
do $$
declare
  v_admin uuid := (select id from auth.users where email = 'barca.admin@gafferdemo.app');
  v_u12   uuid := (select id from auth.users where email = 'barca.u12@gafferdemo.app');
  v_u18   uuid := (select id from auth.users where email = 'barca.u18@gafferdemo.app');
  v_rvc   uuid := (select id from auth.users where email = 'riverside.coach@gafferdemo.app');
  v_legacy_club uuid := (select cm.club_id from club_member cm
      join auth.users u on u.id = cm.user_id
      where u.email = '<LEGACY_ADMIN_EMAIL>' and cm.role = 'admin' limit 1);
  v_barca uuid; v_riverside uuid; v_col uuid; new_id uuid; r record; n int;
  cols text[] := array['U12 Foundation','U14 Passing Block','U18 Tactical','First Team Pressing'];
  prefixes text[] := array['U12','U14','U18','First Team'];
  col_ids uuid[] := array[]::uuid[];
begin
  if v_admin is null then raise exception 'run seed-demo-users.mjs first'; end if;
  if exists (select 1 from club where name = 'FC Barcelona (demo)') then
    raise notice 'already seeded'; return; end if;

  insert into club (name) values ('FC Barcelona (demo)') returning id into v_barca;
  insert into club (name) values ('Riverside Academy') returning id into v_riverside;
  insert into club_member (club_id, user_id, role, display_name) values
    (v_barca, v_admin, 'admin', 'Alex Marino'),
    (v_barca, v_u12,  'coach', 'Sam Whitfield'),
    (v_barca, v_u18,  'coach', 'Jordan Achebe'),
    (v_riverside, v_admin, 'admin', 'Alex Marino'),
    (v_riverside, v_rvc, 'coach', 'Riley Donnelly');

  for n in 1..4 loop
    insert into collection (club_id, name, created_by)
      values (v_barca, cols[n], v_admin) returning id into v_col;
    col_ids := col_ids || v_col;
    -- 4 renamed drill copies per collection from the legacy library
    for r in (select d.* from drill d where d.club_id = v_legacy_club
              order by d.created_at limit 4) loop
      insert into drill (club_id, created_by, name, scene, keyframes,
        duration_seconds, pitch, orientation, objective, description,
        category, subcategory, duration_minutes, players_recommended,
        min_players, max_players, age_min, age_max, difficulty, intensity,
        phase_of_play, session_block, setup_minutes, learning_outcome,
        video_url, coaching, share_token, thumbnail_url)
      values (v_barca, v_admin, prefixes[n] || ' · ' || r.name, r.scene,
        r.keyframes, r.duration_seconds, r.pitch, r.orientation, r.objective,
        r.description, r.category, r.subcategory, r.duration_minutes,
        r.players_recommended, r.min_players, r.max_players, r.age_min,
        r.age_max, r.difficulty, r.intensity, r.phase_of_play,
        r.session_block, r.setup_minutes, r.learning_outcome, r.video_url,
        r.coaching, null, null)
      returning id into new_id;
      insert into collection_drill (collection_id, drill_id) values (v_col, new_id);
    end loop;
  end loop;

  -- one tactic copy into each of the two tactical collections
  for r in (select t.* from tactic t where t.club_id = v_legacy_club
            order by t.created_at limit 2) loop
    insert into tactic (club_id, created_by, team_id, name, scene, keyframes,
      duration_seconds, pitch, sides, phases, view, share_token, thumbnail_url)
    values (v_barca, v_admin, null, 'FC · ' || r.name,
      jsonb_set(r.scene, '{entities}', coalesce(
        (select jsonb_agg(e - 'player_id')
         from jsonb_array_elements(r.scene->'entities') e), '[]'::jsonb)),
      r.keyframes, r.duration_seconds, r.pitch, r.sides, r.phases, r.view,
      null, null)
    returning id into new_id;
    insert into collection_tactic (collection_id, tactic_id)
      values (col_ids[3], new_id);
  end loop;

  -- grants: each coach gets their two collections
  insert into collection_access (collection_id, user_id, granted_by) values
    (col_ids[1], v_u12, v_admin), (col_ids[2], v_u12, v_admin),
    (col_ids[3], v_u18, v_admin), (col_ids[4], v_u18, v_admin);
end $$;
```
(Reconcile the tactic column list against recon exactly as Task 10 did. If
the legacy library has fewer than 4 drills/2 tactics the loops naturally
shrink — fine.)

- [ ] **Step 3: Verify by SQL then by eye.** SQL: Barca has 4 collections,
16 drills, 2 tactics; U12 persona's `can_read` set = 8 drills (probe with the
per-persona `set_config` pattern from Task 3). Browser: sign in as each
persona — admin sees everything grouped; U12 coach sees exactly U12
Foundation + U14 Passing Block, read-only; U18 likewise; riverside coach
sees an empty library. Clean up Task 8's scratch: remove Night Coach's
membership row (the auth user stays; note in HANDOFF).

- [ ] **Step 4: Commit.**

```bash
git add scripts/seed-demo-users.mjs scripts/seed-demo.sql
git commit -m "feat: demo seed — persona logins, FC Barcelona (demo) + Riverside Academy"
```

---

### Task 13: Demo script, full rehearsal, HANDOFF

**Files:**
- Create: `DEMO_SCRIPT.md`
- Modify: `HANDOFF.md` (new session log at top, per house convention)

- [ ] **Step 1: Write `DEMO_SCRIPT.md`** — the persona credentials table,
then the demo arc as numbered steps with the exact clicks: (1) sign in as
Barca admin, tour both libraries (folders + collections); (2) `/admin/coaches`
— create a coach live; (3) `/admin/collections` — grant that coach a
collection; (4) sign in as the U12 coach — show the scoped view, open a
drill read-only, play its animation, duplicate one into the coach's folder;
(5) coach creates a drill — lands in their folder, invisible to the other
coach; (6) back as admin — Transfer: copy "U14 Passing Block" to Riverside,
switch clubs, show the editable copies; (7) Licenses: license "First Team
Pressing" to Riverside, switch, disperse to Riley, sign in as Riley → licensed
read-only group; (8) revoke at source → Riley reloads, it's gone. Include a
"reset between rehearsals" appendix: the SQL to delete both demo clubs
(cascades) + re-run of the two seed steps.

- [ ] **Step 2: Full rehearsal, run once end-to-end** in the Browser pane
following DEMO_SCRIPT.md literally, at desktop width, then spot-check the
library pages and admin pages at 375×812 (`resize_window` mobile preset;
known trap: transition-triggering clicks may time out — verify via DOM, not
the click result). Zero console errors on a fresh tab at each step. Fix
whatever the rehearsal finds before proceeding — the rehearsal IS the
acceptance test.

- [ ] **Step 3: Final checks + HANDOFF.** `npm run build && npm run lint`
(baseline warnings only). Write the HANDOFF.md session log: what shipped
(task list + commit shas), probe evidence summary, scratch data notes
(Night Coach auth user; overnight-check user), known gaps (seeded thumbnails
null → cards show placeholders; anything cut under Ground Rule 4), and the
morning checklist for Max: eyeball the rehearsal flow once, decide merge of
`club-tenancy` → `main`, optionally record real thumbnails by opening seeded
drills.

- [ ] **Step 4: Commit.**

```bash
git add DEMO_SCRIPT.md HANDOFF.md
git commit -m "docs: demo script + overnight run handoff"
```

---

## Self-review record (author's pass)

- **Spec coverage:** §2.1→Tasks 3/12; §2.2→T2 backfill; §2.3/2.4→T4/5/9;
  §2.5→T6/9; §2.6→T10/11; §2.7→T1; §2.8→T7; §4→T2; §5→T3; §6.1→T4/7;
  §6.2→T8/9/10/11; §6.3→T5/6; §6.4→T1; §7→T8; §8→T10; §9→T11; §10→T12/13;
  §12's probe protocol→T3 and every verify step. Gap check: spec §4.2's
  `drill.team_id` drop is deliberately deviated (demote, not drop) — spec
  amended to v2.1 alongside this plan.
- **Type consistency:** slice API names in Tasks 5/6/9/10/11 all come from
  Task 4's interface block; helper names in Tasks 5–11 SQL all come from
  Task 3; persona emails identical across Tasks 8/12/13.
- **Known honest limits:** exact current policy names, route paths, and
  viewer component names are recon-bound (Task 0) because this plan was
  written without exhaustively reading every file — each task that needs one
  says exactly which recon value it consumes.

## Amendment log

**2026-08-28 — call-site census (found with Serena before the run started).**
The first draft of Tasks 5 and 6 listed three files between them for the
fetch-rescope. The real count is 7 call sites for `fetchDrills` and 6 for
`fetchTactics`, and — the part that mattered — five of them are in pages that
**stay active** (`DrillEditorPage`, `DrillCardPage`, `DesignPage`,
`TacticEditorPage`, `TacticCardPage`), each gating its fetch on a
`selectedTeamId` that stops being set the moment Task 7 shelves team
selection. The failure mode is a green build with empty editors and empty
print cards: invisible to `npm run build`, invisible to lint, visible only to
a human opening a drill — i.e. most likely discovered during the demo.
Tasks 5 and 6 now open with a census step, keep an underscore-prefixed
optional parameter (required by `noUnusedParameters`) so shelved callers still
compile, and un-gate the active pages explicitly; Task 7's verify step now
demands all four document routes be opened and seen rendering content.
Lesson for the run: **before changing any store action's signature, run
`find_referencing_symbols` on it.**

**2026-08-28 — Task 0 recon corrections (full detail in
`2026-08-27-recon-notes.md`).** Six factual corrections to this plan's
assumptions, none blocking, all applied before the tasks that depend on
them:
1. Real drill policy name is `drill_all_members_or_unscoped`, not
   `drill_all_members`/`drill_team_members` as Task 3 guessed. `tactic_all_
   members` guessed correctly. Task 3's drop statements corrected.
2. Real storage policy names are `drill_thumbnail_select/insert/update/
   delete`, not the `"thumbnails members ..."` names Task 3 guessed. Corrected.
3. `tactic` has real columns `description` and `phase_of_play` that Task 10's
   `copy_collection_to_club` and Task 12's seed script both omitted from
   their INSERT column lists — the exact "silent omission" risk Task 10's own
   header calls out. Fixed in both places.
4. `runSupabaseAction`'s real signature is `(action, fallbackMessage?) =>
   Promise<{data, error}>`, not the callback-based
   `(action, onError) => rows` shape Task 4's pseudocode assumed. Task 4's
   `clubSlice` (and every slice action in Tasks 5/6/9/10/11) follows the real
   idiom from `teamSlice.ts` instead.
5. design.md mandates the `Dropdown` component for every single-choice
   picker — native `<select>` is explicitly retired app-wide. Every place
   this plan's prose says "select" (club switcher, target-club pickers in
   Tasks 9/10/11) means `Dropdown`.
6. `select count(*) from drill where team_id is null` = 0 today, so migration
   027's "coach-wide drills → legacy admin" backfill UPDATE is a no-op on
   current data — left in the migration anyway as a correct safety net, not
   removed.

Also confirmed via Serena (unchanged from the 2026-08-27 census): 6 external
`fetchDrills` call sites, 4 external `fetchTactics` call sites — same file
sets the plan already lists, exact line numbers drifted a handful of lines
(immaterial).

**2026-08-28 — Task 3 review: `collection_access_revoke` cross-tenant write
bug found and fixed before applying migration 028.** The plan-draft policy
let a receiving (licensee) club's admin delete ANY `collection_access` row
on a collection licensed to them — including the SOURCE club's own home
grants to its own coaches, not just the dispersals the receiving admin
themself created. A licensee admin could therefore reach into the licensor
club's internal permissions and revoke a coach's home-club access, which is
a real cross-tenant boundary violation even though it's a write-scope bug
rather than a read leak (no unauthorized data was exposed by it). Fixed by
requiring the deleted row's `user_id` belong to a member of the caller's own
(target) club — the exact same join `collection_access_grant` already uses
to scope the insert side. Found and fixed during the mandated close review
of Task 3 (the plan's one stop-the-line task), before the migration was
applied live; full reasoning is in migration 028's own header comment next
to the corrected policy. No stop-the-line was triggered — nothing in the
per-persona/share-token probe suite (run after the fix) showed a read leak.

**2026-08-28 — Task 5: card-click routing implemented as an added "Open in
editor"/"View" affordance, not a literal onClick replacement.** The plan's
prose ("card click routing: canEditDoc → the existing editor route;
otherwise → the viewer") read literally would replace `DrillLibrary`'s grid
card onClick (today: toggle an inline preview panel with Play/Duplicate/
Delete) with straight navigation — which would stroke the existing
Duplicate/Delete actions from every reachable UI path, since nothing else
in the app exposes them (confirmed: `deleteDrill`/`duplicateDrill` have no
other call site). That preview panel is one of the tree's pre-existing
uncommitted hunks the ground rules say to edit around and keep intact, and
orphaning its buttons behind an unreachable branch isn't "intact" in any
meaningful sense. Implemented instead: the grid card keeps its existing
select-to-preview behavior unchanged; the preview panel gained a real
"Open in editor" / "View" link (routes exactly as the plan specifies,
`canEditDoc` ? `/design/:id` : `/drills/:id/view`) and its Delete button is
now hidden when `canEditDoc` is false (previously visible regardless of
ownership, always failing server-side via RLS for a non-owner — a
pre-existing rough edge, tightened here since it's directly this task's
visibility model). Net effect matches the plan's functional intent (both
routes exist and are reachable) without deleting or stranding working
code. Also added, not explicitly listed in the plan's file scope but a real
gap it implied: a "+ New drill" link from the library to `/design`, since
`/design` is the *only* create-drill entry point in the app (confirmed by
grep — `CreateDrillForm` has exactly one call site) and Task 7 removes its
last nav link.

**2026-08-28 — LibraryGroups split into two files, not one.** The plan
names a single `LibraryGroups.tsx`. Exporting both the `buildLibraryGroups`
function and the `LibraryGroups` component from one file trips oxlint's
react-refresh rule (a file should export only components) — the codebase
already has a precedent for splitting this exact way (`Badge.tsx` /
`badgeTones.ts`), so `buildLibraryGroups.ts` (named to avoid colliding with
`LibraryGroups.tsx` on a case-insensitive filesystem — macOS/Windows
default) now holds the `LibraryGroup` type and the builder function;
`LibraryGroups.tsx` holds only the component. Task 6 (tactic library) reuses
both from `buildLibraryGroups.ts`, same as the plan intended from one file.

**2026-08-28 — Task 6: three corrections found while implementing.**
1. **`duplicateTactic` can't go through `createTactic` + `updateTactic`**,
   unlike `duplicateDrill`. `TacticUpdateInput` deliberately excludes every
   content field (scene/keyframes/phases/duration_seconds/pitch/sides/view
   — "one path through the autosave flush", per its own header comment), so
   there is no patch call that can seed a duplicate's starting content.
   Implemented as a direct `insert` instead (mirrors the shape migration
   029's `copy_collection_to_club` uses at the SQL level for the same
   reason) — and for the same reason that function strips `player_id`,
   `duplicateTactic` does too (it can duplicate a tactic reached via a
   licensed/granted collection, Task 9's "Duplicate to my tactics", which
   may belong to a different club than the caller's; a roster-bound
   reference to the source club's team/players would dangle). Also nulls
   both sides' `teamId` for the same cross-club-dangling reason.
2. **`TacticEditorPage.tsx` and `TacticCardPage.tsx`'s `fetchCustomFormations`
   calls were ALSO wrongly gated on `selectedTeamId`**, despite the plan's
   own recon note that the `formation` table is owner_id-scoped, not
   team-scoped, and therefore unaffected by tenancy. Since `selectedTeamId`
   stops being set once Task 7 shelves team selection, this was the exact
   same call-site-trap failure mode as `fetchTactics` in the same two
   files, just not named in the plan's file-by-file list — fixed alongside
   the calls that were named, not left for a later surprise.
3. **`SquadPanel.tsx`'s roster-free gate** (Step 2) is keyed off a single
   `rosterFree = tactic.team_id == null` computed once, applied uniformly
   to both sides — not per-side. The plan's wording ("gate every roster
   surface behind tactic.team_id != null") doesn't specify whether an
   away-side team binding should stay available on an otherwise
   roster-free tactic; decided against it, since a half roster-free /
   half roster-bound tactic has no way to reach that state through the
   app (every roster-free tactic starts with team_id null and no code
   path sets a non-null team_id on it afterward), so allowing it would be
   dead UI, not a real choice.
