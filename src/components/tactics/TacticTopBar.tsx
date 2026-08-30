import {
  Box,
  ChevronLeft,
  Columns2,
  Download,
  HelpCircle,
  Maximize,
  Play,
  Redo2,
  Square,
  Undo2,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../../store'
import type { Tactic } from '../../store'
import {
  EDITOR_ICON_BUTTON,
  EDITOR_TOGGLE_OFF,
  EDITOR_TOGGLE_ON,
  EditorNameField,
  SaveIndicator,
} from '../design/editor/EditorShell'

// The tactics top bar (TACTICS_BOARD_REWORK_PLAN.md Stage 7.2): back, inline
// name, Single/Dual, 2D/3D,
// The panel toggles went on 2026-08-30: on desktop both columns are always up
// and below lg the dock already opens them, so the buttons only ever duplicated
// something else. Portrait/Landscape went with them — a pitch preset carries
// its own orientation, and the drill editor dropped the same control when the
// presets were simplified.
// and the save indicator. Add Ball moved to the tool row and the Timeline
// toggle went with the timeline itself, into the right-hand panel (2026-08-30).
//
// Its own component rather than a shared `EditorTopBar` with the drill's — the
// plan is explicit that a shell forced over two different toolbars is worse
// than two toolbars, and these two share only the back link, the name field
// and the save state, all of which come from EditorShell.
//
// ── Two things that are deliberately not here ─────────────────────────────
// ORIENTATION is gone (2026-08-30). It sat here from 2026-08-26 as a framing
// control, but a pitch preset already carries the orientation it is meant to be
// read in, and the drill editor dropped the same control when its presets were
// simplified. `setTacticOrientation` is left in the store — it is the only
// caller-facing way to transpose a board and costs nothing to keep — but
// nothing calls it now; a board keeps whatever orientation it was saved with.
//
// ACTIONS is still absent as a MENU. Teloframe collects Export, Presentation
// and Customize behind one; Stage 8 built the first two and Customize is
// already the inspector's Style tab, so all three have a home and a menu over
// them would be a layer with nothing in it. Export and Present are plain
// buttons in this bar instead, beside everything else a coach reaches for.
// UNDO/REDO here are the TIMELINE scope. Drawing undo lives in the inspector's
// Tools tab beside the drawing tools, which is the whole point of the two
// stacks Stage 2.3 built.

export function TacticTopBar({
  tactic,
  onEnterBoardOnly,
  onExport,
  onPresent,
  onReplayTour,
}: {
  tactic: Tactic
  onEnterBoardOnly: () => void
  onExport: () => void
  onPresent: () => void
  onReplayTour: () => void
}) {
  const updateTactic = useStore((s) => s.updateTactic)
  const saveState = useStore((s) => s.tacticSaveState)
  const undoTactic = useStore((s) => s.undoTactic)
  const redoTactic = useStore((s) => s.redoTactic)
  const canUndo = useStore((s) => s.canUndoTactic(tactic.id, 'timeline'))
  const canRedo = useStore((s) => s.canRedoTactic(tactic.id, 'timeline'))
  const setTacticView = useStore((s) => s.setTacticView)


  return (
    // Scrolls sideways rather than wrapping. This bar carries more controls
    // than the drill's, and letting it wrap to two or three rows on a phone
    // pushed the whole layout down until the floating dock covered the
    // timeline — the 260px chrome reserve the canvas sizes against assumes a
    // one-row bar. One row that scrolls keeps that assumption true at every
    // width.
    <div className="flex items-center gap-1 overflow-x-auto border-b border-line pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link to="/tactics" aria-label="Back to tactics" title="Back to tactics" className={EDITOR_ICON_BUTTON + ' shrink-0'}>
        <ChevronLeft className="h-5 w-5" />
      </Link>

      <EditorNameField
        documentId={tactic.id}
        name={tactic.name}
        label="Tactic name"
        anchor="tactic-name"
        onCommit={(name) => void updateTactic(tactic.id, { name })}
      />

      <SaveIndicator state={saveState} />

      {/* Single / Dual (7.4) — a filter over entities by team, not two scenes. */}
      <div data-onboarding-anchor="tactic-view" className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => setTacticView(tactic.id, 'single')}
          aria-pressed={tactic.view === 'single'}
          className={(tactic.view === 'single' ? EDITOR_TOGGLE_ON : EDITOR_TOGGLE_OFF) + ' shrink-0'}
          title="Show one side (S)"
        >
          <Square className="h-3.5 w-3.5" />
          Single
        </button>
        <button
          type="button"
          onClick={() => setTacticView(tactic.id, 'dual')}
          aria-pressed={tactic.view === 'dual'}
          className={(tactic.view === 'dual' ? EDITOR_TOGGLE_ON : EDITOR_TOGGLE_OFF) + ' shrink-0'}
          title="Show both sides (D)"
        >
          <Columns2 className="h-3.5 w-3.5" />
          Dual
        </button>
      </div>

      <button
        type="button"
        onClick={() => undoTactic(tactic.id, 'timeline')}
        disabled={!canUndo}
        className={EDITOR_ICON_BUTTON + ' shrink-0'}
        aria-label="Undo"
        title="Undo the last change to the board"
      >
        <Undo2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => redoTactic(tactic.id, 'timeline')}
        disabled={!canRedo}
        className={EDITOR_ICON_BUTTON + ' shrink-0'}
        aria-label="Redo"
        title="Redo"
      >
        <Redo2 className="h-4 w-4" />
      </button>

      <button
        type="button"
        data-onboarding-anchor="tactic-present"
        onClick={onPresent}
        className={EDITOR_TOGGLE_OFF + ' shrink-0'}
        title="Present phase by phase, full screen (P)"
      >
        <Play className="h-3.5 w-3.5" />
        Present
      </button>

      <button
        type="button"
        data-onboarding-anchor="tactic-export"
        onClick={onExport}
        className={EDITOR_ICON_BUTTON + ' shrink-0'}
        aria-label="Export"
        title="Export & share"
      >
        <Download className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onEnterBoardOnly}
        className={EDITOR_ICON_BUTTON + ' shrink-0'}
        aria-label="Board-only mode"
        title="Board-only mode (F)"
      >
        <Maximize className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={onReplayTour}
        className={EDITOR_ICON_BUTTON + ' shrink-0'}
        aria-label="Replay the walkthrough"
        title="Replay the walkthrough"
      >
        <HelpCircle className="h-4 w-4" />
      </button>

      {/* STILL DEFERRED, and now on the record. Stage 10.2 is where this plan
          revisits 3D, and its own answer is "still recommend deferring —
          ship Stages 0-9 first". Those shipped; the recommendation did not
          change, so this button stays disabled.
        
          The reason it costs nothing to keep waiting is the whole point of the
          rework: `scene`/`keyframes` is renderer-agnostic and BOTH editors now
          feed it, so 3D is a pure addition whenever it is wanted, and building
          it once against the shared model gives it to drills and tactics
          together. The fields Teloframe's 3D leaks into 2D — body shape,
          facing, the goalkeeper's dive — are already carried in
          `SceneEntity`/`EntityState`, so nothing is being lost in the
          meantime either.
        
          What it would take, from the plan's own estimate: ~8-16h across 3-5
          sessions. That is an XL item the plan brackets separately from the
          rest of the stage for exactly that reason. */}
      <button type="button" disabled className={EDITOR_ICON_BUTTON + ' shrink-0'} aria-label="3D view" title="3D view — not built yet">
        <Box className="h-4 w-4" />
      </button>
    </div>
  )
}
