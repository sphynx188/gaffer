// `gifenc` ships no TypeScript declarations, so this is the minimum surface
// this app actually calls (see components/design/export/recordGif.ts). Kept
// deliberately narrow rather than transcribing the whole library: a wider
// hand-written declaration is a wider chance of describing the runtime wrongly
// with nothing checking the claim.
declare module 'gifenc' {
  export interface GifFrameOptions {
    palette?: number[][]
    /** Hundredths-of-a-second granularity in the GIF format, given in ms. */
    delay?: number
    transparent?: boolean
    dispose?: number
  }

  export interface GifEncoderInstance {
    writeFrame(index: Uint8Array, width: number, height: number, options?: GifFrameOptions): void
    finish(): void
    // Backed by a plain ArrayBuffer (the library allocates its own), stated
    // explicitly so the result can go straight into a Blob — a bare
    // `Uint8Array` widens to ArrayBufferLike, which BlobPart won't take.
    bytes(): Uint8Array<ArrayBuffer>
    bytesView(): Uint8Array<ArrayBuffer>
    reset(): void
  }

  export function GIFEncoder(options?: { auto?: boolean; initialCapacity?: number }): GifEncoderInstance

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: 'rgb565' | 'rgb444' | 'rgba4444'; oneBitAlpha?: boolean; clearAlpha?: boolean }
  ): number[][]

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: 'rgb565' | 'rgb444' | 'rgba4444'
  ): Uint8Array
}
