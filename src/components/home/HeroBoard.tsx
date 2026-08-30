import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, LibraryBig, Shield } from 'lucide-react'
import type { Drill, Tactic } from '../../store'
import {
  DRILL_DIFFICULTY_LABELS,
  DRILL_PHASE_OF_PLAY_LABELS,
  SESSION_BLOCK_LABELS,
} from '../../store'
import { PitchCanvas } from '../design/PitchCanvas'
import { presetLabel } from '../design/canvas/pitchPresets'
import { formationLabel } from '../tactics/formationLabel'
import { useBoardPlayback } from '../../hooks/useBoardPlayback'
import type { HomeBoard } from './homeBoards'

// The Home tab's hero (2026-08-30): the board this coach most recently had
// open, drawn live and PLAYING — the only place in the app a drill runs
// without someone pressing play. The pitch is the most characteristic object
// Gaffer has, so it leads the page rather than a row of numbers; the details
// beside it are what a coach reads before walking onto the grass with it.
//
// The whole board is one link. A transparent anchor sits over the canvas
// rather than wrapping it, so the click never reaches Konva's own pointer
// handling and keyboard focus has a ring to land on.

const MIN_HEIGHT = 220
const MAX_HEIGHT = 440
// 16:9 until the height cap bites; below that the canvas stays this ratio so
// the hero never becomes a thin letterbox on a phone.
const RATIO = 9 / 16

export function HeroBoard({
  board,
  openPath,
  collectionNames,
  eyebrow,
  playing,
}: {
  board: HomeBoard
  openPath: string
  collectionNames: string[]
  /** "Pick up where you left off" when it is history, something honest when it isn't. */
  eyebrow: string
  playing: boolean
}) {
  const frame = useBoardPlayback(board.doc, playing)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(MAX_HEIGHT)

  useLayoutEffect(() => {
    const element = wrapRef.current
    if (!element) return
    const measure = () => {
      const width = element.getBoundingClientRect().width
      setHeight(Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, width * RATIO))))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const Icon = board.kind === 'drill' ? LibraryBig : Shield
  const facts = board.kind === 'drill' ? drillFacts(board.doc) : tacticFacts(board.doc)
  const summary = board.kind === 'drill' ? board.doc.objective || board.doc.description : board.doc.description
  const points = board.kind === 'drill' ? (board.doc.coaching.points ?? []).filter(Boolean).slice(0, 3) : []

  return (
    <section
      aria-labelledby="home-hero-title"
      className="panel-edge grid overflow-hidden rounded-xl border border-line bg-panel lg:grid-cols-[minmax(0,1fr)_21rem]"
    >
      <div ref={wrapRef} className="relative min-w-0">
        <PitchCanvas pitch={board.doc.pitch} frame={frame} maxWidth={1400} maxHeight={height} fillCanvas />
        <Link
          to={openPath}
          aria-label={`Open ${board.doc.name}`}
          className="absolute inset-0 rounded-tl-xl outline-none ring-inset focus-visible:ring-2 focus-visible:ring-accent/60"
        />
      </div>

      {/* Pinned to the canvas's height on desktop so a drill with a long
          objective and three coaching points scrolls inside the column
          instead of stretching the card past the pitch. */}
      <div
        className="flex min-w-0 flex-col border-t border-line lg:h-(--hero-h) lg:border-l lg:border-t-0"
        style={{ '--hero-h': `${height}px` } as CSSProperties}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 [scrollbar-width:thin]">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-faint">
            <Icon className="h-3.5 w-3.5" />
            {eyebrow}
          </p>
          <h2 id="home-hero-title" className="mt-2 text-xl font-semibold leading-snug tracking-tight text-ink">
            {board.doc.name}
          </h2>
          {collectionNames.length > 0 && (
            <p className="mt-1 truncate text-sm text-ink-muted">{collectionNames.join(' · ')}</p>
          )}

          {facts.length > 0 && (
            <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex items-baseline gap-1.5">
                  <dt className="text-xs text-ink-faint">{label}</dt>
                  <dd className="tabular-nums text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {summary && <p className="mt-4 text-sm leading-relaxed text-ink-muted line-clamp-3">{summary}</p>}

          {points.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm text-ink">
              {points.map((point) => (
                <li key={point} className="flex gap-2.5">
                  {/* A hairline tick rather than a bullet: the same mark a
                      coach draws beside a point that landed. */}
                  <span aria-hidden="true" className="mt-2.5 h-px w-3 shrink-0 bg-ink-faint" />
                  <span className="line-clamp-2">{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-5 pb-5 pt-4">
          <Link
            to={openPath}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-accent px-3.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            Open {board.kind}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}

// Label/value pairs, only for what's actually recorded — a drill with no
// metadata shows none rather than a row of dashes.
function drillFacts(drill: Drill): [string, string][] {
  const facts: [string, string][] = []
  if (drill.session_block) facts.push(['Block', SESSION_BLOCK_LABELS[drill.session_block]])
  if (drill.phase_of_play) facts.push(['Phase', DRILL_PHASE_OF_PLAY_LABELS[drill.phase_of_play]])
  if (drill.duration_minutes) facts.push(['Length', `${drill.duration_minutes} min`])
  if (drill.players_recommended) facts.push(['Players', String(drill.players_recommended)])
  else if (drill.min_players && drill.max_players) facts.push(['Players', `${drill.min_players}–${drill.max_players}`])
  if (drill.difficulty) facts.push(['Level', DRILL_DIFFICULTY_LABELS[drill.difficulty]])
  facts.push(['Pitch', presetLabel(drill.pitch.preset)])
  return facts
}

function tacticFacts(tactic: Tactic): [string, string][] {
  const facts: [string, string][] = []
  facts.push(['Shape', `${formationLabel(tactic.sides.home.formation)} v ${formationLabel(tactic.sides.away.formation)}`])
  if (tactic.phase_of_play) facts.push(['Phase', DRILL_PHASE_OF_PLAY_LABELS[tactic.phase_of_play]])
  if (tactic.keyframes.length > 1) facts.push(['Moments', String(tactic.keyframes.length)])
  facts.push(['Pitch', presetLabel(tactic.pitch.preset)])
  return facts
}
