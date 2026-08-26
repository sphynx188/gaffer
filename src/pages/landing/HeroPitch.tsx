import { useEffect, useMemo } from 'react'
import { PitchCanvas } from '../../components/design/PitchCanvas'
import { frameAt } from '../../components/design/canvas/interpolate'
import { useTimelinePlayback } from '../../components/design/timeline/useTimelinePlayback'
import { DEMO_SCENE } from './demoScene'

// The hero's proof: the real PitchCanvas running the real interpolator on a
// looping build-up. Default export so LandingPage can React.lazy() it —
// react-konva stays out of the landing page's first paint.
export default function HeroPitch() {
  const playback = useTimelinePlayback(DEMO_SCENE.duration)
  const frame = useMemo(
    () => frameAt(DEMO_SCENE.scene, DEMO_SCENE.keyframes, playback.currentTime),
    [playback.currentTime]
  )

  const { toggleLoop, play } = playback
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    toggleLoop()
    play()
  }, [toggleLoop, play])

  return <PitchCanvas pitch={DEMO_SCENE.pitch} frame={frame} maxWidth={720} />
}
