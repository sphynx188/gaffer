# Tactics Board Rework — Stage Prompts


One prompt per stage of [TACTICS_BOARD_REWORK_PLAN.md](TACTICS_BOARD_REWORK_PLAN.md) —
**that plan file is the source of truth; these prompts don't duplicate it.**
Each prompt points a fresh session at the plan, names the one stage to
implement, and carries the model/effort recommendation you need before the
session starts (you pick that before it can read anything). Keep
`TACTICS_BOARD_REWORK_PLAN.md` in the repo alongside this file — every
prompt below depends on it being there, and most also assume
`DRILL_CREATOR_REWORK_PLAN.md` and the shipped `src/components/design/` code
are present as the reference implementation.

**Working directory:** launch `claude` from inside `gaffer/` (`cd gaffer`
first) — every path in these prompts is relative to that, matching
`CLAUDE.md`'s own instruction that all commands run from `gaffer/`, not the
parent `app/` folder.

**How to use this file:**
- **Stage 0 first, and on its own.** It applies a destructive migration to
  the drill tables and is the prerequisite for everything else.
- Then follow the plan's Sequencing diagram: **0 → 1 → 2 → 5** is the spine
  and shouldn't be split across sessions; **3 → 4** runs parallel to
  **2 → 5** once Stage 1 lands; **8** and **9** are independent of each
  other after **7**.
- Copy one stage's whole prompt block into a new session as its first
  message. Set the model and effort level named in the prompt before
  sending it, if your interface exposes that control up front.
- Don't paste more than one stage per session.
- **Stage 7 is a ship gate** — its read-back of all 4 tactics is what
  unlocks migration 021 (dropping `tactic.board`). Don't apply 021 early.

## Contents

- [Stage 0 — Land migration 014 and retire the phases bridge](#stage-0-land-migration-014-and-retire-the-phases-bridge)
- [Stage 1 — Data model: tactic scene, keyframes, sides](#stage-1-data-model-tactic-scene-keyframes-sides)
- [Stage 2 — Store: `tacticSlice` on entities and keyframes](#stage-2-store-tacticslice-on-entities-and-keyframes)
- [Stage 3 — Formations](#stage-3-formations)
- [Stage 4 — Squad panel, two teams, roster binding](#stage-4-squad-panel-two-teams-roster-binding)
- [Stage 5 — Timeline, phases and the extra visualisations](#stage-5-timeline-phases-and-the-extra-visualisations)
- [Stage 6 — Drawing tools to parity](#stage-6-drawing-tools-to-parity)
- [Stage 7 — Editor shell, inspector and views](#stage-7-editor-shell-inspector-and-views)
- [Stage 8 — Export, share and presentation](#stage-8-export-share-and-presentation)
- [Stage 9 — Library and session integration](#stage-9-library-and-session-integration)
- [Stage 10 — Onboarding, and the 3D question](#stage-10-onboarding-and-the-3d-question)


---


## Stage 0 — Land migration 014 and retire the phases bridge


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 0 — Land migration 014 and retire the phases bridge — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 0 — Land migration 014 and retire the phases bridge` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

Implement **only** Stage 0 — not adjacent stages, even if you can see how
they connect. This stage is groundwork on the *drill* tables — finish it and stop;
the tactics migration is Stage 1's job, not yours.

**Execution:** `claude-opus-5` · effort **`high`** · **~0.8–1.5M in / ~40–70K out** · **40–75min** · ~$5–9

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 0 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
   Note this stage changes live data: run migrations against a Supabase
   branch first and diff the result before touching `main`, and re-read the
   migration file's own header comments — they carry ordering gates that
   matter.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---


## Stage 1 — Data model: tactic scene, keyframes, sides


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 1 — Data model: tactic scene, keyframes, sides — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 1 — Data model: tactic scene, keyframes, sides` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

**Most of this stage is adoption, not invention.** The drill creator rework
(Stages 1–11 of `DRILL_CREATOR_REWORK_PLAN.md`) has shipped, and its code in
`src/components/design/` is the reference implementation for the engine this
stage builds on — `canvas/interpolate.ts`, `PitchCanvas.tsx`, `timeline/*`,
`editor/*`, `export/*`, and `store/slices/drillSlice.ts`. **Read the
relevant existing code before writing new code**, and reuse or parameterise
it rather than forking it. Where the plan says to extract something shared,
extract it — two near-duplicates of a 400-line file will drift.

Implement **only** Stage 1 — not adjacent stages, even if you can see how
they connect. Do not re-propose the data model or suggest keeping
`tactic.board`; §0 marks that decision final.

**Execution:** `claude-opus-5` · effort **`max`** · **~2–3.5M in / ~120–180K out** · **1.5–2.5h** · ~$13–20

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 1 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
   Note this stage changes live data: run migrations against a Supabase
   branch first and diff the result before touching `main`, and re-read the
   migration file's own header comments — they carry ordering gates that
   matter.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---


## Stage 2 — Store: `tacticSlice` on entities and keyframes


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 2 — Store: `tacticSlice` on entities and keyframes — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 2 — Store: `tacticSlice` on entities and keyframes` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

**Most of this stage is adoption, not invention.** The drill creator rework
(Stages 1–11 of `DRILL_CREATOR_REWORK_PLAN.md`) has shipped, and its code in
`src/components/design/` is the reference implementation for the engine this
stage builds on — `canvas/interpolate.ts`, `PitchCanvas.tsx`, `timeline/*`,
`editor/*`, `export/*`, and `store/slices/drillSlice.ts`. **Read the
relevant existing code before writing new code**, and reuse or parameterise
it rather than forking it. Where the plan says to extract something shared,
extract it — two near-duplicates of a 400-line file will drift.

Implement **only** Stage 2 — not adjacent stages, even if you can see how
they connect. Do not re-propose the data model or suggest keeping
`tactic.board`; §0 marks that decision final.

**Execution:** `claude-opus-5` · effort **`xhigh`** · **~2.5–4M in / ~130–200K out** · **1.5–2.5h** · ~$16–26

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 2 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---


## Stage 3 — Formations


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 3 — Formations — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 3 — Formations` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

Implement **only** Stage 3 — not adjacent stages, even if you can see how
they connect. Do not re-propose the data model or suggest keeping
`tactic.board`; §0 marks that decision final.

**Execution:** mixed · **~2–3.5M in / ~140–220K out** · **1.5–2.5h** · ~$9–16

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 3 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---


## Stage 4 — Squad panel, two teams, roster binding


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 4 — Squad panel, two teams, roster binding — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 4 — Squad panel, two teams, roster binding` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

Implement **only** Stage 4 — not adjacent stages, even if you can see how
they connect. Do not re-propose the data model or suggest keeping
`tactic.board`; §0 marks that decision final.

**Execution:** `claude-opus-5` · effort **`high`** · **~2.5–4M in / ~150–230K out** · **2–3h** · ~$16–25

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 4 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---


## Stage 5 — Timeline, phases and the extra visualisations


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 5 — Timeline, phases and the extra visualisations — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 5 — Timeline, phases and the extra visualisations` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

**Most of this stage is adoption, not invention.** The drill creator rework
(Stages 1–11 of `DRILL_CREATOR_REWORK_PLAN.md`) has shipped, and its code in
`src/components/design/` is the reference implementation for the engine this
stage builds on — `canvas/interpolate.ts`, `PitchCanvas.tsx`, `timeline/*`,
`editor/*`, `export/*`, and `store/slices/drillSlice.ts`. **Read the
relevant existing code before writing new code**, and reuse or parameterise
it rather than forking it. Where the plan says to extract something shared,
extract it — two near-duplicates of a 400-line file will drift.

Implement **only** Stage 5 — not adjacent stages, even if you can see how
they connect. Do not re-propose the data model or suggest keeping
`tactic.board`; §0 marks that decision final.

**Execution:** `claude-opus-5` · effort **`xhigh`** · **~4–6.5M in / ~220–330K out** · **2.5–4h** · ~$26–42

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 5 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---


## Stage 6 — Drawing tools to parity


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 6 — Drawing tools to parity — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 6 — Drawing tools to parity` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

**Most of this stage is adoption, not invention.** The drill creator rework
(Stages 1–11 of `DRILL_CREATOR_REWORK_PLAN.md`) has shipped, and its code in
`src/components/design/` is the reference implementation for the engine this
stage builds on — `canvas/interpolate.ts`, `PitchCanvas.tsx`, `timeline/*`,
`editor/*`, `export/*`, and `store/slices/drillSlice.ts`. **Read the
relevant existing code before writing new code**, and reuse or parameterise
it rather than forking it. Where the plan says to extract something shared,
extract it — two near-duplicates of a 400-line file will drift.

Implement **only** Stage 6 — not adjacent stages, even if you can see how
they connect. Do not re-propose the data model or suggest keeping
`tactic.board`; §0 marks that decision final.

**Execution:** mixed · **~2.5–4M in / ~160–240K out** · **1.5–2.5h** · ~$11–18

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 6 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---


## Stage 7 — Editor shell, inspector and views


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 7 — Editor shell, inspector and views — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 7 — Editor shell, inspector and views` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

**Most of this stage is adoption, not invention.** The drill creator rework
(Stages 1–11 of `DRILL_CREATOR_REWORK_PLAN.md`) has shipped, and its code in
`src/components/design/` is the reference implementation for the engine this
stage builds on — `canvas/interpolate.ts`, `PitchCanvas.tsx`, `timeline/*`,
`editor/*`, `export/*`, and `store/slices/drillSlice.ts`. **Read the
relevant existing code before writing new code**, and reuse or parameterise
it rather than forking it. Where the plan says to extract something shared,
extract it — two near-duplicates of a 400-line file will drift.

Implement **only** Stage 7 — not adjacent stages, even if you can see how
they connect. Do not re-propose the data model or suggest keeping
`tactic.board`; §0 marks that decision final.

**Execution:** `claude-opus-5` · effort **`high`** · **~3–5M in / ~180–260K out** · **2–3h** · ~$18–29

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 7 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---


## Stage 8 — Export, share and presentation


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 8 — Export, share and presentation — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 8 — Export, share and presentation` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

**Most of this stage is adoption, not invention.** The drill creator rework
(Stages 1–11 of `DRILL_CREATOR_REWORK_PLAN.md`) has shipped, and its code in
`src/components/design/` is the reference implementation for the engine this
stage builds on — `canvas/interpolate.ts`, `PitchCanvas.tsx`, `timeline/*`,
`editor/*`, `export/*`, and `store/slices/drillSlice.ts`. **Read the
relevant existing code before writing new code**, and reuse or parameterise
it rather than forking it. Where the plan says to extract something shared,
extract it — two near-duplicates of a 400-line file will drift.

Implement **only** Stage 8 — not adjacent stages, even if you can see how
they connect. Do not re-propose the data model or suggest keeping
`tactic.board`; §0 marks that decision final.

**Execution:** mixed · **~2–3.5M in / ~130–190K out** · **1.5–2.5h** · ~$12–20

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 8 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---


## Stage 9 — Library and session integration


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 9 — Library and session integration — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 9 — Library and session integration` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

**Most of this stage is adoption, not invention.** The drill creator rework
(Stages 1–11 of `DRILL_CREATOR_REWORK_PLAN.md`) has shipped, and its code in
`src/components/design/` is the reference implementation for the engine this
stage builds on — `canvas/interpolate.ts`, `PitchCanvas.tsx`, `timeline/*`,
`editor/*`, `export/*`, and `store/slices/drillSlice.ts`. **Read the
relevant existing code before writing new code**, and reuse or parameterise
it rather than forking it. Where the plan says to extract something shared,
extract it — two near-duplicates of a 400-line file will drift.

Implement **only** Stage 9 — not adjacent stages, even if you can see how
they connect. Do not re-propose the data model or suggest keeping
`tactic.board`; §0 marks that decision final.

**Execution:** mixed · **~2.5–4M in / ~150–220K out** · **1.5–2.5h** · ~$11–19

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 9 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---


## Stage 10 — Onboarding, and the 3D question


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 10 — Onboarding, and the 3D question — from `TACTICS_BOARD_REWORK_PLAN.md`

Read `TACTICS_BOARD_REWORK_PLAN.md` in full. It is the source of truth for
this task — do not skip it and do not ask for the stage's spec to be
restated here. Under the heading `## Stage 10 — Onboarding, and the 3D question` you'll find this
stage's exact task, code/schema, Definition of Done, and Verify steps.

Two further sections of that file are required reading:

- `## 0. The one thing that matters` — why the tactics board is being put on
  the same entities+keyframes model the drill editor already uses, and what
  is genuinely new versus merely adopted.
- `## Decisions taken (2026-08-26)` — four scope decisions the whole plan
  assumes. If part of this stage's spec reads oddly, the reason is usually
  recorded there.

Also read `CLAUDE.md` and `design.md` for this repo's standing conventions
(styling tokens, the Zustand-slice pattern, `runSupabaseAction`, the
single-shared-store rule, surgical-change discipline) — this prompt does not
repeat those.

**Most of this stage is adoption, not invention.** The drill creator rework
(Stages 1–11 of `DRILL_CREATOR_REWORK_PLAN.md`) has shipped, and its code in
`src/components/design/` is the reference implementation for the engine this
stage builds on — `canvas/interpolate.ts`, `PitchCanvas.tsx`, `timeline/*`,
`editor/*`, `export/*`, and `store/slices/drillSlice.ts`. **Read the
relevant existing code before writing new code**, and reuse or parameterise
it rather than forking it. Where the plan says to extract something shared,
extract it — two near-duplicates of a 400-line file will drift.

Implement **only** Stage 10 — not adjacent stages, even if you can see how
they connect. Do not re-propose the data model or suggest keeping
`tactic.board`; §0 marks that decision final.

**Execution — onboarding:** `claude-sonnet-5` · effort **`medium`** · **~0.8–1.5M in / ~50–80K out** · **40–75min** · ~$3–5
**Execution — 3D:** `claude-opus-5` · effort **`max`** · **~12–25M in / ~500–900K out** · **8–16h across 3–5 sessions** · ~$75–150

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 10 — no speculative
   extensions, no drive-by refactors of code outside this stage's scope.
3. Run the plan's Verify step(s) for this stage before calling it done.
4. If something the plan doesn't resolve comes up, make the most
   conservative call that matches existing repo conventions and say so —
   don't stop and ask unless proceeding would be unsafe or unrecoverable.
5. Summarize what changed and confirm the Definition of Done against the
   plan's wording for this stage.
```


</details>


---
