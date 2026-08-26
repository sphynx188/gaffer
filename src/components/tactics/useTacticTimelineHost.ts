import { useMemo } from 'react'
import { useStore } from '../../store'
import type { Tactic } from '../../store'
import type { TimelineHost } from '../design/timeline/TimelineHost'

// Binds the shared timeline to a tactic (TACTICS_BOARD_REWORK_PLAN.md Stage
// 5.1). The mirror of `useDrillTimelineHost`, and the reason the timeline
// itself needs to know nothing about either document.
//
// Unlike the drill host this one DOES supply the optional capabilities: phases
// (5.2) and keyframe copy/paste (5.6) are tactics concepts, and their store
// actions landed in Stage 2.
export function useTacticTimelineHost(tactic: Tactic): TimelineHost {
  const updateEntity = useStore((s) => s.updateTacticEntity)
  const updateMarking = useStore((s) => s.updateTacticMarking)
  const addKeyframe = useStore((s) => s.addTacticKeyframe)
  const updateKeyframeState = useStore((s) => s.updateTacticKeyframeState)
  const moveKeyframe = useStore((s) => s.moveTacticKeyframe)
  const deleteKeyframe = useStore((s) => s.deleteTacticKeyframe)
  const clearKeyframes = useStore((s) => s.clearTacticKeyframes)
  const balanceTiming = useStore((s) => s.balanceTacticTiming)
  const setDuration = useStore((s) => s.setTacticDuration)
  const addPhase = useStore((s) => s.addTacticPhase)
  const updatePhase = useStore((s) => s.updateTacticPhase)
  const removePhase = useStore((s) => s.removeTacticPhase)
  const copyKeyframe = useStore((s) => s.copyTacticKeyframe)
  const pasteKeyframe = useStore((s) => s.pasteTacticKeyframe)
  const clipboard = useStore((s) => s.tacticClipboard)

  return useMemo(
    () => ({
      scene: tactic.scene,
      keyframes: tactic.keyframes,
      duration: tactic.duration_seconds,
      pitch: tactic.pitch,
      updateEntity: (entityId, patch) => updateEntity(tactic.id, entityId, patch),
      updateMarking: (markingId, patch) => updateMarking(tactic.id, markingId, patch),
      addKeyframe: (t, states) => addKeyframe(tactic.id, t, states),
      updateKeyframeState: (keyframeId, states) => updateKeyframeState(tactic.id, keyframeId, states),
      moveKeyframe: (keyframeId, t) => moveKeyframe(tactic.id, keyframeId, t),
      deleteKeyframe: (keyframeId) => deleteKeyframe(tactic.id, keyframeId),
      clearKeyframes: () => clearKeyframes(tactic.id),
      balanceTiming: () => balanceTiming(tactic.id),
      setDuration: (seconds) => setDuration(tactic.id, seconds),
      phases: tactic.phases,
      addPhase: (phase) => addPhase(tactic.id, phase),
      updatePhase: (phaseId, patch) => updatePhase(tactic.id, phaseId, patch),
      removePhase: (phaseId) => removePhase(tactic.id, phaseId),
      copyKeyframe: (keyframeId) => copyKeyframe(tactic.id, keyframeId),
      pasteKeyframe: (t) => pasteKeyframe(tactic.id, t),
      canPaste: clipboard !== null,
    }),
    [
      tactic.id,
      tactic.scene,
      tactic.keyframes,
      tactic.duration_seconds,
      tactic.pitch,
      tactic.phases,
      updateEntity,
      updateMarking,
      addKeyframe,
      updateKeyframeState,
      moveKeyframe,
      deleteKeyframe,
      clearKeyframes,
      balanceTiming,
      setDuration,
      addPhase,
      updatePhase,
      removePhase,
      copyKeyframe,
      pasteKeyframe,
      clipboard,
    ]
  )
}
