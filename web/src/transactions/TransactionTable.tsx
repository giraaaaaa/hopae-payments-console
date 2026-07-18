import { useEffect, useRef, useState } from 'react'
import type { TransactionRow } from '../api/transactions'
import { formatAmount } from '../lib/money'
import { formatAbsoluteTime, formatRelativeTime, formatShortDateTime } from '../lib/time'
import { StatusBadge } from './StatusBadge'

interface Props {
  rows: TransactionRow[]
  now: Date
  onRefund: (row: TransactionRow) => void
  /** Changes when env/filter/search change — resets flash tracking so a
   *  wholesale list swap doesn't light up every row. */
  resetKey: string
  /** False while rows are carried-over placeholder data from a previous
   *  filter; comparing against those would mis-flag everything as new. */
  ready: boolean
}

const FAILURE_LABELS: Record<string, string> = {
  card_declined: 'Card declined',
  insufficient_funds: 'Insufficient funds',
  expired_card: 'Expired card',
  authentication_required: 'Authentication required',
}

/**
 * Tracks which rows just appeared or changed status and flashes them, so
 * background updates are noticeable without being disruptive.
 */
function useRowFlashes(rows: TransactionRow[], resetKey: string, ready: boolean): Set<string> {
  const seen = useRef<Map<string, TransactionRow['status']> | null>(null)
  const [flashed, setFlashed] = useState<Set<string>>(new Set())

  // Declared BEFORE the compare effect so a filter change re-baselines first.
  useEffect(() => {
    seen.current = null
    setFlashed(new Set())
  }, [resetKey])

  useEffect(() => {
    // Placeholder rows belong to the previous filter — don't baseline or
    // compare against them, or the real data will mis-flash as "all new".
    if (!ready) return
    if (seen.current === null) {
      // First real data for this filter: baseline silently.
      seen.current = new Map(rows.map((r) => [r.id, r.status]))
      return
    }
    const prev = seen.current
    const changed = rows
      .filter((r) => prev.get(r.id) !== undefined && prev.get(r.id) !== r.status)
      .map((r) => r.id)
    const added = rows.filter((r) => !prev.has(r.id)).map((r) => r.id)
    for (const r of rows) prev.set(r.id, r.status)

    const ids = [...changed, ...added]
    if (ids.length === 0) return
    setFlashed((old) => new Set([...old, ...ids]))
    const timer = setTimeout(() => {
      setFlashed((old) => {
        const next = new Set(old)
        for (const id of ids) next.delete(id)
        return next
      })
    }, 1700)
    return () => clearTimeout(timer)
  }, [rows, ready])

  return flashed
}

export function TransactionTable({ rows, now, onRefund, resetKey, ready }: Props) {
  const flashed = useRowFlashes(rows, resetKey, ready)

  return (
    // min-w keeps columns readable on small screens — the wrapper provides
    // horizontal scroll instead of letting cells crush into each other.
    <table className="w-full min-w-[880px] table-fixed text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <th className="w-[19%] px-4 py-3">Transaction</th>
          <th className="w-[14%] px-4 py-3">Amount</th>
          <th className="w-[12%] px-4 py-3">Status</th>
          <th className="w-[22%] px-4 py-3">Customer</th>
          <th className="w-[13%] px-4 py-3">Payment</th>
          <th className="w-[12%] px-4 py-3">Created</th>
          <th className="w-[8%] px-4 py-3 text-right">
            <span className="sr-only">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.id}
            className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${
              flashed.has(row.id) ? 'row-flash' : ''
            }`}
          >
            <td className="truncate px-4 py-3 font-mono text-xs text-slate-700" title={row.id}>
              {row.id}
            </td>
            <td className="px-4 py-3">
              <span className="font-medium tabular-nums text-slate-900">
                {formatAmount(row.amount, row.currency)}
              </span>{' '}
              <span className="text-xs uppercase text-slate-500">{row.currency}</span>
            </td>
            <td className="px-4 py-3">
              <StatusBadge status={row.status} />
              {row.status === 'failed' && row.failure_reason && (
                <p className="mt-1 text-xs text-red-600">
                  {FAILURE_LABELS[row.failure_reason] ?? row.failure_reason}
                </p>
              )}
              {row.status === 'refunded' && row.refunded_at && (
                <p className="mt-1 text-xs text-slate-500" title={formatAbsoluteTime(row.refunded_at)}>
                  {formatRelativeTime(row.refunded_at, now)}
                </p>
              )}
            </td>
            <td className="px-4 py-3">
              <p className="truncate font-medium text-slate-800">{row.customer.name}</p>
              <p className="truncate text-xs text-slate-500">{row.customer.email}</p>
            </td>
            <td className="px-4 py-3 text-xs text-slate-500">
              <span className="capitalize">{row.payment_method.brand}</span>{' '}
              <span className="font-mono">•••• {row.payment_method.last4}</span>
            </td>
            <td className="px-4 py-3" title={formatAbsoluteTime(row.created_at)}>
              <p className="whitespace-nowrap text-xs text-slate-600">
                {formatRelativeTime(row.created_at, now)}
              </p>
              <p className="mt-0.5 whitespace-nowrap text-xs text-slate-500">
                {formatShortDateTime(row.created_at, now)}
              </p>
            </td>
            <td className="px-4 py-3 text-right">
              {row.status === 'succeeded' && (
                <button
                  type="button"
                  onClick={() => onRefund(row)}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Refund
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
