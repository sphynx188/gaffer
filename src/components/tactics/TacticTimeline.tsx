import { useMemo, useState } from 'react'
import type { Tactic } from '../../store'
import { frameAt, type RenderFrame } from '../design/canvas/interpolate'
import { motionPathsFor, trailFramesFor } from '../design/timeline/motion'
import { onionFramesFor } from '../design/timeline/onionSkin'
import { TimelineBar } from '../design/timeline/TimelineBar'
import { TimelineEditor } from '../design/timeline/TimelineEditor'
import { keyframeAt } from '../design/timeline/cursor'
import { useTimelinePlayback } from '../design/timeline/useTimelinePlayback'
import { useTacticTimelineHost } from './useTacticTimelineHost'

// The whole timeline surface for a tactic (TACTICS_BOARD_REWORK_PLAN.md Stage
// 5), assembled from the drill editor's own components via `TimelineHost` —
// nothing here is a fork. Stage 7's editor shell mounts this and feeds the
// visualisation frames it returns into PitchCanvas.
//
// The playhead deliberately lives here rather than in the store: it changes
// sixty times a second while a tactic plays, and every subscriber would
// re-render with it (see useTimelinePlayback's own note).

export interface TacticTimelineView {
  /** What is on the pitch right now. */
  frame: RenderFrame
  /** Ghosts of the neighbouring keyframes, when onion skin is on. */
  onionFrames?: RenderFrame[]
  /** Route lines for whatever is moving, when player paths are on. */
  motionPaths?: ReturnType<typeof motionPathsFor>
  /** Faded copies behind whatever is moving, when ghost trails are on. */
  trailFrames?: RenderFrame[]
  /** The keyframe under the playhead, or null between keyframes. */
  parkedKeyframeId: string | null
  currentTime: number
}

export function TacticTimeline({
  tactic,
  onViewChange,
  className,
}: {
  tactic: Tactic
  // Handed back on every change so the host shell can pass it to PitchCanvas.
  // A callback rather than the canvas being rendered here: this component owns
  // the clock, not the board.
  onViewChange?: (view: TacticTimelineView) => void
  className?: string
}) {
  const host = useTacticTimelineHost(tactic)
  const playback = useTimelinePlayback(tactic.duration_seconds)
  const [expanded, setExpanded] = useState(false)
  const [onionSkin, setOnionSkin] = useState(false)
  const [playerPaths, setPlayerPaths] = useState(false)
  const [ghostTrails, setGhostTrails] = useState(false)

  const frame = useMemo(
    () => frameAt(tactic.scene, tactic.keyframes, playback.currentTime),
    [tactic.scene, tactic.keyframes, playback.currentTime]
  )

  // All three visualisations are independent, and each costs nothing when off.
  const view: TacticTimelineView = useMemo(() => {
    const parked = keyframeAt(tactic.keyframes, playback.currentTime)
    return {
      frame,
      onionFrames: onionSkin
        ? onionFramesFor(tactic.scene, tactic.keyframes, playback.currentTime)
        : undefined,
      motionPaths: playerPaths
        ? motionPathsFor(tactic.scene, tactic.keyframes, playback.currentTime)
        : undefined,
      trailFrames: ghostTrails
        ? trailFramesFor(tactic.scene, tactic.keyframes, playback.currentTime)
        : undefined,
      parkedKeyframeId: parked?.id ?? null,
      currentTime: playback.currentTime,
    }
  }, [frame, onionSkin, playerPaths, ghostTrails, tactic.scene, tactic.keyframes, playback.currentTime])

  onViewChange?.(view)

  const parkedId = view.parkedKeyframeId

  return (
    <div className={'space-y-2 ' + (className ?? '')}>
      <TimelineBar
        playback={playback}
        duration={tactic.duration_seconds}
        keyframes={tactic.keyframes}
        onionSkin={onionSkin}
        onToggleOnionSkin={() => setOnionSkin((on) => !on)}
        playerPaths={playerPaths}
        onTogglePlayerPaths={() => setPlayerPaths((on) => !on)}
        ghostTrails={ghostTrails}
        onToggleGhostTrails={() => setGhostTrails((on) => !on)}
        expanded={expanded}
        onToggleExpanded={() => setExpanded((open) => !open)}
        // Copy takes the keyframe under the playhead; paste drops the copied
        // shape in wherever the playhead currently is.
        onCopyKeyframe={parkedId ? () => host.copyKeyframe?.(parkedId) : undefined}
        onPasteKeyframe={host.canPaste ? () => host.pasteKeyframe?.(playback.currentTime) : undefined}
      />
      {expanded && <TimelineEditor host={host} playback={playback} frame={frame} />}
    </div>
  )
}
