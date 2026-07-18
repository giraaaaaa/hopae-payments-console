/**
 * Transaction APIs — list + refund. (This file is "YOUR WORK" in the assignment.)
 *
 * ── API design ───────────────────────────────────────────────────────────────
 *
 * GET /api/transactions
 *   Query params:
 *     env      required  'sandbox' | 'production'
 *     status   optional  'succeeded' | 'pending' | 'failed' | 'refunded'
 *     q        optional  case-insensitive substring match on transaction id
 *                        OR customer email
 *     limit    optional  page size, 1–100 (default 20)
 *     cursor   optional  opaque cursor → return items strictly OLDER than it
 *     max      optional  opaque cursor → only items at-or-older than it
 *                        (an "anchor": freezes the list window so background
 *                        inserts never shift already-loaded pages)
 *     since    optional  opaque cursor → return items strictly NEWER than it
 *                        (used by the client's new-items poll; exclusive with
 *                        cursor/max)
 *   Response: {
 *     data: TransactionRow[],            // newest first
 *     page_info: { next_cursor, has_more, limit },
 *     window_max,                        // cursor of the newest returned item;
 *                                        // clients pass it back as `max`
 *     summary: { total, succeeded, pending, failed, refunded },
 *                                        // counts within env + q (NOT status),
 *                                        // so filter tabs can show live counts
 *   }
 *
 *   Cursors are value-based (created_at + id), not offsets: the store unshifts
 *   new rows every few seconds, so offset pagination would duplicate/skip rows
 *   between requests. Cursors are opaque base64url strings.
 *
 * POST /api/transactions/:id/refund
 *   Body: { env: 'sandbox' | 'production' }
 *   Full refund only (partial refunds are out of scope — see project README).
 *   Guards: 404 unknown id; 409 { error: 'already_refunded' | 'not_refundable' }
 *   when the transaction isn't in a refundable state (only `succeeded` is).
 *   Success: 200 { transaction } with the updated row, so the client can patch
 *   its cache without a full refetch. 409 responses also carry the current
 *   `transaction` — if a row changed under the user (e.g. refunded elsewhere),
 *   the client can reconcile instead of showing a stale state.
 */

import type { Express, Request, Response } from 'express';
import { transactions, isValidEnv } from '../lib/store';
import { requireAuth } from '../lib/auth';
import type { Env, Transaction, TxStatus } from '../types';

// ---------------------------------------------------------------------------
// Row DTO — the list returns a trimmed shape, not the full stored object.
// The table doesn't need the event timeline; keeping the payload small also
// makes the polling refetches cheap.
// ---------------------------------------------------------------------------

export interface TransactionRow {
  id: string;
  amount: number;
  currency: Transaction['currency'];
  status: TxStatus;
  customer: { name: string; email: string };
  payment_method: { brand: Transaction['payment_method']['brand']; last4: string };
  created_at: string;
  failure_reason?: string;
  refunded_at?: string;
}

export function toRow(tx: Transaction): TransactionRow {
  const row: TransactionRow = {
    id: tx.id,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
    customer: { name: tx.customer.name, email: tx.customer.email },
    payment_method: {
      brand: tx.payment_method.brand,
      last4: tx.payment_method.last4,
    },
    created_at: tx.created_at,
  };
  if (tx.status === 'failed' && tx.metadata.failure_reason) {
    row.failure_reason = tx.metadata.failure_reason;
  }
  if (tx.status === 'refunded') {
    const refundedEvent = [...tx.events].reverse().find((e) => e.type === 'refunded');
    if (refundedEvent) row.refunded_at = refundedEvent.at;
  }
  return row;
}

// ---------------------------------------------------------------------------
// Cursors — value-based position: (created_at, id), ordered newest-first with
// id as the tiebreaker. Encoded as opaque base64url so the wire format can
// change without touching clients.
// ---------------------------------------------------------------------------

interface CursorPos {
  created_at: string;
  id: string;
}

export function encodeCursor(pos: CursorPos): string {
  return Buffer.from(`${pos.created_at}\n${pos.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): CursorPos | null {
  try {
    const [created_at, id] = Buffer.from(raw, 'base64url').toString('utf8').split('\n');
    if (!created_at || !id || Number.isNaN(Date.parse(created_at))) return null;
    return { created_at, id };
  } catch {
    return null;
  }
}

/** Newest-first ordering: negative when a is newer than b. */
function comparePos(a: CursorPos, b: CursorPos): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

// ---------------------------------------------------------------------------
// List — pure query logic (exported for tests), then the route handler.
// ---------------------------------------------------------------------------

const STATUSES: TxStatus[] = ['succeeded', 'pending', 'failed', 'refunded'];

export interface ListParams {
  status?: TxStatus;
  q?: string;
  limit: number;
  cursor?: CursorPos;
  max?: CursorPos;
  since?: CursorPos;
}

export interface ListResult {
  data: TransactionRow[];
  page_info: { next_cursor: string | null; has_more: boolean; limit: number };
  window_max: string | null;
  summary: Record<'total' | TxStatus, number>;
}

export function queryTransactions(all: Transaction[], params: ListParams): ListResult {
  const q = params.q?.trim().toLowerCase();

  // env + search scope (status intentionally not applied — see `summary`).
  const scoped = !q
    ? all
    : all.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.customer.email.toLowerCase().includes(q),
      );

  const summary: ListResult['summary'] = {
    total: scoped.length,
    succeeded: 0,
    pending: 0,
    failed: 0,
    refunded: 0,
  };
  for (const t of scoped) summary[t.status] += 1;

  let matched = params.status
    ? scoped.filter((t) => t.status === params.status)
    : scoped;

  // The store keeps arrays newest-first already, but sort defensively so the
  // cursor ordering never depends on insertion discipline.
  matched = [...matched].sort(comparePos);

  if (params.since) {
    const since = params.since;
    const newer = matched.filter((t) => comparePos(t, since) < 0);
    const page = newer.slice(0, params.limit);
    return {
      data: page.map(toRow),
      page_info: {
        next_cursor: null,
        has_more: newer.length > params.limit,
        limit: params.limit,
      },
      window_max: page.length > 0 ? encodeCursor(page[0]) : null,
      summary,
    };
  }

  if (params.max) {
    const max = params.max;
    matched = matched.filter((t) => comparePos(t, max) >= 0);
  }
  if (params.cursor) {
    const cursor = params.cursor;
    matched = matched.filter((t) => comparePos(t, cursor) > 0);
  }

  const page = matched.slice(0, params.limit);
  const hasMore = matched.length > params.limit;
  return {
    data: page.map(toRow),
    page_info: {
      next_cursor: page.length > 0 && hasMore ? encodeCursor(page[page.length - 1]) : null,
      has_more: hasMore,
      limit: params.limit,
    },
    window_max: page.length > 0 ? encodeCursor(page[0]) : null,
    summary,
  };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function badRequest(res: Response, message: string): void {
  res.status(400).json({ error: 'bad_request', message });
}

function parseListParams(req: Request, res: Response): (ListParams & { env: Env }) | null {
  const { env, status, q, limit, cursor, max, since } = req.query;

  if (!isValidEnv(env)) {
    badRequest(res, "Query param 'env' is required and must be 'sandbox' or 'production'.");
    return null;
  }

  const params: ListParams & { env: Env } = { env, limit: DEFAULT_LIMIT };

  if (status !== undefined) {
    if (typeof status !== 'string' || !STATUSES.includes(status as TxStatus)) {
      badRequest(res, `Query param 'status' must be one of: ${STATUSES.join(', ')}.`);
      return null;
    }
    params.status = status as TxStatus;
  }

  if (q !== undefined) {
    if (typeof q !== 'string') {
      badRequest(res, "Query param 'q' must be a string.");
      return null;
    }
    if (q.trim() !== '') params.q = q;
  }

  if (limit !== undefined) {
    const n = Number(limit);
    if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
      badRequest(res, `Query param 'limit' must be an integer between 1 and ${MAX_LIMIT}.`);
      return null;
    }
    params.limit = n;
  }

  for (const [name, raw] of [
    ['cursor', cursor],
    ['max', max],
    ['since', since],
  ] as const) {
    if (raw === undefined) continue;
    const pos = typeof raw === 'string' ? decodeCursor(raw) : null;
    if (!pos) {
      badRequest(res, `Query param '${name}' is not a valid cursor.`);
      return null;
    }
    params[name] = pos;
  }

  if (params.since && (params.cursor || params.max)) {
    badRequest(res, "Query param 'since' cannot be combined with 'cursor' or 'max'.");
    return null;
  }

  return params;
}

// ---------------------------------------------------------------------------
// Refund — pure transition (exported for tests), then the route handler.
// ---------------------------------------------------------------------------

export type RefundOutcome =
  | { ok: true; transaction: TransactionRow }
  | { ok: false; error: 'already_refunded' | 'not_refundable'; transaction: TransactionRow };

export function refundTransaction(tx: Transaction, now = new Date()): RefundOutcome {
  if (tx.status === 'refunded') {
    return { ok: false, error: 'already_refunded', transaction: toRow(tx) };
  }
  if (tx.status !== 'succeeded') {
    // pending: not captured yet; failed: nothing was charged.
    return { ok: false, error: 'not_refundable', transaction: toRow(tx) };
  }
  tx.status = 'refunded';
  tx.events.push({ type: 'refunded', at: now.toISOString() });
  return { ok: true, transaction: toRow(tx) };
}

const REFUND_ERROR_MESSAGES: Record<'already_refunded' | 'not_refundable', string> = {
  already_refunded: 'This transaction has already been refunded.',
  not_refundable: 'Only succeeded transactions can be refunded.',
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Mount the transaction routes on the given Express app. */
export function register(app: Express): void {
  app.get('/api/transactions', requireAuth, (req, res) => {
    const params = parseListParams(req, res);
    if (!params) return;
    res.json(queryTransactions(transactions[params.env], params));
  });

  app.post('/api/transactions/:id/refund', requireAuth, (req, res) => {
    const { env } = (req.body ?? {}) as { env?: unknown };
    if (!isValidEnv(env)) {
      badRequest(res, "Body field 'env' is required and must be 'sandbox' or 'production'.");
      return;
    }

    const tx = transactions[env].find((t) => t.id === req.params.id);
    if (!tx) {
      res.status(404).json({
        error: 'not_found',
        message: `No transaction '${req.params.id}' in ${env}.`,
      });
      return;
    }

    const outcome = refundTransaction(tx);
    if (!outcome.ok) {
      res.status(409).json({
        error: outcome.error,
        message: REFUND_ERROR_MESSAGES[outcome.error],
        transaction: outcome.transaction,
      });
      return;
    }
    res.json({ transaction: outcome.transaction });
  });
}
