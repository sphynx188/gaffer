import { Circle, Group, Line, Path, Text, TextPath } from 'react-konva'
import { BALL, TOKEN_SHADOW } from '../pitchTheme'

// The match ball (2026-10-28): the partner brand's GIOCA ball — white, with a
// silver halftone X across it, the GIOCA wordmark (its A drawn as a Λ) over
// the crossing, and the "Official size 5 / All weather" badge below.
//
// Everything decorative is authored in the coordinates of a 512x512 crop of
// a photo of the real ball — centred at (256, 256), radius 256 — and the
// Group maps that onto `radius`. That keeps the shapes checkable against the
// photo, and lets the lettering use real font sizes (Konva draws text badly
// at a fractional size).
const ART = 256

// The silver X, traced from the photo. The bands are told apart from the
// white leather by their halftone texture (local contrast), not by colour —
// the photo's lighting turns shaded white panels as grey as the band. Seams
// were opened away, and behind the GIOCA lettering, where the trace can't
// see, the band fills everything that isn't plain white panel, as on the
// real ball. The two arms that run off the ball (upper left, lower right)
// are carried out to the rim, where the foreshortened dots fade from the
// trace; the other two taper to points, as printed. Outline simplified and
// smoothed into curves.
const BAND =
  'M 119 34 C 113.2 36 102.5 43.3 93 51 C 83.5 58.7 72.8 67.3 62 80 C 51.2 92.7 32.8 117.2 28 127 C 23.2 136.8 26.3 134 33 139 C 39.7 144 57 152.7 68 157 C 79 161.3 84.2 159.3 99 165 C 113.8 170.7 146.3 185.5 157 191 C 167.7 196.5 162 188.7 163 198 C 164 207.3 159.8 236.8 163 247 C 166.2 257.2 192.2 239.3 182 259 C 171.8 278.7 117.2 344.3 102 365 C 86.8 385.7 92.7 378.7 91 383 C 89.3 387.3 89 387.2 92 391 C 95 394.8 104 404.2 109 406 C 114 407.8 107.5 411.2 122 402 C 136.5 392.8 176.5 365.8 196 351 C 215.5 336.2 228.8 320.5 239 313 C 249.2 305.5 245 313.3 257 306 C 269 298.7 300.5 275.3 311 269 C 321.5 262.7 307.7 260.3 320 268 C 332.3 275.7 365.2 296.8 385 315 C 404.8 333.2 424.8 363.3 439 377 C 453.2 390.7 463.3 394 470 397 C 476.7 400 474.5 400.8 479 395 C 483.5 389.2 491.8 373.7 497 362 C 502.2 350.3 507.5 340 510 325 C 512.5 310 512.7 281.8 512 272 C 511.3 262.2 513.3 267.5 506 266 C 498.7 264.5 478.5 268 468 263 C 457.5 258 448.5 243.2 443 236 C 437.5 228.8 438.7 232.2 435 220 C 431.3 207.8 420 179.3 421 163 C 422 146.7 441.5 131.7 441 122 C 440.5 112.3 421.3 108.7 418 105 C 414.7 101.3 418.8 100.7 421 100 C 423.2 99.3 428.5 101.7 431 101 C 433.5 100.3 436.2 99 436 96 C 435.8 93 432.2 86.2 430 83 C 427.8 79.8 425.5 77.8 423 77 C 420.5 76.2 423.7 72 415 78 C 406.3 84 389.5 101.3 371 113 C 352.5 124.7 322.7 146.5 304 148 C 285.3 149.5 272.8 128.8 259 122 C 245.2 115.2 230.7 112.2 221 107 C 211.3 101.8 212.8 96.7 201 91 C 189.2 85.3 162.2 81.7 150 73 C 137.8 64.3 133.2 45.5 128 39 C 122.8 32.5 124.8 32 119 34 Z'

// A fine dot screen over the band colour — the photo's hex halftone. Built
// once, lazily, as a pattern tile.
let halftone: HTMLCanvasElement | null = null
function halftoneTile(): HTMLCanvasElement {
  if (halftone) return halftone
  const size = 8
  halftone = document.createElement('canvas')
  halftone.width = size
  halftone.height = size
  const ctx = halftone.getContext('2d')
  if (ctx) {
    ctx.fillStyle = BALL.band
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = BALL.bandDot
    for (const [x, y] of [[2, 2], [6, 6]]) {
      ctx.beginPath()
      ctx.arc(x, y, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return halftone
}

// GIOCA as printed: heavy condensed capitals in dark grey, outlined white so
// they read over the band and the panel alike. The A is a Λ, drawn as a
// shape after the measured width of "GIOC".
const WORD = { x: 170, cy: 208, size: 96, spacing: 4 }
const WORD_FONT = 'Impact, Haettenschweiler, "Arial Narrow", sans-serif'

let measured: number | null = null
function giocWidth(): number {
  if (measured != null) return measured
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return WORD.size * 2
  ctx.font = `bold ${WORD.size}px ${WORD_FONT}`
  measured = ctx.measureText('GIOC').width + WORD.spacing * 4
  return measured
}

function Lambda({ x, top, height }: { x: number; top: number; height: number }) {
  const w = height * 0.72
  const bottom = top + height
  const points = [x, bottom, x + w * 0.36, top, x + w * 0.64, top, x + w, bottom, x + w * 0.7, bottom, x + w * 0.5, top + height * 0.3, x + w * 0.3, bottom]
  return (
    <>
      <Line points={points} closed stroke="#ffffff" strokeWidth={6} lineJoin="round" />
      <Line points={points} closed fill={BALL.ink} />
    </>
  )
}

export function BallShape({ radius }: { radius: number }) {
  const capHeight = WORD.size * 0.79
  const capTop = WORD.cy - capHeight / 2
  return (
    <>
      <Circle
        radius={radius}
        fill={BALL.panel}
        shadowColor={TOKEN_SHADOW.color}
        shadowOpacity={TOKEN_SHADOW.opacity}
        shadowBlur={TOKEN_SHADOW.blur}
        shadowOffsetY={TOKEN_SHADOW.offsetY}
      />
      <Group scaleX={radius / ART} scaleY={radius / ART} offsetX={ART} offsetY={ART} listening={false}>
        <Group clipFunc={(ctx) => ctx.arc(ART, ART, ART, 0, Math.PI * 2, false)}>
          <Path data={BAND} fillPatternImage={halftoneTile() as unknown as HTMLImageElement} fillPatternRotation={30} />

          <Text
            text="GIOC"
            x={WORD.x}
            y={WORD.cy - WORD.size / 2}
            fontSize={WORD.size}
            fontFamily={WORD_FONT}
            fontStyle="bold"
            letterSpacing={WORD.spacing}
            fill={BALL.ink}
            stroke="#ffffff"
            strokeWidth={6}
            fillAfterStrokeEnabled
          />
          <Lambda x={WORD.x + giocWidth()} top={capTop} height={capHeight} />

          {/* The size badge: a ring round a big 5, with the lettering arched
              above and below it and the weather marks underneath. */}
          <Circle x={305} y={350} radius={27} stroke={BALL.ink} strokeWidth={3} />
          <Text text="5" x={285} y={328} width={40} align="center" fontSize={44} fontFamily="Arial, sans-serif" fontStyle="bold" fill={BALL.ink} />
          <TextPath data="M 262 352 A 43 43 0 0 1 348 352" text="OFFICIAL SIZE" fontSize={12} fontFamily="Arial, sans-serif" align="center" letterSpacing={1} fill={BALL.ink} />
          <TextPath data="M 258 352 A 47 47 0 0 0 352 352" text="ALL WEATHER" fontSize={12} fontFamily="Arial, sans-serif" align="center" letterSpacing={1} fill={BALL.ink} />
          <Circle x={248} y={382} radius={4.5} stroke={BALL.ink} strokeWidth={1.4} />
          <Circle x={355} y={376} radius={4} fill={BALL.ink} />
          {[0, 60, 120].map((angle) => (
            <Line key={angle} x={302} y={410} points={[-5, 0, 5, 0]} rotation={angle} stroke={BALL.ink} strokeWidth={1.4} />
          ))}

          {/* Sphere shading over everything: a soft highlight toward the
              top, falling off to a darker rim. */}
          <Circle
            x={ART}
            y={ART}
            radius={ART}
            fillRadialGradientStartPoint={{ x: -70, y: -100 }}
            fillRadialGradientStartRadius={0}
            fillRadialGradientEndPoint={{ x: 0, y: 0 }}
            fillRadialGradientEndRadius={ART}
            fillRadialGradientColorStops={[0, 'rgba(255,255,255,0.45)', 0.4, 'rgba(255,255,255,0)', 0.78, 'rgba(0,0,0,0.04)', 1, 'rgba(0,0,0,0.3)']}
          />
        </Group>
      </Group>
      <Circle radius={radius} stroke="rgba(0,0,0,0.3)" strokeWidth={Math.max(0.5, radius * 0.04)} listening={false} />
    </>
  )
}
