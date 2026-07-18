import { describe, expect, it } from 'vitest';
import type { Transaction } from '../types';
import {
  decodeCursor,
  encodeCursor,
  queryTransactions,
  refundTransaction,
} from './transactions';

let seq = 0;
function tx(overrides: Partial<Transaction> = {}): Transaction {
  seq += 1;
  const createdAt =
    overrides.created_at ?? new Date(2026, 0, 1, 12, 0, seq).toISOString();
  return {
    id: `txn_test_${String(seq).padStart(6, '0')}`,
    amount: 1000,
    currency: 'usd',
    status: 'succeeded',
    customer: { id: 'cus_1', name: 'Ada Lovelace', email: 'ada@analytical.io' },
    payment_method: {
      type: 'card',
      brand: 'visa',
      last4: '4242',
      exp_month: 8,
      exp_year: 2028,
    },
    events: [{ type: 'created', at: createdAt }],
    metadata: { order_id: 'ord_00001' },
    created_at: createdAt,
    ...overrides,
  };
}

/** Build a store-shaped array: newest first, like lib/store keeps it. */
function makeStore(count: number): Transaction[] {
  const rows = Array.from({ length: count }, () => tx());
  return rows.reverse();
}

describe('cursor encoding', () => {
  it('round-trips', () => {
    const pos = { created_at: '2026-03-14T14:22:01.000Z', id: 'txn_test_000042' };
    expect(decodeCursor(encodeCursor(pos))).toEqual(pos);
  });

  it('rejects garbage', () => {
    expect(decodeCursor('%%%not-a-cursor%%%')).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });
});

describe('queryTransactions — pagination', () => {
  it('returns newest first with a next cursor when more remain', () => {
    const store = makeStore(10);
    const result = queryTransactions(store, { limit: 4 });
    expect(result.data.map((r) => r.id)).toEqual(store.slice(0, 4).map((t) => t.id));
    expect(result.page_info.has_more).toBe(true);
    expect(result.page_info.next_cursor).not.toBeNull();
  });

  it('pages do not overlap or skip', () => {
    const store = makeStore(10);
    const page1 = queryTransactions(store, { limit: 4 });
    const page2 = queryTransactions(store, {
      limit: 4,
      cursor: decodeCursor(page1.page_info.next_cursor!)!,
    });
    const ids = [...page1.data, ...page2.data].map((r) => r.id);
    expect(new Set(ids).size).toBe(8);
    expect(ids).toEqual(store.slice(0, 8).map((t) => t.id));
  });

  it('a `max` anchor freezes the window even when new rows are prepended', () => {
    const store = makeStore(6);
    const first = queryTransactions(store, { limit: 3 });
    const max = decodeCursor(first.window_max!)!;

    // Background engine inserts two newer transactions at the head.
    store.unshift(tx(), tx());

    const replay = queryTransactions(store, { limit: 3, max });
    expect(replay.data.map((r) => r.id)).toEqual(first.data.map((r) => r.id));
  });

  it('`since` returns only rows newer than the anchor', () => {
    const store = makeStore(5);
    const first = queryTransactions(store, { limit: 5 });
    const anchor = decodeCursor(first.window_max!)!;

    expect(queryTransactions(store, { limit: 25, since: anchor }).data).toHaveLength(0);

    const older = tx();
    const newer = tx();
    store.unshift(newer, older);
    const poll = queryTransactions(store, { limit: 25, since: anchor });
    expect(poll.data.map((r) => r.id)).toEqual([newer.id, older.id]);
  });
});

describe('queryTransactions — filter and search', () => {
  it('filters by status', () => {
    const store = [
      tx({ status: 'failed' }),
      tx({ status: 'succeeded' }),
      tx({ status: 'failed' }),
    ];
    const result = queryTransactions(store, { limit: 25, status: 'failed' });
    expect(result.data).toHaveLength(2);
    expect(result.data.every((r) => r.status === 'failed')).toBe(true);
  });

  it('searches transaction id and customer email, case-insensitively', () => {
    const target = tx({
      customer: { id: 'cus_2', name: 'Yuki Sato', email: 'yuki.s@boutique.jp' },
    });
    const store = [tx(), target, tx()];

    const byEmail = queryTransactions(store, { limit: 25, q: 'YUKI.S@' });
    expect(byEmail.data.map((r) => r.id)).toEqual([target.id]);

    const byId = queryTransactions(store, { limit: 25, q: target.id.slice(-6) });
    expect(byId.data.map((r) => r.id)).toContain(target.id);
  });

  it('summary counts respect the search but ignore the status filter', () => {
    const store = [
      tx({ status: 'succeeded' }),
      tx({ status: 'pending' }),
      tx({ status: 'failed' }),
    ];
    const result = queryTransactions(store, { limit: 25, status: 'failed' });
    expect(result.summary).toEqual({
      total: 3,
      succeeded: 1,
      pending: 1,
      failed: 1,
      refunded: 0,
    });
  });
});

describe('queryTransactions — row DTO', () => {
  it('exposes failure_reason only for failed rows and refunded_at for refunded rows', () => {
    const failed = tx({
      status: 'failed',
      metadata: { order_id: 'ord_1', failure_reason: 'card_declined' },
    });
    const refundedAt = '2026-03-15T00:00:00.000Z';
    const refunded = tx({
      status: 'refunded',
      events: [
        { type: 'created', at: '2026-03-14T00:00:00.000Z' },
        { type: 'refunded', at: refundedAt },
      ],
    });
    const rows = queryTransactions([failed, refunded], { limit: 25 }).data;
    const failedRow = rows.find((r) => r.id === failed.id)!;
    const refundedRow = rows.find((r) => r.id === refunded.id)!;

    expect(failedRow.failure_reason).toBe('card_declined');
    expect(failedRow.refunded_at).toBeUndefined();
    expect(refundedRow.refunded_at).toBe(refundedAt);
    expect(refundedRow.failure_reason).toBeUndefined();
  });
});

describe('refundTransaction', () => {
  it('refunds a succeeded transaction and appends a refunded event', () => {
    const target = tx({ status: 'succeeded' });
    const now = new Date('2026-03-15T10:00:00.000Z');
    const outcome = refundTransaction(target, now);

    expect(outcome.ok).toBe(true);
    expect(target.status).toBe('refunded');
    expect(target.events.at(-1)).toEqual({ type: 'refunded', at: now.toISOString() });
    if (outcome.ok) expect(outcome.transaction.refunded_at).toBe(now.toISOString());
  });

  it('rejects pending and failed transactions without mutating them', () => {
    for (const status of ['pending', 'failed'] as const) {
      const target = tx({ status });
      const outcome = refundTransaction(target);
      expect(outcome).toMatchObject({ ok: false, error: 'not_refundable' });
      expect(target.status).toBe(status);
    }
  });

  it('rejects an already-refunded transaction', () => {
    const target = tx({ status: 'refunded' });
    expect(refundTransaction(target)).toMatchObject({
      ok: false,
      error: 'already_refunded',
    });
  });
});
