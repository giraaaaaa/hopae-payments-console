import { useEffect, useRef, useState } from 'react'
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import {
  listTransactions,
  type ListFilters,
  type ListResponse,
  type TransactionRow,
} from '../api/transactions'

export const PAGE_SIZE = 25
export const REFRESH_MS = 5000
const NEW_POLL_LIMIT = 25

/**
 * Near-realtime list strategy ("anchored window + new-items banner"):
 *
 * The server inserts new transactions at the top every few seconds. If we
 * simply refetched page 1, rows would shift under the user's cursor. Instead:
 *
 * 1. The first page load returns `window_max` — a cursor pointing at the
 *    newest visible item. We "anchor" the list there: every page (and every
 *    background refetch) is fetched with `max=anchor`, so the loaded window
 *    is IMMUTABLE with respect to inserts. Background refetches still pick up
 *    in-place changes (pending → succeeded/failed, refunds) without moving rows.
 * 2. A separate lightweight poll asks for items `since=anchor` (with the same
 *    filters). Its count feeds the "N new transactions" banner.
 * 3. Clicking the banner re-anchors: refetch from the top, new rows included —
 *    a user-initiated moment, so the list changing is expected, not jarring.
 */
export function useTransactionList(filters: ListFilters) {
  const queryClient = useQueryClient()
  const { env, status, q } = filters
  const filterKey = ['transactions', env, status ?? null, q ?? null] as const

  // null = "not anchored yet, fetch the latest head".
  const [anchor, setAnchor] = useState<string | null>(null)

  // Reset the anchor whenever the filters change (render-time state reset).
  const filterId = filterKey.join('|')
  const prevFilterId = useRef(filterId)
  if (prevFilterId.current !== filterId) {
    prevFilterId.current = filterId
    setAnchor(null)
  }

  const listQuery = useInfiniteQuery({
    queryKey: [...filterKey, anchor],
    queryFn: ({ pageParam, signal }) =>
      listTransactions(
        {
          env,
          status,
          q,
          limit: PAGE_SIZE,
          cursor: pageParam ?? undefined,
          max: anchor ?? undefined,
        },
        signal,
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.page_info.next_cursor,
    // Replays every loaded page; with `max` set the windows are stable, so
    // this only updates row contents (statuses) in place.
    refetchInterval: REFRESH_MS,
    // Keep refreshing while the window is unfocused: ops dashboards often sit
    // on a second monitor, and stale-looking payment data erodes trust.
    refetchIntervalInBackground: true,
    placeholderData: keepPreviousData,
  })

  // Pin the window as soon as we know where the head is. Seeding the anchored
  // cache with the data we already have makes the key switch render-identical.
  const listData = listQuery.data
  const windowMax = listData?.pages[0]?.window_max ?? null
  // Guard against placeholder data: right after showNewItems() the query
  // briefly shows the PREVIOUS window via keepPreviousData — anchoring to its
  // window_max would snap us straight back to the old anchor.
  const isPlaceholder = listQuery.isPlaceholderData
  useEffect(() => {
    if (anchor === null && windowMax && listData && !isPlaceholder) {
      queryClient.setQueryData<InfiniteData<ListResponse, string | null>>(
        [...filterKey, windowMax],
        listData as InfiniteData<ListResponse, string | null>,
      )
      setAnchor(windowMax)
    }
    // filterKey identity changes with its contents; filterId covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, windowMax, listData, isPlaceholder, filterId, queryClient])

  // Once anchored, drop the pre-anchor (null-key) snapshot. Without this,
  // revisiting a filter resurrects the head-of-list as it looked at initial
  // page load — counts and rows visibly jump backwards until the refetch lands.
  useEffect(() => {
    if (anchor !== null) {
      queryClient.removeQueries({ queryKey: [...filterKey, null], exact: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor, filterId, queryClient])

  // Poll for items newer than the anchor → feeds the banner.
  const newItemsQuery = useQuery({
    queryKey: ['transactions-new', env, status ?? null, q ?? null, anchor],
    enabled: anchor !== null,
    queryFn: ({ signal }) =>
      listTransactions({ env, status, q, since: anchor!, limit: NEW_POLL_LIMIT }, signal),
    refetchInterval: REFRESH_MS,
    refetchIntervalInBackground: true,
    // No placeholderData here: carrying the previous filter's result across a
    // key change would briefly show a stale "N new" banner.
  })

  const newCount = anchor !== null ? (newItemsQuery.data?.data.length ?? 0) : 0
  const newCountLabel = newItemsQuery.data?.page_info.has_more
    ? `${NEW_POLL_LIMIT}+`
    : String(newCount)

  /** Banner click: drop the anchor and load the list from the current head. */
  function showNewItems() {
    // Remove the stale unanchored cache entry so re-anchoring uses fresh data,
    // not the snapshot from the previous mount.
    queryClient.removeQueries({ queryKey: [...filterKey, null], exact: true })
    queryClient.removeQueries({ queryKey: ['transactions-new'] })
    setAnchor(null)
  }

  const rows: TransactionRow[] = listData?.pages.flatMap((p) => p.data) ?? []
  const summary = listData?.pages[0]?.summary

  return {
    rows,
    summary,
    isPending: listQuery.isPending && !listQuery.isPlaceholderData,
    /** True while showing carried-over data from a previous query key. */
    isPlaceholder: listQuery.isPlaceholderData,
    isError: listQuery.isError,
    error: listQuery.error,
    refetch: listQuery.refetch,
    fetchNextPage: listQuery.fetchNextPage,
    hasNextPage: listQuery.hasNextPage,
    isFetchingNextPage: listQuery.isFetchingNextPage,
    isRefreshing: listQuery.isRefetching && !listQuery.isFetchingNextPage,
    newCount,
    newCountLabel,
    showNewItems,
  }
}

/** Patch a transaction row inside every cached list for the given env. */
export function patchTransactionInLists(
  queryClient: ReturnType<typeof useQueryClient>,
  env: string,
  tx: TransactionRow,
) {
  queryClient.setQueriesData<InfiniteData<ListResponse, string | null>>(
    { queryKey: ['transactions', env] },
    (old) =>
      old && {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          data: page.data.map((row) => (row.id === tx.id ? tx : row)),
        })),
      },
  )
}
