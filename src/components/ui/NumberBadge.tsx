// A plain stat treatment — a large tracked-tight numeral over a small
// muted caption, in the same single type voice as everything else
// (newdesign.md drops mono/display-face switching in favor of weight/size
// hierarchy within one family). Used anywhere a plain count is the point
// (roster size, upcoming sessions, drills in library) — see
// TeamOverviewPage.tsx.
export function NumberBadge({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-3xl font-semibold tracking-tight text-accent-ink">{value}</p>
      <p className="text-xs text-ink-muted">{label}</p>
    </div>
  )
}
