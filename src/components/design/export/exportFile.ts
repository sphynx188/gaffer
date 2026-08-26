// Turning something the browser already holds into a file on disk (rework
// plan Stage 10.1). Deliberately tiny and dependency-free: every export in
// this stage — PNG now, GIF later — ends the same way, with a blob and a
// filename, so that ending lives in one place.
//
// Serves tactics too as of TACTICS_BOARD_REWORK_PLAN.md Stage 8.1, unchanged
// apart from `fileStem`'s fallback — a tactic named entirely in punctuation
// should not download as `drill.png`.

/**
 * A filename stem from a document's name: lowercase, spaces and punctuation
 * collapsed to single hyphens, no leading/trailing hyphen. "4v2 Rondo
 * (wide)" becomes "4v2-rondo-wide". Falls back to `fallback` so a document
 * named entirely in punctuation still produces a usable file.
 */
export function fileStem(name: string, fallback = 'drill'): string {
  const stem = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return stem || fallback
}

/**
 * Prompts the browser to save `blob` as `filename`.
 *
 * The object URL is revoked on the next task rather than immediately: Safari
 * has historically cancelled the download if the URL is freed in the same
 * tick as the click, and the cost of holding it one turn of the event loop
 * longer is nothing.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Same, for a `stage.toDataURL()` result. */
export async function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob()
  downloadBlob(blob, filename)
}
