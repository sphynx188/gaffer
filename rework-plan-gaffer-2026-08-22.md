# Rework Plan: Gaffer → Supabase Studio Design Brief

**Current app:** `gaffer/` — React 19 + Vite + TypeScript + Tailwind v4 (CSS-first `@theme` tokens), dark-mode-only with a light-mode toggle.
**Target:** `design-brief-supabase-studio-2026-08-22.md`, distilled from `design-analysis-supabase-dashboard-2026-08-22.md`.
**Existing design system doc:** `gaffer/design.md` (read in full, plus the real current values in `gaffer/src/index.css`, before drafting this).

This is **not** a wholesale rework. Gaffer's own design system is deliberate, documented, and built for a different use case than Studio's (a single coach's app used pitch-side on mobile, vs. a dense all-day admin console) — most of the brief's recommendations fail one of the checks below on real, stated grounds, not close calls. What's staged is: one live violation of Gaffer's own rule found during the audit, one genuinely missing pattern the brief happens to illustrate well, one larger idea flagged as optional, and two items that were originally rejected as direct conflicts with `design.md` — now staged anyway at the user's explicit instruction to override those two specific decisions (Stages 4–5). Everything else stays out, listed under **Not planned** with the specific reason.

**On Stages 4–5 specifically:** `design.md` states both of these as settled, deliberate decisions — *"there is no permanent sidebar"* and *"no `shadow-sm`/drop shadows anywhere on chrome... never a shadow"* — and the first draft of this plan correctly excluded them as conflicts rather than silently picking a side. The user has since explicitly instructed overriding both. That's honored below, but the override is scoped to exactly what was asked (the nav shell's *sidebar rail*, and the *focus ring* specifically) — it does not extend to reintroducing shadows on cards/panels generally, which `design.md` still governs and which nothing in this request touched. Each stage below also updates `design.md` itself, so the doc stays the authoritative record of what's actually true in the code rather than drifting out of date the way `CLAUDE.md` warns has happened before.

## Stage 1: Fix a live violation of Gaffer's own rule (found during audit, not from the brief)

**Why first:** unrelated to the brief, but a real, currently-existing regression against a rule `design.md` already states explicitly — worth clearing before layering anything else on top.

1. `gaffer/src/components/design/PitchCanvas.tsx:216` — remove `shadow-sm` from `className="overflow-hidden rounded-lg shadow-sm"`, leaving `className="overflow-hidden rounded-lg"`. `design.md` states *"No `shadow-sm`/drop shadows anywhere on chrome... never a shadow"* and names `shadow-sm` on panels specifically as a stale default that has crept back in before — this is exactly that, live in the codebase today.

**Verify:** `grep -rn "shadow-sm" gaffer/src` — the only remaining hits should be inside `pitchTheme.ts`'s canvas-specific color system, if any (canvas colors are a deliberately separate system per `CLAUDE.md` and out of scope for this plan).

## Stage 2: Add a loading-state pattern (closes a real gap; the brief's skeleton pattern is a reasonable model)

**Why:** a direct grep of the codebase (`isLoading`, `Spinner`, `animate-pulse`) found **no loading-state UI anywhere** — Gaffer's fetched data currently just pops in with no affordance while a request is in flight. This is a real, currently-unmet gap, not a case of "the brief has it so we should too." `EmptyState.tsx` already exists but is scoped to zero-results states (icon + message + action link), not in-flight loading — this adds the missing counterpart rather than duplicating it.

1. Add `gaffer/src/components/ui/Skeleton.tsx` — a flat rounded-rect placeholder (`bg-panel-raised`, `rounded-md`, `animate-pulse`), in Gaffer's own tokens — same idea as the brief's flat skeleton blocks, none of Studio's own colors.
2. Wire it into the highest-traffic fetch points that currently show a blank gap: the team roster (`PlayerRoster.tsx`), the session list, and the drill library (`DrillLibrary.tsx`) — 3-4 `Skeleton` rows sized to each page's real row layout, shown while the relevant Zustand slice's fetch is in flight.

**Verify:** throttle the network (devtools) or add a temporary artificial delay on Roster/Sessions/Drill Library and confirm a skeleton renders instead of a blank interval before data appears.

## Stage 3 (optional — evaluate before committing, don't bundle into routine work)

**Why separate:** this touches `index.css`'s `@theme` block — the single place `design.md` calls the source of truth for chrome color — in both dark and light mode, and isn't fixing anything currently broken. It's an aesthetic refinement idea worth a deliberate look, not a default to apply.

1. Derive Gaffer's actual accent hue in OKLCH terms from `#5e6ad2` (measure it, don't assume a value).
2. If the result looks worth pursuing, re-express `--color-panel` / `--color-panel-raised` (and their `[data-theme='light']` counterparts) as `oklch(...)` values referencing that one hue, instead of today's independently-chosen flat hex — the same relative-color-derivation idea the brief documents, using Gaffer's own accent, not Studio's green.

**Verify:** side-by-side screenshots of a few key screens (Dashboard, Roster, Session Planner) in both dark and light mode, before/after — confirm no contrast regression against `design.md`'s existing legibility bar.

## Stage 4: Persistent icon-rail sidebar (explicit override of `design.md`'s "no permanent sidebar")

**Why this overrides the doc, not just extends it:** `AppShell.tsx`'s current desktop nav is a horizontal tab strip inside the sticky top bar (`NavList` with `direction="row"`, in the `hidden flex-1 items-center lg:flex` block at line 204) — chosen specifically so nothing reserves permanent screen width. Studio's rail does the opposite by design. Per direct instruction, switch to the rail; the change is desktop/tablet-only, since Studio's own rail *also* disappears in favor of a hamburger at mobile widths (confirmed in the brief's Responsive section) — which is exactly what `AppShell.tsx` already does below `lg`, so mobile needs no change at all.

1. `gaffer/src/layout/AppShell.tsx` — add a persistent `<aside>`, visible `lg:flex` / `hidden` below it, fixed to the left edge, containing `BrandBlock` at the top and `NavList` reusing the existing `direction="col"` icon+tooltip rendering (it already sets `title={label}` on every link, so the tooltip-on-hover behavior Studio's rail relies on is already there for free).
2. Give the rail its own width constant rather than copying Studio's ~34px verbatim — Studio's density fits an all-day admin tool with a mouse; Gaffer is a touch/pitch-side app, so size the rail for comfortable tap targets (e.g. `w-16`, `h-5 w-5` icons) instead of Studio's cramped icon-only rail. This is the same touch-target reasoning that excluded Studio's dense type scale in the first draft — the rail *pattern* is being adopted, not its literal sizing.
3. Remove the horizontal `NavList direction="row"` block from the top bar (lines ~203-206) now that primary nav lives in the rail; keep the top bar for `BackButton` (mobile), the right-side utility cluster (`TeamSwitcher`, `ThemeToggleButton`, sign-out), and — at `lg:+` where the rail now carries `BrandBlock` — either drop `BrandBlock` from the top bar or keep it as a fallback; decide based on how it looks once built, don't prescribe from the plan.
4. Offset `<main>` for the rail's width at `lg:+` (e.g. `lg:pl-16` on the wrapping div, matching whatever width was chosen in step 2).
5. Update `gaffer/design.md`'s Navigation shell section — replace *"there is no permanent sidebar"* with the new rail description, and note it as a deliberate reversal of the earlier decision (with a one-line reason: adopted from a Supabase Studio design-brief rework, by explicit instruction) rather than deleting the history silently.

**Verify:** load the app at `lg:+` width and confirm the rail is present, every icon's tooltip shows its label on hover, active-route highlighting still works (reuse the existing `navLinkClass` active styles), and the mobile hamburger drawer is completely unchanged. Run `npm run build` — a real structural change to the shell touches every route.

## Stage 5: Shadow-based focus ring (explicit override of `design.md`'s "never a shadow")

**Why this overrides the doc, not just extends it:** `design.md` states the no-shadow rule in absolute terms and `index.css:94-97`'s current `:focus-visible` rule is an `outline`, not a shadow — exactly what the doc calls for. Text inputs already use Tailwind's `ring-2 ring-accent/30` (Tailwind's `ring` utility is itself implemented as a `box-shadow` under the hood, so inputs arguably already use a shadow-based technique in substance if not in name) — so the actual gap between "what exists" and "what was asked for" is specifically the plain-button/link global focus rule.

1. `gaffer/src/index.css:94-97` — replace:
   ```css
   :focus-visible {
     outline: 2px solid var(--color-accent);
     outline-offset: 2px;
   }
   ```
   with a shadow-based glow, using Gaffer's own accent rather than Studio's green and without Studio's 5-layer stack (that complexity exists in Studio to pre-wire multiple simultaneous states; Gaffer only needs one focus state, so one layer is enough):
   ```css
   :focus-visible {
     outline: none;
     box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-accent) 30%, transparent);
     transition: box-shadow 0.15s var(--ease-decelerate, cubic-bezier(0, 0, 0.2, 1));
   }
   ```
2. Leave the input/select/textarea focus classes (`focus:border-accent focus:ring-2 focus:ring-accent/30`) as they are — they're already shadow-based in practice; this stage is about the plain-button/link case the global rule covers, not a wholesale redo of every focus style in the app.
3. Update `gaffer/design.md`'s Conventions/Focus states section to describe the new shadow-based glow instead of the outline, again noting it as a deliberate, explicit reversal rather than an unexplained change.

**Verify:** tab through the app (nav rail from Stage 4, page buttons, links) and confirm a visible glow appears on focus with no layout shift (box-shadow doesn't affect layout the way a wider outline could); check both dark and light `data-theme` — `color-mix` with `var(--color-accent)` should track whichever theme's accent value is active automatically, but confirm the resulting glow is visible against both `--color-panel` values.

## Conflicts (need a decision, not resolved by this plan)

None open. Two items that started as conflicts — the persistent icon-rail sidebar and the shadow-based focus technique — were resolved by explicit user instruction to override `design.md` on those two points specifically (see Stages 4–5, including the corresponding `design.md` updates so the doc doesn't silently drift from the code). The remaining conflict-prone recommendation (Studio's 6px-everywhere radius) was checked against `design.md` and clearly fails on its own terms — see **Not planned** below — and wasn't part of the override instruction, so it stays excluded.

## Not planned

- *Not applicable (no matching surface in the app):* Monaco/code-editor styling and GitHub diff-syntax tokens (no code-editing surface in Gaffer); the org ▸ project ▸ branch breadcrumb nav pattern (no multi-tenant/branch concept — `TeamSwitcher` already fills the narrower equivalent role).
- *Conflicts with an explicit, already-settled `design.md` decision, confirmed against the real current tokens in `index.css` — not overridden, since the override instruction was scoped to the sidebar rail and focus ring specifically:* Studio's 6px-everywhere control radius (`design.md`: `rounded-xl`/12px cards, `rounded-md`/`rounded-lg` controls — a different, intentional density target). If this should also be overridden, say so explicitly the same way the rail and focus ring were — don't assume it's included by extension.
- *Doesn't fit this app's actual context, even though nothing in `design.md` forbids it outright:* Studio's dense 12–13px UI-chrome type scale and 2px spacing base. Gaffer is a single-user PWA used pitch-side on mobile — the dark-mode-only decision itself was made for outdoor glare/battery (`CLAUDE.md`), not aesthetics — so adopting an admin-console density would hurt legibility exactly where Gaffer is actually used, not just diverge from a written rule.
- *Already handled by Gaffer's own approach, not clearly improved by the brief's version:* the brand-color hover treatment (Gaffer already swaps `--color-accent` → `--color-accent-hover`, two deliberately chosen flat hex values; Studio's translucent "glow" hover is a different aesthetic choice, not a fix to anything broken here); the split/joined button-group pattern (a genuinely portable technique, but there's no `Button` primitive in the codebase yet and no current UI with an adjacent-action-pair problem it would solve — worth remembering if a future feature needs it, not worth staging speculatively now).

## Source documents

- Design brief: `design-brief-supabase-studio-2026-08-22.md`
- Full forensic report: `design-analysis-supabase-dashboard-2026-08-22.md`
- Current app's design-system doc: `gaffer/design.md`
