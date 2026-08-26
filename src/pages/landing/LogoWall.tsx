// PLACEHOLDER — private mockup only. Real club names as styled TEXT
// wordmarks (no crest artwork — never reproduce club crests). Replace with
// real customers before any genuine marketing use.
const CLUBS = [
  'Arsenal',
  'FC Barcelona',
  'Manchester City',
  'Borussia Dortmund',
  'Ajax',
  'Inter',
  'Olympique Lyonnais',
  'Celtic',
]

export function LogoWall() {
  const row = [...CLUBS, ...CLUBS] // doubled for a seamless -50% loop
  return (
    <section aria-label="Clubs using Gaffer" className="border-y border-line py-10">
      <p className="mb-6 text-center text-xs font-medium uppercase tracking-widest text-ink-faint">
        Trusted on touchlines everywhere
      </p>
      <div
        className="overflow-hidden"
        style={{ maskImage: 'linear-gradient(to right, transparent, black 15%, black 85%, transparent)' }}
      >
        <div
          className="flex w-max items-center gap-14 pr-14"
          style={{ animation: 'landing-marquee 36s linear infinite' }}
        >
          {row.map((club, i) => (
            <span
              key={`${club}-${i}`}
              aria-hidden={i >= CLUBS.length}
              className="whitespace-nowrap text-lg font-semibold tracking-tight text-ink-faint transition-colors hover:text-ink-muted"
            >
              {club}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
