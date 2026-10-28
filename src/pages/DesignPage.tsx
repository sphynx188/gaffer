import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { configFromPreset, findPreset } from '../components/design/canvas/pitchPresets'
import { PageHeader } from '../components/ui/PageHeader'
import { Card } from '../components/ui/Card'
import { DrillFilingFields } from '../components/design/DrillFilingFields'

// Create → Drill (spec 2026-10-28): name, a required collection and optional
// tags, THEN the editor. Every drill is filed in exactly one collection from
// the moment it exists, so the collection can't be left to the editor the way
// pitch size and orientation are — those stay editable inline once inside,
// and are deliberately not asked for here.
//
// Submitting still doesn't WRITE a drill, though (2026-08-30). `/design` used
// to insert one on navigation, which meant every stray visit — a mistyped
// URL, a back-button bounce, a nav misclick — left a permanent "New drill"
// row behind; sixteen empty ones had piled up in the library by the time an
// automated pass caught it. It starts a local draft and hands it to the same
// editor: the row (and its tags) are written by the first edit (drillSlice's
// runFlush inserts it), and backing out of the editor without editing leaves
// nothing at all. The draft just starts out filed.
//
// `startDrillDraft` returns null where it can't mint a uuid client-side, which
// is the one case that still falls back to creating eagerly.
export function DesignPage() {
  const navigate = useNavigate()
  const startDrillDraft = useStore((s) => s.startDrillDraft)
  const createDrill = useStore((s) => s.createDrill)
  const drillsError = useStore((s) => s.drillsError)
  const [name, setName] = useState('')
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!collectionId || creating) return
    setCreating(true)
    const preset = findPreset('full')!
    const input = {
      name: name.trim() || 'New drill',
      orientation: preset.orientation,
      pitch: configFromPreset(preset),
      collection_id: collectionId,
      tag_ids: tagIds,
    }
    const draft = startDrillDraft(input)
    if (draft) {
      navigate(`/design/${draft.id}`, { replace: true })
      return
    }
    const created = await createDrill(input)
    setCreating(false)
    if (created) navigate(`/design/${created.id}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New drill" description="File it in a collection so the club can find it later." />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-ink-muted">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New drill"
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
          </label>
          <DrillFilingFields
            collectionId={collectionId}
            tagIds={tagIds}
            onCollectionChange={setCollectionId}
            onTagsChange={setTagIds}
          />
          {drillsError && <p className="text-sm text-bad">{drillsError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!collectionId || creating}
              className="min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 lg:min-h-9"
            >
              {creating ? 'Creating…' : 'Create drill'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
