import { createContext, useCallback, useContext, useRef, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  title: string
  detail?: string
}

type PushToast = (kind: ToastKind, title: string, detail?: string) => void

const ToastContext = createContext<PushToast | null>(null)

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  error: 'border-red-300 bg-red-50 text-red-900',
  info: 'border-slate-300 bg-white text-slate-800',
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const push = useCallback<PushToast>((kind, title, detail) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, kind, title, detail }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-20 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 md:bottom-4"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-lg border px-4 py-3 shadow-lg ${KIND_STYLES[toast.kind]}`}
          >
            <p className="text-sm font-semibold">{toast.title}</p>
            {toast.detail && <p className="mt-0.5 text-xs opacity-80">{toast.detail}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): PushToast {
  const push = useContext(ToastContext)
  if (!push) throw new Error('useToast must be used within ToastProvider')
  return push
}
