import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, FileText, Image, Link2, Loader2 } from 'lucide-react'
import { useToast } from '../../ui/useToast'
import { QrCode } from '../export/QrCode'
import { fileStem } from '../export/exportFile'

// Export & share (rework plan Stage 10). Opened from the top bar's Export
// button, which was rendered disabled from Stage 5 waiting for exactly this.
//
// Filename is a single field shared by every file export, seeded from the
// document's own name — the plan's export dialog leads with it, and a folder
// of "drill.png, drill (1).png, drill (2).png" is what happens without it.
//
// ── Parameterised, not forked (TACTICS_BOARD_REWORK_PLAN.md Stage 8.1) ────
// This took a `drill: Drill` until tactics needed the same panel. Everything
// it actually uses is four strings and two actions, so it takes those instead
// — the same move Stage 7 made on PropertiesPanel, and for the same reason:
// two near-copies of this file would drift, and the share half is the half
// where drift is a security bug rather than a cosmetic one.

const ROW =
  'flex min-h-11 w-full items-center gap-2 rounded-md border border-line px-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50 lg:min-h-9'

const FIELD =
  'w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30'

/** The per-kind wording. Everything else on this panel is identical. */
const COPY = {
  drill: {
    animation: 'GIF — the whole drill',
    card: "Coach's card — print or PDF",
    sharedOn: 'Anyone with this link can watch this drill without an account. No other drill is reachable from it.',
    sharedOff: 'Off. Turning it on publishes this drill to anyone holding the link — nothing else in your account.',
  },
  tactic: {
    animation: 'GIF — the whole tactic',
    card: 'Tactic card — print or PDF',
    sharedOn: 'Anyone with this link can watch this tactic without an account. No other tactic is reachable from it.',
    sharedOff: 'Off. Turning it on publishes this tactic to anyone holding the link — nothing else in your account.',
  },
} as const

export interface ExportTarget {
  /** Picks the wording above and the filename fallback. */
  kind: 'drill' | 'tactic'
  name: string
  shareToken: string | null
  /** The public route's prefix — `/d` for drills, `/t` for tactics. */
  sharePath: string
  /** The print-styled card route for this document. */
  cardPath: string
  /** Resolves to the new token, or null if it couldn't be minted. */
  onEnableSharing: () => Promise<string | null>
  onDisableSharing: () => Promise<boolean>
}

interface ExportPanelProps {
  target: ExportTarget
  // Owned by the editor — only it can reach the Konva stage (same split as
  // Stage 8's thumbnail capture).
  onExportPng: (filename: string) => void
  onExportGif: (filename: string) => void
  gifProgress: number | null
}

export function ExportPanel({ target, onExportPng, onExportGif, gifProgress }: ExportPanelProps) {
  const showToast = useToast()
  const copy = COPY[target.kind]

  const [stem, setStem] = useState(() => fileStem(target.name, target.kind))
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = target.shareToken
    ? `${window.location.origin}${target.sharePath}/${target.shareToken}`
    : null

  const handleToggleShare = async () => {
    setSharing(true)
    if (target.shareToken) {
      const ok = await target.onDisableSharing()
      showToast(ok ? 'Sharing turned off — the old link is dead' : "Couldn't turn sharing off")
    } else {
      const token = await target.onEnableSharing()
      showToast(token ? 'Share link created' : "Couldn't create a share link")
    }
    setSharing(false)
  }

  const handleCopy = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard access can be refused outright (permissions, insecure
      // context). The link is on screen and selectable either way, so this
      // says so rather than failing silently.
      showToast('Copy failed — select the link and copy it by hand')
    }
  }

  const name = stem.trim() || fileStem(target.name, target.kind)

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="export-filename" className="text-xs font-medium text-ink-muted">
          Filename
        </label>
        <input
          id="export-filename"
          value={stem}
          onChange={(e) => setStem(e.target.value)}
          placeholder={fileStem(target.name, target.kind)}
          className={FIELD}
        />
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-medium text-ink-muted">Download</p>
        <button type="button" onClick={() => onExportPng(`${name}.png`)} className={ROW}>
          <Image className="h-4 w-4 shrink-0" />
          PNG — the board right now
        </button>
        <button type="button" onClick={() => onExportGif(`${name}.gif`)} disabled={gifProgress !== null} className={ROW}>
          {gifProgress !== null ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <Image className="h-4 w-4 shrink-0" />
          )}
          {gifProgress !== null ? `Recording — ${Math.round(gifProgress * 100)}%` : copy.animation}
        </button>
        <Link to={target.cardPath} className={ROW}>
          <FileText className="h-4 w-4 shrink-0" />
          {copy.card}
        </Link>
      </div>

      <div className="space-y-1.5 border-t border-line pt-3">
        <p className="text-xs font-medium text-ink-muted">Share link</p>
        {shareUrl ? (
          <>
            <p className="text-xs text-ink-faint">{copy.sharedOn}</p>
            <div className="flex justify-center py-1">
              <QrCode value={shareUrl} />
            </div>
            <p className="break-all rounded-md border border-line bg-panel-raised px-2 py-1.5 text-xs text-ink-muted">
              {shareUrl}
            </p>
            <button type="button" onClick={handleCopy} className={ROW}>
              {copied ? <Check className="h-4 w-4 shrink-0 text-ok" /> : <Copy className="h-4 w-4 shrink-0" />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              onClick={handleToggleShare}
              disabled={sharing}
              className={ROW + ' hover:border-bad hover:text-bad'}
            >
              <Link2 className="h-4 w-4 shrink-0" />
              {sharing ? 'Working…' : 'Stop sharing'}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-faint">{copy.sharedOff}</p>
            <button type="button" onClick={handleToggleShare} disabled={sharing} className={ROW}>
              <Link2 className="h-4 w-4 shrink-0" />
              {sharing ? 'Working…' : 'Create a share link'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
