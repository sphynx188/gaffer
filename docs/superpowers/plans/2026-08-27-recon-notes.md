# Task 0 recon notes — club tenancy run (2026-08-28)

Gathered before touching any code, per plan Task 0. Corrections vs. the
plan's assumptions are called out explicitly — the plan was written without
exhaustively reading every file; this is the ground truth it asked for.

## RECON.NEXT_MIGRATION_NUMBER

`026` — matches the plan's assumption. `ls supabase/migrations/` tail:
`...023_tactic_share_policy.sql, 024_tactic_thumbnails_and_duplicate.sql,
025_early_access_signup.sql`. No renumbering needed.

## RECON.TEAM_COACHES_ROLE

`select distinct role from team_coaches` → **only `'owner'`** exists. Matches
migration 027's assumption exactly, no substitution needed.

## RECON.POLICY_NAMES (correction vs. plan's guesses)

`pg_policies` on `drill`/`tactic` (public schema):

| table | policyname | cmd | roles |
|---|---|---|---|
| drill | `drill_all_members_or_unscoped` | ALL | authenticated |
| drill | `drill_shared_read` | SELECT | anon |
| tactic | `tactic_all_members` | ALL | authenticated |
| tactic | `tactic_shared_read` | SELECT | anon |

Plan's Task 3 guessed `drill_all_members` / `drill_team_members` for drill —
**neither is the real name**. Real name is `drill_all_members_or_unscoped`.
`tactic_all_members` matched. Task 3's migration 028 drop statements are
corrected to drop the real name (plus keep the guessed names as harmless
`drop policy if exists` no-ops, in case a differently-named leftover exists).
Do NOT drop `drill_shared_read` / `tactic_shared_read` (both anon, untouched
by this rework, confirmed here).

Storage (`storage.objects`, `drill-thumbnails`) policies — **also a
correction**, the plan's Task 3 guessed names like `"thumbnails members
read"`. Real names:

| policyname | cmd |
|---|---|
| `drill_thumbnail_select` | SELECT |
| `drill_thumbnail_insert` | INSERT |
| `drill_thumbnail_update` | UPDATE |
| `drill_thumbnail_delete` | DELETE |

Task 3 migration 028 drops these four real names.

## RECON.DRILL_COLUMNS / RECON.TACTIC_COLUMNS

`drill` (public), in `information_schema` order: `id, team_id, name,
created_at, orientation, scene, keyframes, duration_seconds, pitch,
objective, description, category, subcategory, duration_minutes,
players_recommended, min_players, max_players, age_min, age_max, difficulty,
intensity, phase_of_play, session_block, setup_minutes, learning_outcome,
video_url, thumbnail_url, coaching, share_token`. Matches Task 10's copy
column list exactly (26 non-id/team_id/created_at columns) — no correction
needed there.

`tactic` (public): `id, team_id, name, created_at, scene, keyframes, phases,
duration_seconds, pitch, sides, view, description, phase_of_play,
thumbnail_url, share_token`.

**Correction (real bug the plan would have shipped silently):** the plan's
Task 10 `copy_collection_to_club` tactic INSERT column list and Task 12's
seed-script tactic INSERT column list both **omit `description` and
`phase_of_play`**, which are real columns on `tactic`. Fixed in both
migration 029 and the seed script to include them. This is exactly the
"silent omission" risk Task 10's own header names.

`tactic.team_id` is currently `NOT NULL` (confirmed) — migration 027's `alter
column team_id drop not null` is required and correctly included.

## RECON.LEGACY_ADMIN_EMAIL / accounts

5 `auth.users` rows total. `team_coaches.role='owner'` holders (3):

| user_id | email | teams owned | drills (via owned teams) | tactics |
|---|---|---|---|---|
| `a88ff958-e9f2-4ef0-a440-56401762162c` | `maxburatto68@gmail.com` | 2 | 8 | 3 |
| `4ba4e69f-54e5-4b18-a855-e484aff1c908` | (not queried — no content, not needed) | 2 | 0 | 0 |
| `e13c5237-d941-487c-917e-7b5e377b2d09` | `gaffertest2026v2@gmail.com` (the documented test account) | 1 | 9 | 2 |

**RECON.LEGACY_ADMIN_EMAIL = `maxburatto68@gmail.com`** (earliest account,
2026-08-18, most content — this is Max's real working account).

The other 2 auth.users rows (`97f29a2b...`, `e0475591...`) own zero teams —
not team_coaches owners at all, so migration 027's backfill loop creates no
club for them. After 027+028 they'll have zero `club_member` rows; if they
ever sign in they hit Task 4's Create-your-club bootstrap. Not a concern —
likely earlier throwaway signups, left alone (never delete auth users, per
ground rules).

**Correction:** `select count(*) from drill where team_id is null` → **0**.
The plan's migration 027 "coach-wide drills belong to the legacy account"
UPDATE step is a no-op on this data (every drill already resolves to an
owner via its `team_id`) — kept in the migration anyway as a correct
no-op safety net, not removed, since a future concurrent write between
recon and apply could theoretically introduce one.

## RECON.EARLY_ACCESS_SIGNUP

`count(*) = 0`. No pre-drop dump needed for Task 1 Step 1 (the plan's dump
step is conditional on count > 0; skipped).

## RECON.ROUTES (src/App.tsx, current/pre-Task-1 state)

Above the auth gate (public): `/d/:token` → `SharedDrillPage`, `/t/:token`
→ `SharedTacticPage`.

Signed-out (`AuthedApp`, no session): index `/` → `LandingPage`, `/login` →
`Login`, `*` → redirect `/`. Task 1 replaces this whole branch with: `*` →
`Login` directly (no `/login` route — matches the plan's own description of
the pre-landing shape), keeping the `isPasswordRecovery` branch above it
exactly as-is (untouched by Task 1).

Signed-in: `/login` → redirect `/` (stray bookmark). Outside `AppShell`:
`drills/:drillId/card` → `DrillCardPage`, `tactics/:tacticId/card` →
`TacticCardPage`. Inside `AppShell`: `/` (index) → `DashboardPage`,
`/overview` → `TeamOverviewPage`, `/roster` → `RosterPage`, `/sessions` →
`SessionsPage`, `/attendance` → `AttendancePage`, `/design` → `DesignPage`,
`/design/:drillId` → `DrillEditorPage` (**note: drill editor route is
`/design/:drillId`, not `/drills/:id/edit`**), `/drills` →
`DrillLibraryPage`, `/tactics` → `TacticsPage`, `/tactics/:tacticId` →
`TacticEditorPage`, `/teams` → `TeamSettingsPage`, `/calendar` →
`CalendarPage`, `*` → redirect `/`.

`.claude/launch.json` confirmed: two configs, `gaffer` (port 5173) and
`gaffer-landing` (port 5175, `--strictPort`) — Task 1 removes the latter.

## RECON.NAV (src/layout/AppShell.tsx)

`NAV_ITEMS_COACH` = Dashboard(`/`,end)/Teams(`/teams`)/Calendar(`/calendar`).
`NAV_ITEMS_TEAM` = Overview/Roster/Sessions/Attendance/Design/Drill
library(`/drills`)/Tactics(`/tactics`). `TEAM_SCOPED_PATHS` = `['/overview',
'/roster', '/sessions', '/attendance', '/design', '/drills', '/tactics']`
gates which set renders, driven by route not `selectedTeamId`. Rail rests at
`w-14`, expands `w-52` on hover/focus-within of a `.group` wrapper (not the
`<aside>` itself); `<main>` reserves `lg:pl-16`. `TeamSwitcher` (imported
line 24) renders in the header breadcrumb (desktop, `showTeamSelector`
condition) and in the mobile drawer — confirmed as the two mount points
Task 4's club switcher replaces (also drop the import — `noUnusedLocals`).

## RECON.RUNSUPABASEACTION (correction — load-bearing for every later slice)

**The plan's Task 4 pseudocode for `runSupabaseAction` is wrong.** It assumes
a callback-based signature (`runSupabaseAction(fn, (msg) => set(...))`
returning the rows directly). The real signature
(`src/store/supabaseAction.ts`):

```ts
function runSupabaseAction<T>(
  action: () => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  fallbackMessage?: string
): Promise<{ data: T | null; error: string | null }>
```

Real idiom (from `teamSlice.ts`, the pattern every existing slice follows):

```ts
const { data, error } = await runSupabaseAction<Team[]>(
  () => supabase.from('team').select('*').order('created_at', { ascending: true }),
  "Couldn't load teams, try again."
)
set({ ..., teamsError: error, ...(data ? { teams: data } : {}) })
```

`clubSlice.ts` (Task 4) is written against this REAL signature, not the
plan's pseudocode. Same for every other slice action in Tasks 5/6/9/10/11.

## RECON.SHARE_VIEWERS

`SharedDrillPage` (`src/pages/SharedDrillPage.tsx`): outer component does the
token fetch (`fetchSharedDrill`) + loading/empty states; inner presentational
component `function SharedDrill({ drill }: { drill: Drill })` (not exported
today) does the actual rendering — pitch canvas + playback + coaching-notes
blocks, all read-only. `SharedTacticPage` mirrors this exactly:
`function SharedTactic({ tactic }: { tactic: Tactic })`.

**Plan for Tasks 5/6:** export `SharedDrill`/`SharedTactic` from their
current files and reuse them directly in `DrillViewPage`/`TacticViewPage`,
feeding a `Drill`/`Tactic` from the store instead of a token fetch — exactly
what the plan's Interfaces section asks for, now with the real component
names and their real (unexported) prop shape confirmed.

## RECON.DESIGN_SYSTEM (correction — affects Tasks 4/9/10/11 UI)

**design.md is explicit: native `<select>` is never used anywhere in the
app** — the one dropdown pattern is the `Dropdown` component
(`src/components/ui/`, trigger + popover + optional search + checkmark row).
The plan's prose describes the club switcher and target-club pickers
(Tasks 4/9/10/11) as a `<select>`. **Corrected: every single-choice picker
in this rework uses `Dropdown`, not `<select>`**, per design.md's own
"every previous `<select>` has been converted" rule. Tokens: `bg-panel
border-line text-ink-muted` etc. per design.md's color table; `Card`,
`PageHeader`, `Badge` components exist in `src/components/ui/`; shared
`ROW_GRID`-style grid constant for any header+rows table (precedent:
`PlayerRoster.tsx`).

## RECON.CALL_SITE_CENSUS (Serena `find_referencing_symbols`, re-confirmed 2026-08-28)

`fetchDrills` (declared `DrillSlice`, `src/store/slices/drillSlice.ts`) — 6
external referencing files, matching the plan's "7 call sites" (6 + the
slice's own interface/impl): `TeamOverviewPage.tsx:24`,
`SessionItemsPanel.tsx:109`, `DesignPage.tsx:29`, `DrillEditorPage.tsx:19`,
`DrillLibrary.tsx:101`, `DrillCardPage.tsx:75`. Confirmed unchanged from the
plan's 2026-08-27 census (line numbers drifted slightly from the plan's
prose citation but the file set is identical).

`fetchTactics` (declared `TacticSlice`, `src/store/slices/tacticSlice.ts`) —
4 external referencing files, matching the plan's "6 call sites" (4 + slice
interface/impl): `SessionItemsPanel.tsx:110`, `TacticsPage.tsx:48`,
`TacticEditorPage.tsx:17`, `TacticCardPage.tsx:61`. File set unchanged from
plan; exact line numbers to re-check at Task 6 edit time (plan cited
`TacticEditorPage.tsx:26`, `TacticCardPage.tsx:69` — off by a handful of
lines, immaterial to the file-set conclusion).

`SquadPanel.tsx` confirmed reading `rostersByTeam`/`rostersByTeamLoading`/
`rostersByTeamError`/`fetchTeamRoster` (lines 90-119) — Task 6's roster-gate
target.

## Amendment log entries filed

All six corrections above (`drill_all_members_or_unscoped`, storage policy
names, tactic column list, `runSupabaseAction`'s real signature, `Dropdown`
over `<select>`, the `team_id is null` no-op) are also recorded in the
plan's own Amendment log at the bottom of
`docs/superpowers/plans/2026-08-27-club-tenancy-library-platform.md`.
