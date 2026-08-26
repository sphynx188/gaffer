import {
  Box,
  ChevronLeft,
  Circle,
  Columns2,
  Maximize,
  PanelLeft,
  PanelRight,
  Redo2,
  RectangleHorizontal,
  RectangleVertical,
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
// name, squad and inspector toggles, Single/Dual, Portrait/Landscape, 2D/3D,
// Add Ball, Timeline, and the save indicator.
//
// Its own component rather than a shared `EditorTopBar` with the drill's — the
// plan is explicit that a shell forced over two different toolbars is worse
// than two toolbars, and these two share only the back link, the name field
// and the save state, all of which come from EditorShell.
//
// ── Two things that are deliberately not here ─────────────────────────────
// ORIENTATION sits in this bar rather than buried in a pitch panel (decided
// 2026-08-26): it is a framing control a coach reaches for while thinking, not
// a setup step. It calls `setTacticOrientation`, which transposes the content
// as well as the markings — see canvas/transposeScene.ts for why that matters.
//
// ACTIONS is absent. Teloframe's Actions menu holds Export, Presentation and
// Customize, all of which are Stage 8's; an empty menu is worse than no menu.
// UNDO/REDO here are the TIMELINE scope. Drawing undo lives in the inspector's
// Tools tab beside the drawing tools, which is the whole point of the two
// stacks Stage 2.3 built.

export function TacticTopBar({
  tactic,
  squadOpen,
  onToggleSquad,
  inspectorOpen,
  onToggleInspector,
  timelineOpen,
  onToggleTimeline,
  onAddBall,
  onEnterBoardOnly,
}: {
  tactic: Tactic
  squadOpen: boolean
  onToggleSquad: () => void
  inspectorOpen: boolean
  onToggleInspector: () => void
  timelineOpen: boolean
  onToggleTimeline: () => void
  onAddBall: () => void
  onEnterBoardOnly: () => void
}) {
  const updateTactic = useStore((s) => s.updateTactic)
  const saveState = useStore((s) => s.tacticSaveState)
  const undoTactic = useStore((s) => s.undoTactic)
  const redoTactic = useStore((s) => s.redoTactic)
  const canUndo = useStore((s) => s.canUndoTactic(tactic.id, 'timeline'))
  const canRedo = useStore((s) => s.canRedoTactic(tactic.id, 'timeline'))
  const setTacticView = useStore((s) => s.setTacticView)
  const setTacticOrientation = useStore((s) => s.setTacticOrientation)

  const landscape = tactic.pitch.orientation === 'landscape'

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
        onCommit={(name) => void updateTactic(tactic.id, { name })}
      />

      <SaveIndicator state={saveState} />

      {/* Panel toggles. On desktop these collapse the columns; below lg they
          open the sheets, which is what the dock does too. */}
      <button
        type="button"
        onClick={onToggleSquad}
        aria-pressed={squadOpen}
        className={EDITOR_ICON_BUTTON + ' shrink-0'}
        aria-label="Toggle the squad panel"
        title="Squad panel"
      >
        <PanelLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onToggleInspector}
        aria-pressed={inspectorOpen}
        className={EDITOR_ICON_BUTTON + ' shrink-0'}
        aria-label="Toggle the inspector"
        title="Inspector"
      >
        <PanelRight className="h-4 w-4" />
      </button>

      {/* Single / Dual (7.4) — a filter over entities by team, not two scenes. */}
      <div className="flex shrink-0 items-center gap-0.5">
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
        onClick={() => setTacticOrientation(tactic.id, landscape ? 'portrait' : 'landscape')}
        className={EDITOR_TOGGLE_OFF + ' shrink-0'}
        title="Flip the pitch — the players and drawings turn with it"
      >
        {landscape ? (
          <RectangleHorizontal className="h-3.5 w-3.5" />
        ) : (
          <RectangleVertical className="h-3.5 w-3.5" />
        )}
        {landscape ? 'Landscape' : 'Portrait'}
      </button>

      <button
        type="button"
        onClick={onAddBall}
        className={EDITOR_TOGGLE_OFF + ' shrink-0'}
        title="Add a ball to the board"
      >
        <Circle className="h-3.5 w-3.5" />
        Ball
      </button>

      <button
        type="button"
        onClick={onToggleTimeline}
        aria-pressed={timelineOpen}
        className={(timelineOpen ? EDITOR_TOGGLE_ON : EDITOR_TOGGLE_OFF) + ' shrink-0'}
        title="Open the timeline"
      >
        Timeline
      </button>

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
        onClick={onEnterBoardOnly}
        className={EDITOR_ICON_BUTTON + ' shrink-0'}
        aria-label="Board-only mode"
        title="Board-only mode (F)"
      >
        <Maximize className="h-4 w-4" />
      </button>

      {/* Deferred exactly as the drill editor's is: Stage 11 of the drill
          rework decided against building 3D rather than for it, and Stage 10
          here revisits the question. Nothing to open yet. */}
      <button type="button" disabled className={EDITOR_ICON_BUTTON + ' shrink-0'} aria-label="3D view" title="3D view — not built yet">
        <Box className="h-4 w-4" />
      </button>
    </div>
  )
}
