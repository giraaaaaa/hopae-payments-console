import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  refundTransaction,
  type Env,
  type TransactionRow,
} from '../api/transactions'
import { ApiError } from '../api/client'
import { formatAmount } from '../lib/money'
import { useToast } from '../components/Toast'
import { StatusBadge } from './StatusBadge'
import { patchTransactionInLists } from './useTransactionList'

interface Props {
  row: TransactionRow
  env: Env
  onClose: () => void
}

/**
 * Refund confirmation. Sandbox: one click — it's test money. Production: the
 * user must also tick an explicit acknowledgement, because a real customer
 * gets real money back and it can't be undone.
 *
 * If the row was refunded elsewhere while the dialog is open, the server
 * answers 409 with the current state; we patch the cache and tell the user
 * instead of pretending the click worked.
 */
export function RefundDialog({ row, env, onClose }: Props) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [acknowledged, setAcknowledged] = useState(false)
  const dialogRef = useRef<HTMLDivElement>(null)

  const isProduction = env === 'production'
  const amountLabel = `${formatAmount(row.amount, row.currency)} ${row.currency.toUpperCase()}`

  const mutation = useMutation({
    mutationFn: () => refundTransaction(row.id, env),
    onSuccess: ({ transaction }) => {
      patchTransactionInLists(queryClient, env, transaction)
      queryClient.invalidateQueries({ queryKey: ['transactions', env] })
      toast('success', `Refunded ${amountLabel}`, `${row.id} · ${row.customer.name}`)
      onClose()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        const payload = err.payload as { transaction?: TransactionRow } | null
        if (payload?.transaction) {
          patchTransactionInLists(queryClient, env, payload.transaction)
          queryClient.invalidateQueries({ queryKey: ['transactions', env] })
        }
        toast(
          'info',
          err.code === 'already_refunded'
            ? 'Already refunded'
            : 'Transaction can no longer be refunded',
          'The row has been updated to its current state.',
        )
        onClose()
        return
      }
      toast('error', 'Refund failed', err instanceof Error ? err.message : 'Unknown error')
    },
  })

  // Focus the dialog and close on Escape.
  useEffect(() => {
    dialogRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const canConfirm = !mutation.isPending && (!isProduction || acknowledged)

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl outline-none"
      >
        <h2 id="refund-title" className="text-lg font-semibold text-slate-900">
          Refund this payment?
        </h2>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-xs text-slate-500">{row.id}</span>
            <StatusBadge status={row.status} />
          </div>
          <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">{amountLabel}</p>
          <p className="mt-1 text-xs text-slate-500">
            {row.customer.name} · {row.customer.email}
          </p>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          The full amount goes back to the customer&rsquo;s{' '}
          <span className="capitalize">{row.payment_method.brand}</span> ••••{' '}
          {row.payment_method.last4}. This can&rsquo;t be undone.
        </p>

        {isProduction ? (
          <label className="mt-4 flex cursor-pointer items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I understand this refunds <strong>real money</strong> to a live customer in{' '}
              <strong>Production</strong>.
            </span>
          </label>
        ) : (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Sandbox refund — test data only, no real money moves.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!canConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? 'Refunding…' : `Refund ${amountLabel}`}
          </button>
        </div>
      </div>
    </div>
  )
}
