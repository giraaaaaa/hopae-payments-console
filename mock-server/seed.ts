/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PROVIDED — generates db.json with seed data for sandbox and production.
 *  You normally won't need to run or change this (db.json is committed), but
 *  you may. Run with: `npm run seed`.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The random *choices* are deterministic (seeded RNG); only the `created_at`
 * timestamps are relative to "now", so rows always look recent.
 *
 * Sandbox data is intentionally "test-looking" (e.g. card last4 = 4242,
 * obvious test customer names). Production data is more realistic.
 * This gives candidates room to add visual differentiation between envs.
 */

import fs from 'fs';
import path from 'path';
import type {
  CardBrand,
  Currency,
  Env,
  Transaction,
  TxEvent,
  TxStatus,
} from './types';

function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad(n: number, w: number): string {
  const s = String(n);
  return s.length >= w ? s : '0'.repeat(w - s.length) + s;
}

function makeId(prefix: string, n: number): string {
  return `${prefix}_${pad(n, 6)}`;
}

interface SeedCustomer {
  name: string;
  email: string;
}

const SANDBOX_CUSTOMERS: SeedCustomer[] = [
  { name: 'Test Customer', email: 'test@example.com' },
  { name: 'Demo User', email: 'demo+1@example.com' },
  { name: 'QA Account', email: 'qa@example.test' },
  { name: 'Alice Tester', email: 'alice.tester@example.com' },
  { name: 'Bob Sandbox', email: 'bob+sandbox@example.com' },
  { name: 'Charlie Dev', email: 'charlie.dev@example.com' },
  { name: 'Internal QA', email: 'internal.qa@example.test' },
];

const PRODUCTION_CUSTOMERS: SeedCustomer[] = [
  { name: 'Hannah Lee', email: 'hannah.lee@gmail.com' },
  { name: 'Michael Chen', email: 'mchen@acme.co' },
  { name: 'Sofia Rossi', email: 'sofia.rossi@studio.it' },
  { name: 'David Park', email: 'david.park@kakao.com' },
  { name: 'Emma Müller', email: 'emma.m@firma.de' },
  { name: 'Olivia Smith', email: 'olivia@designhouse.co' },
  { name: 'Noah Williams', email: 'noah.w@studio.io' },
  { name: 'Jiwoo Han', email: 'jiwoo.han@naver.com' },
  { name: 'Lucas Bernard', email: 'lucas.b@maison.fr' },
  { name: 'Aiko Tanaka', email: 'aiko.tanaka@shop.jp' },
  { name: 'Carlos Ramirez', email: 'cramirez@tienda.es' },
  { name: 'Priya Sharma', email: 'priya.sharma@studio.in' },
];

const CARD_BRANDS: CardBrand[] = ['visa', 'mastercard', 'amex'];
const SANDBOX_LAST4 = ['4242', '0005', '0341', '9995'];
const PRODUCTION_LAST4 = ['4519', '2204', '8810', '0078', '6611', '3344', '9012'];

function pickWeighted<T>(rng: () => number, items: { value: T; weight: number }[]): T {
  const total = items.reduce((s, it) => s + it.weight, 0);
  let r = rng() * total;
  for (const it of items) {
    if (r < it.weight) return it.value;
    r -= it.weight;
  }
  return items[items.length - 1].value;
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function randomAmount(rng: () => number, env: Env): number {
  if (env === 'sandbox') {
    // Round, obviously fake amounts.
    return pick(rng, [1000, 1500, 2000, 5000, 10000, 25000, 50000]);
  }
  // Production: realistic-ish, in minor units.
  const base = Math.floor(500 + rng() * 50000);
  // Round to nearest 50 cents to feel like real prices.
  return Math.round(base / 50) * 50;
}

function buildEvents(status: TxStatus, createdAt: string): TxEvent[] {
  const t0 = new Date(createdAt).getTime();
  const evt = (type: TxEvent['type'], offsetSec: number): TxEvent => ({
    type,
    at: new Date(t0 + offsetSec * 1000).toISOString(),
  });

  const events: TxEvent[] = [evt('created', 0)];
  if (status === 'succeeded') {
    events.push(evt('authorized', 2));
    events.push(evt('captured', 4));
  } else if (status === 'pending') {
    events.push(evt('authorized', 2));
    // No capture yet.
  } else if (status === 'failed') {
    events.push(evt('authorization_failed', 3));
  } else if (status === 'refunded') {
    events.push(evt('authorized', 2));
    events.push(evt('captured', 4));
    events.push(evt('refunded', 60 * 60 * 24)); // 1 day later
  }
  return events;
}

function buildTransaction(rng: () => number, env: Env, index: number): Transaction {
  const customers = env === 'sandbox' ? SANDBOX_CUSTOMERS : PRODUCTION_CUSTOMERS;
  const last4Pool = env === 'sandbox' ? SANDBOX_LAST4 : PRODUCTION_LAST4;

  const status = pickWeighted<TxStatus>(rng, [
    { value: 'succeeded', weight: env === 'sandbox' ? 5 : 8 },
    { value: 'pending', weight: 2 },
    { value: 'failed', weight: env === 'sandbox' ? 3 : 1 },
    { value: 'refunded', weight: 1 },
  ]);

  const customer = pick(rng, customers);
  const brand = pick(rng, CARD_BRANDS);
  const last4 = pick(rng, last4Pool);
  const amount = randomAmount(rng, env);
  const currency: Currency =
    env === 'sandbox'
      ? 'usd'
      : pickWeighted<Currency>(rng, [
          { value: 'usd', weight: 5 },
          { value: 'eur', weight: 3 },
          { value: 'krw', weight: 3 },
          { value: 'jpy', weight: 1 },
          { value: 'gbp', weight: 1 },
        ]);

  // Spread transactions over the last 30 days, newest first.
  const minutesAgo = Math.floor((index * (30 * 24 * 60)) / 30 + rng() * 60);
  const createdAt = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

  const idPrefix = env === 'sandbox' ? 'txn_test' : 'txn_live';
  const id = makeId(idPrefix, index + 1);

  const tx: Transaction = {
    id,
    amount,
    currency,
    status,
    customer: {
      id: `cus_${env === 'sandbox' ? 'test' : 'live'}_${pad(customers.indexOf(customer) + 1, 4)}`,
      name: customer.name,
      email: customer.email,
    },
    payment_method: {
      type: 'card',
      brand,
      last4,
      exp_month: 1 + Math.floor(rng() * 12),
      exp_year: 2027 + Math.floor(rng() * 3),
    },
    events: buildEvents(status, createdAt),
    metadata:
      status === 'failed'
        ? {
            order_id: `ord_${pad(index + 100, 5)}`,
            failure_reason: pick(rng, [
              'card_declined',
              'insufficient_funds',
              'expired_card',
              'authentication_required',
            ]),
          }
        : { order_id: `ord_${pad(index + 100, 5)}` },
    created_at: createdAt,
  };

  return tx;
}

function buildList(env: Env, count: number, seed: number): Transaction[] {
  const rng = mulberry32(seed);
  const items: Transaction[] = [];
  for (let i = 0; i < count; i++) {
    items.push(buildTransaction(rng, env, i));
  }
  // Ensure newest first.
  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return items;
}

const db = {
  transactions_sandbox: buildList('sandbox', 23, 1),
  transactions_production: buildList('production', 47, 2),
};

const outPath = path.join(__dirname, 'db.json');
fs.writeFileSync(outPath, JSON.stringify(db, null, 2) + '\n', 'utf8');

console.log(`Wrote ${outPath}`);
console.log(`  sandbox    : ${db.transactions_sandbox.length} transactions`);
console.log(`  production : ${db.transactions_production.length} transactions`);
