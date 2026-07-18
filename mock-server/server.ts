/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Mock API server for the take-home assignment — app wiring. READ THIS FIRST.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Which files are which:
 *
 *   PROVIDED (you normally won't change these):
 *     types.ts            shared data-model types for the seed data
 *     lib/auth.ts         POST /api/auth/login  +  a `requireAuth` guard
 *     lib/store.ts        the in-memory transaction data + a background timer
 *                         that evolves it (new transactions appear, `pending`
 *                         ones resolve)
 *     server.ts           this file — app wiring
 *     seed.ts             regenerates db.json
 *
 *   YOUR WORK:
 *     routes/transactions.ts   the list / refund endpoints — you design
 *                              the shape. Look for "START YOUR CODE HERE".
 *
 * You're free to modify ANY file, including the provided ones, if it makes for a
 * better implementation — just explain what and why in your project README.
 *
 * Written in TypeScript and run with tsx (no build step): `npm start`.
 * Built on json-server only for convenient defaults (CORS, logger, body
 * parser). Every route is hand-written; nothing is auto-generated.
 */

import jsonServer from 'json-server';

import * as store from './lib/store';
import * as auth from './lib/auth';
import * as transactions from './routes/transactions';

const server = jsonServer.create();
const middlewares = jsonServer.defaults({ logger: true });

// ---------------------------------------------------------------------------
// Middleware
//   - body parser (so POST bodies are available as req.body)
//   - a small artificial latency so loading states are visible in the UI
//   - json-server defaults (CORS, request logger, static, etc.)
// ---------------------------------------------------------------------------

server.use(jsonServer.bodyParser);
server.use((_req, _res, next) => {
  const ms = 120 + Math.floor(Math.random() * 220);
  setTimeout(next, ms);
});
server.use(middlewares);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

auth.register(server); // provided: POST /api/auth/login
transactions.register(server); // YOUR WORK: list / refund

// Catch-all 404 for anything unmatched.
server.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

// ---------------------------------------------------------------------------
// Start: background data evolution + HTTP server
// ---------------------------------------------------------------------------

const evolution = store.startDataEvolution();

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log('');
  console.log(`  Mock API server running at http://localhost:${PORT}`);
  console.log('');
  console.log('  Provided:');
  console.log('    POST /api/auth/login            (test login: demo@hopae.com / password123)');
  console.log('');
  console.log('  To implement (routes/transactions.ts — currently return 501):');
  console.log('    GET  /api/transactions          transactions list (your design)');
  console.log('    POST /api/transactions/:id/refund   refund (your design)');
  console.log('');
  if (evolution.intervalMs > 0) {
    console.log(`  Background data changes: every ${evolution.intervalMs} ms per env (set TICK_INTERVAL_MS=0 to freeze)`);
  } else {
    console.log('  Background data changes: DISABLED (TICK_INTERVAL_MS=0)');
  }
  console.log('');
});

process.on('SIGINT', () => {
  evolution.stop();
  process.exit(0);
});
