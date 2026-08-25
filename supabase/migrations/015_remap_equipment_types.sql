-- Migration 015 — remap the phases-era equipment names onto the full set
--
-- Stage 6 of DRILL_CREATOR_REWORK_PLAN.md widens EquipmentType from three
-- values to eleven: cone · marker · pole · mannequin · mini_goal ·
-- agility_ring · full_goal · ladder · hurdle · rebounder · passing_gate.
-- Equipment lives in jsonb, so that widening needed no schema change, exactly
-- as the plan says. This is a *data* migration for the one collision it
-- brought with it.
--
-- The old value 'cone' was drawn as an agility pole. pitchTheme.ts said so in
-- as many words: "the internal `kind`/jsonb value stays 'cone' for backward
-- compatibility with already-saved drills; only the label and rendering
-- changed". Now that the set has a real cone *and* a real pole, leaving the
-- data alone would silently turn 17 poles across 6 drills into cones the next
-- time a coach opened them. Remapping instead keeps every existing piece
-- looking exactly as it did, and lets the names finally mean what they say.
--
--   'cone'        -> 'pole'   (what it has always been drawn as)
--   'witches_hat' -> 'cone'   (the flat-base training cone it always drew)
--
-- 'witches_hat' has no rows at the time of writing — it's mapped anyway so the
-- migration is correct regardless of when it runs, and so no drill can be left
-- holding a value the type no longer admits.
--
-- Only `scene.entities` is touched. `drill.phases` keeps its own `cones[].kind`
-- values untouched until migration 014 drops the column; the phases-era
-- adapter (canvas/phaseFrame.ts) carries the same mapping so the drill library
-- and the editor agree in the meantime.

update drill
set scene = jsonb_set(
  scene,
  '{entities}',
  (
    select coalesce(jsonb_agg(
      case
        when entity->>'kind' <> 'equipment' then entity
        when entity->>'equipment' = 'cone' then jsonb_set(entity, '{equipment}', '"pole"')
        when entity->>'equipment' = 'witches_hat' then jsonb_set(entity, '{equipment}', '"cone"')
        else entity
      end
      order by ord
    ), '[]'::jsonb)
    from jsonb_array_elements(scene->'entities') with ordinality e(entity, ord)
  )
)
where scene->'entities' @> '[{"kind":"equipment","equipment":"cone"}]'
   or scene->'entities' @> '[{"kind":"equipment","equipment":"witches_hat"}]';
