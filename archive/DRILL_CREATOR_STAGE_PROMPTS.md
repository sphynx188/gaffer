# Drill Creator Rework — Stage Prompts


One prompt per stage of [DRILL_CREATOR_REWORK_PLAN.md](DRILL_CREATOR_REWORK_PLAN.md) —
**that plan file is the source of truth; these prompts don't duplicate it.**
Each prompt just points a fresh session at the plan, names the one stage to
implement, and carries the model/effort recommendation you need before the
session starts (you have to pick that before it can read anything). Keep
`DRILL_CREATOR_REWORK_PLAN.md` in the repo alongside this file — every
prompt below depends on it being there.

**Working directory:** launch `claude` from inside `gaffer/` (`cd gaffer` first)
— every path in these prompts (`DRILL_CREATOR_REWORK_PLAN.md`, `CLAUDE.md`,
`design.md`) is relative to that, matching `CLAUDE.md`'s own instruction that
all commands run from `gaffer/`, not the parent `app/` folder.

**How to use this file:**
- Start Stage *N* only after Stage *N−1*'s dependencies are met (see the plan's
  Sequencing diagram — Stages 1–4 are sequential and must not be split across
  sessions; 5 onward branch and can run independently).
- Copy one stage's whole prompt block into a new session as its first
  message. Set the model and effort level named in the prompt before
  sending it, if your interface exposes that control up front.
- Don't paste more than one stage per session.

## Contents

1. [Data model: entities + keyframes](#stage-1-data-model-entities-keyframes)
2. [Store: entity/keyframe actions, undo/redo, autosave](#stage-2-store-entitykeyframe-actions-undoredo-autosave)
3. [Canvas: frame interpolation, selection, transform](#stage-3-canvas-frame-interpolation-selection-transform)
4. [Timeline & playback](#stage-4-timeline-playback)
5. [Editor shell](#stage-5-editor-shell)
6. [Element library & per-entity properties](#stage-6-element-library-per-entity-properties)
7. [Pitch presets & overlays](#stage-7-pitch-presets-overlays)
8. [Drill metadata & the Details drawer](#stage-8-drill-metadata-the-details-drawer)
9. [Library, cards & session integration](#stage-9-library-cards-session-integration)
10. [Export & share](#stage-10-export-share)
11. [Onboarding (and the 3D question)](#stage-11-onboarding-and-the-3d-question)


---


## Stage 1 — Data model: entities + keyframes


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 1 — Data model: entities + keyframes — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 1 — Data model: entities + keyframes` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 1 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution:** `claude-opus-5` · effort **`max`** · **~4–7M in / ~180–280K out** · **2.5–4h** · ~$25–42

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 1 — no speculative
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


## Stage 2 — Store: entity/keyframe actions, undo/redo, autosave


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 2 — Store: entity/keyframe actions, undo/redo, autosave — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 2 — Store: entity/keyframe actions, undo/redo, autosave` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 2 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution:** `claude-opus-5` · effort **`xhigh`** · **~2.5–4M in / ~120–180K out** · **1.5–2.5h** · ~$16–25

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


## Stage 3 — Canvas: frame interpolation, selection, transform


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 3 — Canvas: frame interpolation, selection, transform — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 3 — Canvas: frame interpolation, selection, transform` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 3 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution:** `claude-opus-5` · effort **`xhigh`**, `max` for `interpolate.ts` · **~6–10M in / ~250–400K out** · **3.5–5.5h** · ~$36–60

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


## Stage 4 — Timeline & playback


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 4 — Timeline & playback — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 4 — Timeline & playback` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 4 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution:** `claude-opus-5` · effort **`xhigh`** · **~5–8M in / ~220–350K out** · **3–4.5h** · ~$30–49

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


## Stage 5 — Editor shell


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 5 — Editor shell — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 5 — Editor shell` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 5 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution:** `claude-opus-5` · effort **`high`** · **~3–5M in / ~150–230K out** · **2–3h** · ~$19–31

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


## Stage 6 — Element library & per-entity properties


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 6 — Element library & per-entity properties — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 6 — Element library & per-entity properties` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 6 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution:** mixed · **~3.5–6M in / ~200–300K out** · **2–3.5h** · ~$15–28

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


## Stage 7 — Pitch presets & overlays


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 7 — Pitch presets & overlays — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 7 — Pitch presets & overlays` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 7 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution:** mixed · **~2.5–4M in / ~150–220K out** · **1.5–2.5h** · ~$10–18

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


## Stage 8 — Drill metadata & the Details drawer


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 8 — Drill metadata & the Details drawer — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 8 — Drill metadata & the Details drawer` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 8 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution:** mixed · **~3–5M in / ~180–260K out** · **2–3h** · ~$14–24

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


## Stage 9 — Library, cards & session integration


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 9 — Library, cards & session integration — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 9 — Library, cards & session integration` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 9 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution:** `claude-sonnet-5` · effort **`high`** · **~2.5–4M in / ~140–200K out** · **1.5–2.5h** · ~$6–15

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


## Stage 10 — Export & share


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 10 — Export & share — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 10 — Export & share` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 10 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution:** mixed · **~4–6.5M in / ~200–300K out** · **2.5–4h** · ~$22–38

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


## Stage 11 — Onboarding (and the 3D question)


<details><summary>Copy this whole block as the first message of a new session</summary>


```text

# Task: implement Stage 11 — Onboarding (and the 3D question) — from `DRILL_CREATOR_REWORK_PLAN.md`

Read `DRILL_CREATOR_REWORK_PLAN.md` in full. It is the source of
truth for this task — do not skip it and do not ask for the stage's spec to
be restated here. Under the heading `## Stage 11 — Onboarding (and the 3D question)` you'll find
this stage's exact task, code/schema, Definition of Done, and Verify steps.
Section `## 0. The one thing that matters` at the top of that file explains
the entities+keyframes data model every stage assumes — read it even if
this isn't Stage 1, since later stages depend on it without re-explaining it.

Also read `CLAUDE.md` and `design.md` for this repo's standing
conventions (styling tokens, the Zustand-slice pattern, `runSupabaseAction`,
surgical-change discipline) — this prompt does not repeat those either.

Implement **only** Stage 11 — not adjacent stages, even if you can see how
they'd connect. Do not re-propose the data model or suggest reverting to
`phases[]`; §0 marks that decision final.

**Execution — onboarding:** `claude-sonnet-5` · effort **`medium`** · **~1–2M in / ~60–100K out** · **45–90min** · ~$3–5

## How to work this stage

1. State a brief plan before touching code.
2. Implement exactly what the plan specifies for Stage 11 — no speculative
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
