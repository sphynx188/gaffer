import { createContext, useContext } from 'react'

// Brief confirmation that a placement or deletion landed (rework plan Stage
// 5.5). Deliberately not in the Zustand store: a toast is transient UI with no
// bearing on a drill, and every subscriber to that store would re-render each
// time one appeared and disappeared.
export type ShowToast = (message: string) => void

export const ToastContext = createContext<ShowToast>(() => {})

export function useToast(): ShowToast {
  return useContext(ToastContext)
}
