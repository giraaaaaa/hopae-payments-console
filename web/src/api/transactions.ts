import { request } from './client'
import type { Currency } from '../lib/money'

export const ENVS = ['sandbox', 'production'] as const
export type Env = (typeof ENVS)[number]

export function isEnv(value: unknown): value is Env {
  return value === 'sandbox' || value === 'production'
}

export const STATUSES = ['succeeded', 'pending', 'failed', 'refunded'] as const
export type TxStatus = (typeof STATUSES)[number]

/** Row shape returned by GET /api/transactions (see mock-server/routes/transactions.ts). */
export interface TransactionRow {
  id: string
  amount: number
  currency: Currency
  status: TxStatus
  customer: { name: string; email: string }
  payment_method: { brand: 'visa' | 'mastercard' | 'amex'; last4: string }
  created_at: string
  failure_reason?: string
  refunded_at?: string
}

export interface ListResponse {
  data: TransactionRow[]
  page_info: { next_cursor: string | null; has_more: boolean; limit: number }
  /** Cursor of the newest returned item — pass back as `max` to freeze the window. */
  window_max: string | null
  /** Counts within env + search (status filter NOT applied) for the filter tabs. */
  summary: Record<'total' | TxStatus, number>
}

export interface ListFilters {
  env: Env
  status?: TxStatus
  q?: string
}

export interface ListPageParams extends ListFilters {
  limit?: number
  cursor?: string
  max?: string
  since?: string
}

export function listTransactions(
  params: ListPageParams,
  signal?: AbortSignal,
): Promise<ListResponse> {
  const search = new URLSearchParams({ env: params.env })
  if (params.status) search.set('status', params.status)
  if (params.q) search.set('q', params.q)
  if (params.limit) search.set('limit', String(params.limit))
  if (params.cursor) search.set('cursor', params.cursor)
  if (params.max) search.set('max', params.max)
  if (params.since) search.set('since', params.since)
  return request<ListResponse>(`/api/transactions?${search}`, { signal })
}

export function refundTransaction(id: string, env: Env): Promise<{ transaction: TransactionRow }> {
  return request<{ transaction: TransactionRow }>(
    `/api/transactions/${encodeURIComponent(id)}/refund`,
    { method: 'POST', body: { env } },
  )
}
