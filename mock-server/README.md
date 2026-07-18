# Mock API Server

Mock backend for the take-home assignment. Runs on `http://localhost:4000`.
Written in **TypeScript** and run directly with [tsx](https://github.com/privatenumber/tsx)
— there's no build step (`npm start` runs the `.ts` files as-is). Built on
[json-server](https://github.com/typicode/json-server) only for its convenient
defaults (CORS, logger, body parser) — every route is hand-written.

**This server is deliberately incomplete.** It gives you authentication, the data,
and a background engine that changes the data over time. The transaction
**list / refund** endpoints are yours to design and build.

## Layout — what's yours vs. what's provided

```
mock-server/
  db.json                  the data (seeded). Restarting the server resets to this.
  types.ts                 PROVIDED: shared data-model types (matches the schema below)
  server.ts                PROVIDED: app wiring — read this first
  seed.ts                  PROVIDED: regenerates db.json
  tsconfig.json            TS config (CommonJS; runs via tsx, no build step)
  json-server.d.ts         PROVIDED: minimal ambient types for json-server
  lib/
    auth.ts                PROVIDED: POST /api/auth/login + a requireAuth guard
    store.ts               PROVIDED: in-memory data + the background data-evolution engine
  routes/
    transactions.ts   ←──  YOUR WORK: list / refund (currently 501 stubs).
                           Open this file and look for "START YOUR CODE HERE".
```

**PROVIDED** files already work — read them so you know what data exists and how it
changes, but you normally won't need to change them. The one file you build is
**`routes/transactions.ts`**.

That said, this is a guideline, not a fence: **you may modify *any* file, including the
provided ones, if it makes for a better implementation.** Just explain what you changed
and why in your project README.

## Setup

```bash
npm install         # or pnpm install / yarn
npm start           # start server on :4000 (tsx server.ts — no build step)
```

Other scripts:

```bash
npm run dev         # same, but restarts on file changes (tsx watch)
npm run typecheck   # tsc --noEmit — type-check without running
npm run seed        # regenerate db.json (already committed; only if you want fresh data)
```

State is in-memory. Restart to reset.

## Test credentials

```
email:    demo@hopae.com
password: password123
```

## What's provided

### `POST /api/auth/login`

```json
Request:  { "email": "demo@hopae.com", "password": "password123" }
Response: { "token": "mock.usr_demo.<ts>",
            "user":  { "id": "...", "name": "...", "email": "..." } }
```

The token is an opaque string with no expiry — `requireAuth` (in `lib/auth.ts`)
only checks for an `Authorization: Bearer mock.*` header. Auth is intentionally
minimal and not a focus of this assignment: store the token and send it as a
Bearer header on your requests.

### Background data evolution

Every few seconds, per environment, the server either adds a new transaction or
moves a `pending` transaction to `succeeded` / `failed`. This is what makes the list
change in near real-time. Keeping the client in sync with it is a core challenge of
the assignment. (See `lib/store.ts`.)

Tune or disable:

```bash
TICK_INTERVAL_MS=12000 npm start    # slower
TICK_INTERVAL_MS=0     npm start    # freeze data, for debugging
```

## What you build

The endpoints below are mounted as stubs that return **501 Not Implemented** so the
server boots and the frontend gets a clear signal. Implement them in
`routes/transactions.ts` (look for **"START YOUR CODE HERE"**) — you decide the route
shapes, query params, and response DTOs. (The paths below are a starting suggestion;
change them if you have a better design and explain why in your project README.)

- **List** — the transactions table. You decide the route shape, how the client
  selects the environment, pagination, and the response fields. Status filter and
  search (by transaction id and customer email) are list features.
- **Refund** — a write that records a refund, triggered from the list (e.g. a per-row
  action). How you model it — in the data, the list, and the API — is your design.

How to read/write the data, from `routes/transactions.ts`:

```ts
import { transactions, isValidEnv } from '../lib/store';
import type { Transaction } from '../types';

transactions.sandbox      // Transaction[] (newest first)
transactions.production   // Transaction[] (newest first)
```

## Data schema (`db.json`)

`db.json` has exactly two top-level arrays — one per environment:

```json
{
  "transactions_sandbox":    [ /* Transaction, ... */ ],
  "transactions_production": [ /* Transaction, ... */ ]
}
```

A **Transaction** looks like:

```jsonc
{
  "id": "txn_live_000042",          // "txn_test_*" in sandbox, "txn_live_*" in production
  "amount": 125000,                  // integer, MINOR units (see "Amounts" below)
  "currency": "usd",                 // lowercase ISO code: usd | eur | gbp | krw | jpy
  "status": "succeeded",             // succeeded | pending | failed | refunded
  "customer": {
    "id": "cus_live_0003",
    "name": "Ada Lovelace",
    "email": "ada@analytical.io"
  },
  "payment_method": {
    "type": "card",
    "brand": "visa",                 // visa | mastercard | amex
    "last4": "4242",
    "exp_month": 8,                  // 1–12
    "exp_year": 2028
  },
  "events": [                         // ordered lifecycle (e.g. an event timeline)
    { "type": "created",    "at": "2026-03-14T14:22:01.000Z" },
    { "type": "authorized", "at": "2026-03-14T14:22:03.000Z" },
    { "type": "captured",   "at": "2026-03-14T14:22:04.000Z" }
  ],
  "metadata": {
    "order_id": "ord_00142",
    "failure_reason": "card_declined"  // present only when status is "failed"
  },
  "created_at": "2026-03-14T14:22:01.000Z"
}
```

Field notes:

- **`status`** — the union is `succeeded | pending | failed | refunded`. `pending`
  rows are the ones the background engine later resolves.
- **`events[].type`** — `created`, `authorized`, `captured`, `authorization_failed`,
  `refunded`. A `succeeded` transaction has `created → authorized → captured`; a
  `pending` one stops at `authorized`; a `failed` one has `authorization_failed`; a
  `refunded` one ends with a `refunded` event.
- **`metadata.failure_reason`** — only on `failed` transactions.
- **List shape** — `db.json` stores the *full* object. Whether your list endpoint
  returns the whole thing or a trimmed row shape is part of your API design.

### Amounts and currencies

Amounts are in **minor units** (cents for USD/EUR/GBP). **KRW and JPY have no minor
unit**, so `12000` means ₩12,000 / ¥12,000 — don't divide those by 100. Currency
codes are lowercase.

## Regenerating data

`npm run seed` regenerates `db.json` deterministically (same output every run).
Sandbox data is intentionally "test-looking" (e.g. card `last4 = 4242`, obvious test
customer names); Production data is more realistic. That gap is there on purpose, so
you have something concrete to differentiate visually between the two environments.
