import { useMemo } from 'react'
import { useStore } from '../../../store'
import type { Drill } from '../../../store'
import type { TimelineHost } from '../timeline/TimelineHost'

// Binds the shared timeline to a drill (TACTICS_BOARD_REWORK_PLAN.md Stage
// 5.1). Lives here rather than in `timeline/` so that folder stays ignorant of
// both domains — the tactics side has its own adapter of the same shape.
//
// Phases and keyframe copy/paste are deliberately absent: they are tactics
// concepts, and the timeline hides the controls that need them rather than
// rendering something inert. Adding them to a shipped drill editor is not what
// this stage was asked to do.
export function useDrillTimelineHost(drill: Drill): TimelineHost {
  const updateEntity = useStore((s) => s.updateEntity)
  const updateMarking = useStore((s) => s.updateMarking)
  const addKeyframe = useStore((s) => s.addKeyframe)
  const updateKeyframeState = useStore((s) => s.updateKeyframeState)
  const moveKeyframe = useStore((s) => s.moveKeyframe)
  const deleteKeyframe = useStore((s) => s.deleteKeyframe)
  const clearKeyframes = useStore((s) => s.clearKeyframes)
  const balanceTiming = useStore((s) => s.balanceTiming)
  const scaleTiming = useStore((s) => s.scaleTiming)
  const setDuration = useStore((s) => s.setDuration)

  // Memoised on the drill's identity and the store actions, all of which are
  // stable — so the host is a new object only when the drill actually changes,
  // and `useKeyframeToggle`'s `useMemo` on it doesn't recompute every render.
  return useMemo(
    () => ({
      scene: drill.scene,
      keyframes: drill.keyframes,
      duration: drill.duration_seconds,
      pitch: drill.pitch,
      updateEntity: (entityId, patch) => updateEntity(drill.id, entityId, patch),
      updateMarking: (markingId, patch) => updateMarking(drill.id, markingId, patch),
      addKeyframe: (t, states) => addKeyframe(drill.id, t, states),
      updateKeyframeState: (keyframeId, states) => updateKeyframeState(drill.id, keyframeId, states),
      moveKeyframe: (keyframeId, t) => moveKeyframe(drill.id, keyframeId, t),
      deleteKeyframe: (keyframeId) => deleteKeyframe(drill.id, keyframeId),
      clearKeyframes: () => clearKeyframes(drill.id),
      balanceTiming: (stepSeconds) => balanceTiming(drill.id, stepSeconds),
      scaleTiming: (factor) => scaleTiming(drill.id, factor),
      setDuration: (seconds) => setDuration(drill.id, seconds),
    }),
    [
      drill.id,
      drill.scene,
      drill.keyframes,
      drill.duration_seconds,
      drill.pitch,
      updateEntity,
      updateMarking,
      addKeyframe,
      updateKeyframeState,
      moveKeyframe,
      deleteKeyframe,
      clearKeyframes,
      balanceTiming,
      scaleTiming,
      setDuration,
    ]
  )
}
