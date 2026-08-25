import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

// A QR code for the share link (rework plan Stage 10.4), so a coach can hold
// their phone up to another coach's screen instead of typing a 32-character
// token.
//
// Rendered as our own SVG off `isDark(row, col)` rather than the library's
// `createSvgTag`/`createImgTag`, which emit hardcoded colours and a fixed
// size. One <rect> per dark module, no image decode, no data URL — and it
// scales to whatever box it's given.
//
// Deliberately NOT theme-aware, unlike every other surface in this app: a QR
// code is read by a camera, not a person, and scanners need dark modules on a
// light quiet zone. Inverting it in dark mode would look consistent and scan
// badly, so the light ground is drawn explicitly here and stays put in both
// themes. This is the one documented exception to design.md's token rule.
const DARK = '#111111'
const LIGHT = '#ffffff'

// Four modules of quiet zone is the QR spec's minimum. Anything less and
// phone scanners start missing it against a busy background.
const QUIET_ZONE = 4

export function QrCode({ value, size = 132 }: { value: string; size?: number }) {
  const modules = useMemo(() => {
    // Type 0 = pick the smallest version that fits. 'M' error correction
    // (~15%) is the usual choice for a screen-displayed code: 'L' is fragile
    // at a glancing phone angle, 'H' inflates the module count for a
    // robustness nothing here needs.
    const qr = qrcode(0, 'M')
    qr.addData(value)
    qr.make()
    const count = qr.getModuleCount()
    const dark: Array<{ row: number; col: number }> = []
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(row, col)) dark.push({ row, col })
      }
    }
    return { count, dark }
  }, [value])

  const span = modules.count + QUIET_ZONE * 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      shapeRendering="crispEdges"
      className="rounded-md"
      role="img"
      aria-label="QR code for the share link"
    >
      <rect width={span} height={span} fill={LIGHT} />
      {modules.dark.map(({ row, col }) => (
        <rect key={`${row}-${col}`} x={col + QUIET_ZONE} y={row + QUIET_ZONE} width={1} height={1} fill={DARK} />
      ))}
    </svg>
  )
}
