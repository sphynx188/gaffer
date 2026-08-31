import { useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { ChevronDown, Folder, FolderPlus, LibraryBig, Lock, User, Users } from 'lucide-react'
import type { LibraryPlace } from './libraryPlaces'
import { RowMenu, type RowMenuItem } from './RowMenu'

// Section collapse (2026-08-31) — same persistence shape as useLibraryView:
// a plain localStorage-backed record, not lifted into the store, since it's
// a per-visitor display preference rather than club data. Keyed by section
// KIND rather than place id, since "Collections" is the durable thing being
// shown/hidden across reloads, not any one collection inside it. The root
// row (All/My drills) has no header to collapse — it isn't a category, it's
// the two fixed entry points every other section hangs off — so it stays
// out of this record entirely rather than getting a no-op toggle.
type SectionKind = 'collections' | 'licensed' | 'coaches'
const COLLAPSE_STORAGE_KEY = 'gaffer-library-sidebar-collapsed'
const DEFAULT_COLLAPSED: Record<SectionKind, boolean> = { collections: false, licensed: false, coaches: false }

function readStoredCollapsed(): Record<SectionKind, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    return raw ? { ...DEFAULT_COLLAPSED, ...JSON.parse(raw) } : DEFAULT_COLLAPSED
  } catch {
    return DEFAULT_COLLAPSED
  }
}

// The Library's places rail — the map that makes "where am I" answerable
// (2026-08-28). This is what the old stacked, collapsible LibraryGroups
// sections became: the same My/collection/licensed/coach split, but as
// destinations in a sidebar instead of headings in one long scroll.
//
// Counts are of the whole place, not of what's currently listed: a search
// narrows the view inside a place, and a folder that says "12" while showing
// 2 results is telling the truth about the folder. The toolbar is where the
// narrowed count is reported.
const PLACE_ICONS: Record<LibraryPlace['kind'], ComponentType<{ className?: string }>> = {
  all: LibraryBig,
  mine: User,
  collection: Folder,
  licensed: Lock,
  coach: Users,
}

function PlaceRow({
  place,
  active,
  onSelect,
  menu,
}: {
  place: LibraryPlace
  active: boolean
  onSelect: () => void
  menu?: RowMenuItem[]
}) {
  const Icon = PLACE_ICONS[place.kind]
  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={
          'flex w-full items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-left text-sm transition-colors ' +
          (active ? 'bg-accent/15 font-medium text-accent-ink' : 'text-ink-muted hover:bg-panel-raised hover:text-ink')
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate" title={place.title}>
          {place.title}
        </span>
        <span className={`shrink-0 text-xs tabular-nums ${active ? 'text-accent-ink' : 'text-ink-faint'}`}>
          {place.ids.length}
        </span>
      </button>
      {/* Centred with flex rather than `-translate-y-1/2` — see RowMenu on
          why a transform here is the wrong tool next to a fixed popover. */}
      {menu && menu.length > 0 && (
        <span className="absolute inset-y-0 right-1 flex items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <RowMenu items={menu} label={`Actions for ${place.title}`} />
        </span>
      )}
    </li>
  )
}

// Plain text when there's nothing to collapse (an `action` with no toggle,
// e.g. Collections while empty — the "None yet" line below it is one line
// already, collapsing it would save nothing) — a button with a chevron
// otherwise. Kept as one component rather than two so every section header
// still looks identical at rest; only the interactive affordance differs.
function SectionLabel({
  children,
  action,
  collapsed,
  onToggle,
  controls,
}: {
  children: string
  action?: ReactNode
  collapsed?: boolean
  onToggle?: () => void
  controls?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-4">
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls={controls}
          className="flex min-w-0 items-center gap-1 rounded text-xs font-semibold uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-muted"
        >
          <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
          {children}
        </button>
      ) : (
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{children}</span>
      )}
      {action}
    </div>
  )
}

export function LibrarySidebar({
  places,
  activePlaceId,
  onSelectPlace,
  isAdmin,
  onNewCollection,
  collectionMenu,
}: {
  places: LibraryPlace[]
  activePlaceId: string
  onSelectPlace: (placeId: string) => void
  isAdmin: boolean
  onNewCollection: () => void
  /** Per-collection actions (rename / access / delete) — admin only. */
  collectionMenu: (collectionId: string) => RowMenuItem[]
}) {
  const roots = places.filter((p) => p.kind === 'all' || p.kind === 'mine')
  const collections = places.filter((p) => p.kind === 'collection')
  const licensed = places.filter((p) => p.kind === 'licensed')
  const coaches = places.filter((p) => p.kind === 'coach')

  const [collapsed, setCollapsed] = useState(readStoredCollapsed)
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapsed))
    } catch {
      // Private-browsing/embedded contexts can throw — collapsing still
      // works for the session, it just won't survive a reload.
    }
  }, [collapsed])
  const toggle = (kind: SectionKind) => setCollapsed((c) => ({ ...c, [kind]: !c[kind] }))

  const row = (place: LibraryPlace, menu?: RowMenuItem[]) => (
    <PlaceRow
      key={place.id}
      place={place}
      active={place.id === activePlaceId}
      onSelect={() => onSelectPlace(place.id)}
      menu={menu}
    />
  )

  return (
    <div className="pb-4">
      <ul className="space-y-0.5">{roots.map((place) => row(place))}</ul>

      <SectionLabel
        collapsed={collections.length > 0 ? collapsed.collections : undefined}
        onToggle={collections.length > 0 ? () => toggle('collections') : undefined}
        controls="library-section-collections"
        action={
          isAdmin ? (
            <button
              type="button"
              onClick={onNewCollection}
              aria-label="New collection"
              title="New collection"
              className="rounded p-1 text-ink-muted transition-colors hover:bg-panel-raised hover:text-ink"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          ) : undefined
        }
      >
        Collections
      </SectionLabel>
      {collections.length > 0 ? (
        !collapsed.collections && (
          <ul id="library-section-collections" className="space-y-0.5">
            {collections.map((place) => row(place, isAdmin ? collectionMenu(place.collectionId ?? '') : undefined))}
          </ul>
        )
      ) : (
        <p className="px-2 py-1 text-xs text-ink-faint">
          {isAdmin ? 'None yet — use the + above.' : 'None yet.'}
        </p>
      )}

      {licensed.length > 0 && (
        <>
          {/* Licensed-in collections belong to the club that granted them:
              read-only here, and never mixed in with our own folders — the
              old flat list only distinguished them with a badge. */}
          <SectionLabel
            collapsed={collapsed.licensed}
            onToggle={() => toggle('licensed')}
            controls="library-section-licensed"
          >
            Licensed to us
          </SectionLabel>
          {!collapsed.licensed && (
            <ul id="library-section-licensed" className="space-y-0.5">
              {licensed.map((place) => row(place))}
            </ul>
          )}
        </>
      )}

      {coaches.length > 0 && (
        <>
          <SectionLabel
            collapsed={collapsed.coaches}
            onToggle={() => toggle('coaches')}
            controls="library-section-coaches"
          >
            Coaches
          </SectionLabel>
          {!collapsed.coaches && (
            <ul id="library-section-coaches" className="space-y-0.5">
              {coaches.map((place) => row(place))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
