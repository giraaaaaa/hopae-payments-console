import type { TxStatus } from '../api/transactions'

const STYLES: Record<TxStatus, { badge: string; dot: string; label: string }> = {
  succeeded: {
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Succeeded',
  },
  pending: {
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    dot: 'bg-amber-500 animate-pulse',
    label: 'Pending',
  },
  failed: {
    badge: 'border-red-200 bg-red-50 text-red-700',
    dot: 'bg-red-500',
    label: 'Failed',
  },
  refunded: {
    badge: 'border-slate-200 bg-slate-100 text-slate-600',
    dot: 'bg-slate-400',
    label: 'Refunded',
  },
}

export function StatusBadge({ status, title }: { status: TxStatus; title?: string }) {
  const style = STYLES[status]
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.badge}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}
