import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from './useToast'

// How long a message stays up. Long enough to read "Player added" without
// looking for it, short enough not to sit over the pitch.
const DISMISS_MS = 2400

interface ToastMessage {
  id: number
  text: string
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([])
  const nextId = useRef(0)
  const timers = useRef<number[]>([])

  const show = useCallback((text: string) => {
    const id = nextId.current++
    setMessages((current) => [...current, { id, text }])
    timers.current.push(
      window.setTimeout(() => setMessages((current) => current.filter((m) => m.id !== id)), DISMISS_MS)
    )
  }, [])

  // A drill editor that unmounts mid-toast shouldn't leave timers running
  // against a dead component.
  useEffect(() => {
    const pending = timers.current
    return () => {
      for (const timer of pending) window.clearTimeout(timer)
    }
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {/* Above the mobile dock so a confirmation never lands underneath the
          control that triggered it. `pointer-events-none` so it can't swallow
          a tap meant for the pitch. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-1.5 px-4 lg:bottom-6"
        role="status"
        aria-live="polite"
      >
        {messages.map((message) => (
          <span
            key={message.id}
            className="rounded-full border border-line bg-panel-raised px-3 py-1.5 text-xs font-medium text-ink"
          >
            {message.text}
          </span>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
