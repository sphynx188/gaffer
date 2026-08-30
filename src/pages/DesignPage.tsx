import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { configFromPreset, findPreset } from '../components/design/canvas/pitchPresets'
import { Skeleton } from '../components/ui/Skeleton'

// `/design` opens a new drill's editor — no separate create form. Name, pitch
// size and orientation are all editable inline once inside, so asking for them
// up front was the redundant step.
//
// It no longer WRITES a drill, though (2026-08-30). It used to insert one on
// navigation, which meant every stray visit — a mistyped URL, a back-button
// bounce, a nav misclick — left a permanent "New drill" row behind; sixteen
// empty ones had piled up in the library by the time an automated pass caught
// it. Now it starts a local draft and hands it to the same editor: the row is
// written by the first edit (drillSlice's runFlush inserts it), and a visit
// that goes nowhere leaves nothing at all.
//
// `startDrillDraft` returns null where it can't mint a uuid client-side, which
// is the one case that still falls back to creating eagerly.
export function DesignPage() {
  const navigate = useNavigate()
  const startDrillDraft = useStore((s) => s.startDrillDraft)
  const createDrill = useStore((s) => s.createDrill)
  const drillsError = useStore((s) => s.drillsError)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const preset = findPreset('full')!
    const input = {
      name: 'New drill',
      orientation: preset.orientation,
      pitch: configFromPreset(preset),
    }
    const draft = startDrillDraft(input)
    if (draft) {
      navigate(`/design/${draft.id}`, { replace: true })
      return
    }
    void createDrill(input).then((created) => {
      if (created) navigate(`/design/${created.id}`, { replace: true })
    })
  }, [startDrillDraft, createDrill, navigate])

  if (drillsError) {
    return <p className="text-sm text-bad">{drillsError}</p>
  }

  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Opening drill…</span>
      <Skeleton className="aspect-[3/2] w-full max-w-[960px] rounded-lg" />
    </div>
  )
}
