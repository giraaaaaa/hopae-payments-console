import { useCallback, useEffect, useRef, useState } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import {
  STATUSES,
  type Env,
  type TransactionRow,
  type TxStatus,
} from '../api/transactions'
import { formatCount } from '../lib/format'
import { useDebouncedValue, useNow } from '../lib/hooks'
import { useTransactionList } from './useTransactionList'
import { TransactionTable } from './TransactionTable'
import { RefundDialog } from './RefundDialog'
import { StatusFilterSheet } from './StatusFilterSheet'

function isStatus(value: string | null): value is TxStatus {
  return STATUSES.includes(value as TxStatus)
}

export default function TransactionsPage() {
  const { env } = useOutletContext<{ env: Env }>()
  const [searchParams, setSearchParams] = useSearchParams()

  // Filters live in the URL (shareable / reload-safe); the search box keeps
  // local state and syncs to the URL debounced.
  const statusParam = searchParams.get('status')
  const status = isStatus(statusParam) ? statusParam : undefined
  const urlQuery = searchParams.get('q') ?? ''
  const [searchInput, setSearchInput] = useState(urlQuery)
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300)

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (debouncedSearch) next.set('q', debouncedSearch)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  }, [debouncedSearch, setSearchParams])

  // Environment switch: clear the search box along with the env-specific data.
  useEffect(() => {
    setSearchInput('')
  }, [env])

  const list = useTransactionList({ env, status, q: debouncedSearch || undefined })
  const now = useNow()
  const [refundTarget, setRefundTarget] = useState<TransactionRow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  function setStatusFilter(next: TxStatus | undefined) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next) params.set('status', next)
      else params.delete('status')
      return params
    })
  }

  const hasFilters = Boolean(status || debouncedSearch)
  const shownTotal = status ? (list.summary?.[status] ?? 0) : (list.summary?.total ?? 0)

  // Keep the dialog bound to the freshest copy of the row the cache has.
  const liveRefundTarget =
    refundTarget && (list.rows.find((r) => r.id === refundTarget.id) ?? refundTarget)

  const tabs: Array<{ label: string; value: TxStatus | undefined }> = [
    { label: 'All', value: undefined },
    ...STATUSES.map((s) => ({ label: s[0].toUpperCase() + s.slice(1), value: s as TxStatus })),
  ]

  // The tab row scrolls horizontally on narrow screens with its scrollbar
  // hidden — edge fades are the "there's more" affordance, toggled by the
  // actual scroll position so a fully-scrolled edge shows no fade.
  const tabsRef = useRef<HTMLDivElement>(null)
  const [tabsFade, setTabsFade] = useState({ left: false, right: false })
  const updateTabsFade = useCallback(() => {
    const el = tabsRef.current
    if (!el) return
    setTabsFade({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    })
  }, [])
  useEffect(() => {
    updateTabsFade()
    const el = tabsRef.current
    el?.addEventListener('scroll', updateTabsFade, { passive: true })
    window.addEventListener('resize', updateTabsFade)
    return () => {
      el?.removeEventListener('scroll', updateTabsFade)
      window.removeEventListener('resize', updateTabsFade)
    }
    // Re-measure when counts change width (e.g. 999 → 1K).
  }, [updateTabsFade, list.summary])

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-2xl font-bold text-slate-900">Transactions</h1>
        <span className="text-xs text-slate-500" aria-live="polite">
          {list.isRefreshing ? 'Refreshing…' : 'Auto-updates every few seconds'}
        </span>
      </div>

      {/* Mobile: one-line filter trigger + result count; the options live in a
          bottom sheet (StatusFilterSheet). Desktop keeps underline tabs. */}
      <div className="mt-5 flex items-center justify-between gap-3 sm:hidden">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
        >
          Status: {tabs.find((t) => t.value === status)?.label ?? 'All'}
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5 text-slate-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <span className="text-xs tabular-nums text-slate-500">
          {shownTotal.toLocaleString('en-US')} results
        </span>
      </div>

      {/* Status tabs — quiet underline style, roomy spacing (sm and up) */}
      <div className="relative mt-6 hidden sm:block">
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Filter by status"
          className="flex items-center gap-5 overflow-x-auto whitespace-nowrap border-b border-slate-200 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-7 [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab) => {
            const active = status === tab.value
            const count =
              tab.value === undefined ? list.summary?.total : list.summary?.[tab.value]
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatusFilter(tab.value)}
                className={`-mb-px flex items-baseline gap-2 border-b-2 pb-3 pt-1 text-sm transition-colors ${
                  active
                    ? 'border-slate-900 font-semibold text-slate-900'
                    : 'border-transparent font-medium text-slate-500 hover:border-slate-300 hover:text-slate-800'
                }`}
              >
                {tab.label}
                {count !== undefined && (
                  <span className="text-xs tabular-nums text-slate-500" title={count.toLocaleString('en-US')}>
                    {formatCount(count)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {tabsFade.left && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-slate-50 to-transparent"
          />
        )}
        {tabsFade.right && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-slate-50 to-transparent"
          />
        )}
      </div>

      {/* Search */}
      <div className="mt-4">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by transaction ID or customer email"
          aria-label="Search transactions"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:w-80"
        />
      </div>

      {/* New-items pill — the list never shifts on its own, so this is the
          only signal that new rows exist. It's sticky (floats at the top of
          the viewport as you scroll) so it stays reachable even far down a
          long list, not just when scrolled to the top. */}
      {list.newCount > 0 && (
        <div className="pointer-events-none sticky top-3 z-20 mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => {
              list.showNewItems()
              window.scrollTo({ top: 0, behavior: 'smooth' })
            }}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            {list.newCountLabel} new transaction{list.newCount === 1 ? '' : 's'}
          </button>
        </div>
      )}

      {/* Refresh failure with data on screen: keep the rows (stale beats
          blank), announce the problem, and let the poll self-heal. The full
          error screen below is reserved for "no data at all". */}
      {list.isError && list.rows.length > 0 && (
        <div
          role="status"
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800"
        >
          Can&rsquo;t reach the server — showing the last loaded data. Retrying automatically…
        </div>
      )}

      {/* List */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {list.isPending ? (
          <SkeletonRows />
        ) : list.isError && list.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">Couldn&rsquo;t load transactions</p>
            <p className="mt-1 text-sm text-slate-500">
              {list.error instanceof Error ? list.error.message : 'Unknown error'}
            </p>
            <button
              type="button"
              onClick={() => list.refetch()}
              className="mt-4 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Try again
            </button>
          </div>
        ) : list.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            {hasFilters ? (
              <>
                <p className="text-sm font-semibold text-slate-800">No matching transactions</p>
                <p className="mt-1 text-sm text-slate-500">
                  Nothing matches the current filter{debouncedSearch ? ` and “${debouncedSearch}”` : ''}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput('')
                    setStatusFilter(undefined)
                  }}
                  className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-800">
                  No transactions yet in <span className="capitalize">{env}</span>.
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {env === 'sandbox'
                    ? 'Make a test charge to see data here.'
                    : 'Live payments will appear here as they happen.'}
                </p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Dim carried-over rows while the new filter's data loads. */}
            <div className={`overflow-x-auto transition-opacity ${list.isPlaceholder ? 'opacity-60' : ''}`}>
              <TransactionTable
                rows={list.rows}
                now={now}
                onRefund={setRefundTarget}
                resetKey={`${env}|${status ?? ''}|${debouncedSearch}`}
                ready={!list.isPlaceholder}
              />
            </div>
            {/* Stacks on mobile with a full-width, easy-to-tap Load more. */}
            <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-slate-500 tabular-nums">
                Showing {list.rows.length} of {shownTotal}
              </span>
              {list.hasNextPage && (
                <button
                  type="button"
                  onClick={() => list.fetchNextPage()}
                  disabled={list.isFetchingNextPage}
                  className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:w-auto sm:py-1.5"
                >
                  {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {liveRefundTarget && (
        <RefundDialog
          row={liveRefundTarget}
          env={env}
          onClose={() => setRefundTarget(null)}
        />
      )}

      <StatusFilterSheet
        open={sheetOpen}
        options={tabs}
        current={status}
        summary={list.summary}
        onSelect={setStatusFilter}
        onClose={() => setSheetOpen(false)}
      />
    </main>
  )
}

function SkeletonRows() {
  return (
    <div className="animate-pulse divide-y divide-slate-100 px-4" aria-label="Loading transactions">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-6 py-4">
          <div className="h-3 w-32 rounded bg-slate-200" />
          <div className="h-3 w-16 rounded bg-slate-200" />
          <div className="h-5 w-20 rounded-full bg-slate-200" />
          <div className="h-3 flex-1 rounded bg-slate-100" />
          <div className="h-3 w-16 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  )
}
