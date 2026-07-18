/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  YOUR WORK — design and implement the transaction APIs in this file.       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * This is the one file you're expected to build. Everything else in
 * `mock-server/` is PROVIDED (auth + the data store + the background engine)
 * and already works — read it, but you won't usually need to change it.
 * (You CAN change any provided file if your design is better; just say why in
 * your README.)
 *
 * What you can read / write — the in-memory store (see `lib/store.ts`):
 *
 *     import { transactions } from '../lib/store';
 *     transactions.sandbox      // Transaction[] (newest first)
 *     transactions.production   // Transaction[] (newest first)
 *
 * The `Transaction` shape is in `../types` (and documented in
 * `mock-server/README.md`). The store mutates in the background, so whatever
 * you build here will see new transactions appear and `pending` ones resolve
 * over time.
 *
 * ── Endpoints to design (shape, naming, and semantics are YOUR call) ─────────
 *
 *   • LIST     — the transactions table. You decide the route shape, how the client
 *                selects the environment, pagination, and the response fields.
 *                Status filter and search (by transaction id and customer email)
 *                are list features.
 *   • REFUND   — a WRITE that records a refund (triggered from the list, e.g. a
 *                per-row action). How you model it — in the data, the list, and
 *                the API — is your call.
 *
 * Whatever you decide, write down the reasoning in your project README — the
 * API design is part of what's being evaluated, not just the UI.
 *
 * The LIST endpoint below ships a minimal default (returns the full list) so the
 * server boots and you can see how to read the data — replace it with your design.
 * REFUND is yours to build. Feel free to change the routes entirely.
 */

import type { Express } from 'express';
import { transactions, isValidEnv } from '../lib/store';
import { requireAuth } from '../lib/auth';

/** Mount the transaction routes on the given Express app. */
export function register(app: Express): void {
  // ╭──────────────────────────────────────────────────────────────────────╮
  // │  START YOUR CODE HERE                                                  │
  // │  LIST ships a minimal default so the app runs and you can see how to   │
  // │  read the data. Replace / extend it — and build the REFUND endpoint.   │
  // ╰──────────────────────────────────────────────────────────────────────╯

  // List of transactions — DEFAULT (minimal): returns the full list for one
  // environment straight from the store, so you can see how the data is read.
  // No pagination, filtering, search, or env design yet — that's your job.
  // Replace this with your own implementation.
  app.get('/api/transactions', requireAuth, (req, res) => {
    const env = isValidEnv(req.query.env) ? req.query.env : 'sandbox';
    res.json(transactions[env]);
  });

  // Refund — NOT implemented yet. The spec requires refunding a transaction
  // (triggered from the list). Build it here: the route shape, how you model the
  // refund in the data, and what you return.
  //   e.g. app.post('/api/transactions/:id/refund', requireAuth, (req, res) => { ... });

  // ╰── END: everything above is yours to replace / build out ───────────────╯
}
