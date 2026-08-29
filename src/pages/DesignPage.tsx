import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { configFromPreset, findPreset } from '../components/design/canvas/pitchPresets'
import { Skeleton } from '../components/ui/Skeleton'

// `/design` creates a new drill and lands straight in its editor at
// `/design/:drillId` — no separate create form. Name, pitch size and
// orientation used to be collected here up front, but every one of them is
// already editable inline once inside the editor (EditorTopBar's name
// field; ToolRail/DrillDetailsDrawer's PitchPanel for size and orientation),
// so asking for them twice was the redundant step. This page's only job now
// is create-then-redirect; editing an EXISTING drill still goes through
// Drill Library, which navigates straight to `/design/:id` itself.
export function DesignPage() {
  const navigate = useNavigate()
  const createDrill = useStore((s) => s.createDrill)
  const drillsError = useStore((s) => s.drillsError)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const preset = findPreset('full')!
    void createDrill({
      name: 'New drill',
      orientation: preset.orientation,
      pitch: configFromPreset(preset),
    }).then((created) => {
      if (created) navigate(`/design/${created.id}`, { replace: true })
    })
  }, [createDrill, navigate])

  if (drillsError) {
    return <p className="text-sm text-bad">{drillsError}</p>
  }

  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Creating drill…</span>
      <Skeleton className="aspect-[3/2] w-full max-w-[960px] rounded-lg" />
    </div>
  )
}
