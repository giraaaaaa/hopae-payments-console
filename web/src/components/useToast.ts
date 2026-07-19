import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export type PushToast = (kind: ToastKind, title: string, detail?: string) => void

export const ToastContext = createContext<PushToast | null>(null)

export function useToast(): PushToast {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast must be used within ToastProvider')
  return push
}
