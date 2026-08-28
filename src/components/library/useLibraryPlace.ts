import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

const PARAM = 'place'

// Which place the Library is showing, kept in the URL rather than component
// state (2026-08-28) — a location you can navigate to is one you can also
// go BACK from, link to, and reload into. Both tabs read the same param but
// live on different paths (/library/drills vs /library/tactics), so
// switching tabs starts each at its own root rather than carrying a
// collection id that means nothing in the other tab.
//
// `defaultPlaceId` is the root, which differs by role (see rootPlaceId): an
// admin lands on "All", a coach on their own folder. Standing on it leaves
// the param off, so the tab's plain URL always means "the root, whoever you
// are" rather than baking one role's answer into a link.
export function useLibraryPlace(defaultPlaceId: string) {
  const [params, setParams] = useSearchParams()
  const placeId = params.get(PARAM) ?? defaultPlaceId

  const setPlaceId = useCallback(
    (next: string) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          if (next === defaultPlaceId) updated.delete(PARAM)
          else updated.set(PARAM, next)
          return updated
        },
        // A real history entry, not a replace: moving into a collection is a
        // navigation, and the browser/Android back gesture should undo it.
        { replace: false }
      )
    },
    [setParams, defaultPlaceId]
  )

  return { placeId, setPlaceId }
}
