import { useEffect, useRef, useState } from 'react'

// One IntersectionObserver per revealed element: flips `shown` once when the
// element first enters the viewport, then disconnects. Reduced-motion users
// start (and stay) shown — the reveal is decoration, not content gating —
// checked in the initializer rather than an effect so there's no
// setState-in-effect and no first frame where their content is hidden.
export function useReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null)
  const [shown, setShown] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const el = ref.current
    if (!el || shown) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold, shown])

  return { ref, shown }
}
