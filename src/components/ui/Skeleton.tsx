// Loading placeholder bar — the visual stand-in for content that hasn't
// arrived yet, replacing the plain "Loading…" text line the app showed
// everywhere before. The caller sizes it via `className`, so each list can
// mirror the shape of the real row it stands in for; a skeleton that
// matches the eventual layout reads as "your content is coming" rather
// than the vaguer "something is happening" a centred spinner gives.
//
// design.md rules out drop shadows on chrome, so this is a flat filled
// bar. `bg-line` rather than a raw gray so it flips correctly under
// [data-theme="light"], and Tailwind's built-in `animate-pulse` — core in
// v4, so no plugin and no custom keyframes.
//
// ACCESSIBILITY CONTRACT — read before using this at a new call site.
// The bars are aria-hidden, since a screen reader announcing a dozen empty
// divs is pure noise. But the visible "Loading…" text these replace WAS
// being announced, so the announcement has to survive somewhere else:
// every call site puts `aria-busy="true"` on the container that holds the
// skeletons and gives it an `sr-only` "Loading…" label. Dropping skeletons
// in without that trades a working screen-reader experience for a prettier
// visual one, which isn't a trade worth making.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line ${className}`} aria-hidden="true" />
}
