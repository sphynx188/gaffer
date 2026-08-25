import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, FileText, Image, Link2, Loader2 } from 'lucide-react'
import { useStore } from '../../../store'
import type { Drill } from '../../../store'
import { useToast } from '../../ui/useToast'
import { QrCode } from '../export/QrCode'
import { fileStem } from '../export/exportFile'

// Export & share (rework plan Stage 10). Opened from the top bar's Export
// button, which was rendered disabled from Stage 5 waiting for exactly this.
//
// Filename is a single field shared by every file export, seeded from the
// drill's own name — the plan's export dialog leads with it, and a folder of
// "drill.png, drill (1).png, drill (2).png" is what happens without it.

const ROW =
  'flex min-h-11 w-full items-center gap-2 rounded-md border border-line px-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50 lg:min-h-9'

const FIELD =
  'w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/30'

interface ExportPanelProps {
  drill: Drill
  // Owned by the editor — only it can reach the Konva stage (same split as
  // Stage 8's thumbnail capture).
  onExportPng: (filename: string) => void
  onExportGif: (filename: string) => void
  gifProgress: number | null
}

export function ExportPanel({ drill, onExportPng, onExportGif, gifProgress }: ExportPanelProps) {
  const enableDrillSharing = useStore((s) => s.enableDrillSharing)
  const disableDrillSharing = useStore((s) => s.disableDrillSharing)
  const showToast = useToast()

  const [stem, setStem] = useState(() => fileStem(drill.name))
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = drill.share_token ? `${window.location.origin}/d/${drill.share_token}` : null

  const handleToggleShare = async () => {
    setSharing(true)
    if (drill.share_token) {
      const ok = await disableDrillSharing(drill.id)
      showToast(ok ? 'Sharing turned off — the old link is dead' : "Couldn't turn sharing off")
    } else {
      const token = await enableDrillSharing(drill.id)
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

  const name = stem.trim() || fileStem(drill.name)

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
          placeholder={fileStem(drill.name)}
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
          {gifProgress !== null ? `Recording — ${Math.round(gifProgress * 100)}%` : 'GIF — the whole drill'}
        </button>
        <Link to={`/drills/${drill.id}/card`} className={ROW}>
          <FileText className="h-4 w-4 shrink-0" />
          Coach's card — print or PDF
        </Link>
      </div>

      <div className="space-y-1.5 border-t border-line pt-3">
        <p className="text-xs font-medium text-ink-muted">Share link</p>
        {shareUrl ? (
          <>
            <p className="text-xs text-ink-faint">
              Anyone with this link can watch this drill without an account. No other drill is reachable from it.
            </p>
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
            <p className="text-xs text-ink-faint">
              Off. Turning it on publishes this drill to anyone holding the link — nothing else in your account.
            </p>
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
