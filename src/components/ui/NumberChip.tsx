// Small numbered badge (01, 02, ...) used anywhere a list is ordered and
// worth calling out visually — drill phases, attached session drills —
// instead of plain "N." text.
export function NumberChip({ index }: { index: number }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-white">
      {String(index).padStart(2, '0')}
    </span>
  )
}
