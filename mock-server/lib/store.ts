/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PROVIDED — the in-memory transaction store + background "data evolution"
 *  engine. You normally won't need to change this file; it's the "environment"
 *  your API runs against. Read it so you know what data exists and how it
 *  changes, then build your endpoints in `routes/transactions.ts`.
 *
 *  (You may modify any file — including this one — if it makes for a better
 *   implementation. Just explain why in your project README.)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Two things live here:
 *   1. `transactions` — the in-memory data, loaded once from db.json at startup.
 *      All mutations stay in memory; restart the server to reset.
 *   2. `startDataEvolution()` — a background timer that, every few seconds and
 *      per environment, either adds a new transaction or moves a `pending`
 *      transaction to `succeeded` / `failed`. This is what makes the list
 *      change "in near real-time" while a user is looking at it. Keeping the
 *      client in sync with these changes is one of the core challenges of the
 *      assignment.
 */

import path from 'path';
import fs from 'fs';
import type {
  CardBrand,
  Customer,
  Env,
  Transaction,
  TxStatus,
} from '../types';

// ---------------------------------------------------------------------------
// Data — loaded once from db.json. `transactions[env]` is a plain array of
// full transaction objects, newest first. Run `npm run seed` to regenerate
// db.json deterministically.
// ---------------------------------------------------------------------------

const dbPath = path.join(__dirname, '..', 'db.json');
const initial = JSON.parse(fs.readFileSync(dbPath, 'utf8')) as {
  transactions_sandbox: Transaction[];
  transactions_production: Transaction[];
};

export const transactions: Record<Env, Transaction[]> = {
  sandbox: [...initial.transactions_sandbox],
  production: [...initial.transactions_production],
};

const counters: Record<Env, number> = {
  sandbox: transactions.sandbox.length,
  production: transactions.production.length,
};

/** True for the two environments this store knows about. */
export function isValidEnv(env: unknown): env is Env {
  return env === 'sandbox' || env === 'production';
}

// ---------------------------------------------------------------------------
// Background data evolution
//   Every ~6s per env, do one of:
//     - create a new transaction (often `pending`, resolves on a later tick)
//     - resolve a `pending` transaction to `succeeded` / `failed`
//   Tune with TICK_INTERVAL_MS (set to 0 to freeze the data for debugging).
// ---------------------------------------------------------------------------

const NEW_CUSTOMERS: Record<Env, Customer[]> = {
  sandbox: [
    { id: 'cus_test_201', name: 'New Sandbox User', email: 'newuser@example.com' },
    { id: 'cus_test_202', name: 'Recent Test', email: 'recent.test@example.com' },
    { id: 'cus_test_203', name: 'New QA', email: 'new.qa@example.test' },
  ],
  production: [
    { id: 'cus_live_201', name: 'Aisha Patel', email: 'aisha.p@shop.in' },
    { id: 'cus_live_202', name: 'Tomás García', email: 'tomas.g@tienda.mx' },
    { id: 'cus_live_203', name: 'Yuki Sato', email: 'yuki.s@boutique.jp' },
    { id: 'cus_live_204', name: 'Marcus Andersson', email: 'marcus.a@nordic.se' },
    { id: 'cus_live_205', name: 'Fatima Khalil', email: 'f.khalil@studio.ae' },
  ],
};

const BRANDS: CardBrand[] = ['visa', 'mastercard', 'amex'];
const LAST4: Record<Env, string[]> = {
  sandbox: ['4242', '0005', '0341', '9995'],
  production: ['4519', '2204', '8810', '0078', '6611', '3344'],
};
const CURRENCIES: Record<Env, Transaction['currency'][]> = {
  sandbox: ['usd'],
  production: ['usd', 'eur', 'krw', 'jpy', 'gbp'],
};

function pad(n: number, w: number): string {
  const s = String(n);
  return s.length >= w ? s : '0'.repeat(w - s.length) + s;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeNewTransaction(env: Env): Transaction {
  counters[env] += 1;
  const idx = counters[env];
  const id = `${env === 'sandbox' ? 'txn_test' : 'txn_live'}_${pad(idx, 6)}`;
  const now = new Date().toISOString();

  // 70% start pending, 25% start succeeded, 5% start failed.
  const r = Math.random();
  const status: TxStatus = r < 0.7 ? 'pending' : r < 0.95 ? 'succeeded' : 'failed';

  const amount =
    env === 'sandbox'
      ? pick([1000, 1500, 2000, 5000, 10000])
      : Math.round((500 + Math.random() * 50000) / 50) * 50;

  const customer = pick(NEW_CUSTOMERS[env]);
  const tx: Transaction = {
    id,
    amount,
    currency: pick(CURRENCIES[env]),
    status,
    customer,
    payment_method: {
      type: 'card',
      brand: pick(BRANDS),
      last4: pick(LAST4[env]),
      exp_month: 1 + Math.floor(Math.random() * 12),
      exp_year: 2027 + Math.floor(Math.random() * 3),
    },
    events: [{ type: 'created', at: now }],
    metadata: { order_id: `ord_${pad(idx + 100, 5)}` },
    created_at: now,
  };
  if (status === 'succeeded') {
    tx.events.push({ type: 'authorized', at: now });
    tx.events.push({ type: 'captured', at: now });
  } else if (status === 'pending') {
    tx.events.push({ type: 'authorized', at: now });
  } else if (status === 'failed') {
    tx.events.push({ type: 'authorization_failed', at: now });
    tx.metadata.failure_reason = pick([
      'card_declined',
      'insufficient_funds',
      'expired_card',
      'authentication_required',
    ]);
  }
  return tx;
}

function resolveOnePending(env: Env): Transaction | null {
  const pendings = transactions[env].filter((t) => t.status === 'pending');
  if (pendings.length === 0) return null;
  const tx = pick(pendings);
  const succeeded = Math.random() < 0.85;
  tx.status = succeeded ? 'succeeded' : 'failed';
  const now = new Date().toISOString();
  tx.events.push({
    type: succeeded ? 'captured' : 'authorization_failed',
    at: now,
  });
  if (!succeeded) {
    tx.metadata.failure_reason = pick([
      'card_declined',
      'insufficient_funds',
      'authentication_required',
    ]);
  }
  return tx;
}

function tick(env: Env): void {
  const action = Math.random();
  if (action < 0.55) {
    const tx = makeNewTransaction(env);
    transactions[env].unshift(tx); // newest first
  } else if (action < 0.9) {
    resolveOnePending(env);
  }
  // ~10% no-op: a quiet tick.
}

export interface DataEvolution {
  intervalMs: number;
  stop: () => void;
}

/**
 * Start the background data-evolution timer. Returns a `stop()` function.
 * Honors TICK_INTERVAL_MS (default 6000; set to 0 to disable).
 */
export function startDataEvolution(): DataEvolution {
  const intervalMs = parseInt(process.env.TICK_INTERVAL_MS ?? '', 10);
  const ms = Number.isNaN(intervalMs) ? 6000 : intervalMs;
  if (ms <= 0) {
    return { intervalMs: 0, stop: () => {} };
  }

  // Offset the two environments slightly so events don't perfectly align.
  setTimeout(() => tick('sandbox'), 2000);
  setTimeout(() => tick('production'), 4000);
  const handle = setInterval(() => {
    tick('sandbox');
    setTimeout(() => tick('production'), ms / 2);
  }, ms);

  return { intervalMs: ms, stop: () => clearInterval(handle) };
}
