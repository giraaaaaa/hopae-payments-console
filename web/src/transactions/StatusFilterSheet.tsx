import { useEffect } from 'react'
import type { TxStatus } from '../api/transactions'
import { formatCount } from '../lib/format'

export interface StatusOption {
  label: string
  value: TxStatus | undefined
}

interface Props {
  open: boolean
  options: StatusOption[]
  current: TxStatus | undefined
  summary?: Record<'total' | TxStatus, number>
  onSelect: (value: TxStatus | undefined) => void
  onClose: () => void
}

/**
 * Mobile-only status filter as a bottom sheet (the native mobile idiom for a
 * small closed set of options): full-width touch rows with live counts and a
 * check on the current choice. Desktop keeps the underline tabs instead.
 */
export function StatusFilterSheet({ open, options, current, summary, onSelect, onClose }: Props) {
  // Escape closes; body scroll locks while the sheet is up.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filter by status"
      className="fixed inset-0 z-40 flex items-end sm:hidden"
    >
      <div className="sheet-backdrop absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="sheet-panel relative w-full rounded-t-2xl bg-white pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-xl">
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-slate-200" />
        <p className="px-5 pb-2 pt-3 text-sm font-semibold text-slate-900">Filter by status</p>
        <ul>
          {options.map((option) => {
            const count =
              option.value === undefined ? summary?.total : summary?.[option.value]
            const active = current === option.value
            return (
              <li key={option.label}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(option.value)
                    onClose()
                  }}
                  className={`flex w-full items-center justify-between px-5 py-3.5 text-sm transition-colors ${
                    active ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-700'
                  }`}
                >
                  {option.label}
                  <span className="flex items-center gap-2.5 text-slate-500">
                    {count !== undefined && (
                      <span className="text-xs tabular-nums" title={count.toLocaleString('en-US')}>
                        {formatCount(count)}
                      </span>
                    )}
                    {active && (
                      <svg
                        aria-hidden
                        viewBox="0 0 24 24"
                        className="h-4 w-4 text-slate-900"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
