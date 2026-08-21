// The touchline redesign's signature stat treatment — a tabular-mono
// numeral over an uppercase display-face label, styled after the handheld
// substitution boards held up on the touchline, rather than a generic
// icon-plus-number pattern. Used anywhere a plain count is the point (roster
// size, upcoming sessions, drills in library) — see TeamOverviewPage.tsx.
export function NumberBadge({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-mono text-3xl font-semibold tabular-nums text-accent">{value}</p>
      <p className="font-display text-xs tracking-wide text-ink-muted uppercase">{label}</p>
    </div>
  )
}
