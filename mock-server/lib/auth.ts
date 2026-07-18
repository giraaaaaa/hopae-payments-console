/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PROVIDED — authentication: login route + an auth guard for protecting other
 *  routes. You normally won't need to change this file (but you may — see
 *  server.ts — as long as you explain why in your README).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * It's deliberately minimal (a mock): one hard-coded user, an opaque string
 * token, no expiry. It exists so you have a realistic auth handshake to build
 * the rest of the app on top of.
 *
 *   POST /api/auth/login   { email, password }  ->  { token, user }
 *   requireAuth            Express middleware — rejects requests without an
 *                          `Authorization: Bearer <token>` header.
 *
 * Auth is intentionally minimal and not a focus of this assignment: just store
 * the token from login and send it back as an `Authorization: Bearer <token>`
 * header on your requests.
 */

import type { Express, RequestHandler } from 'express';

const VALID_USER = {
  id: 'usr_demo',
  name: 'Demo Merchant',
  email: 'demo@hopae.com',
  password: 'password123',
} as const;

function makeToken(userId: string): string {
  return `mock.${userId}.${Date.now()}`;
}

function isValidToken(token: string): boolean {
  return typeof token === 'string' && token.startsWith('mock.');
}

/** Express middleware: require an `Authorization: Bearer <token>` header. */
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.get('Authorization') || '';
  if (!header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  if (!isValidToken(header.slice(7))) {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  next();
};

/** Mount the auth routes on the given Express app. */
export function register(app: Express): void {
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = (req.body || {}) as {
      email?: string;
      password?: string;
    };
    if (email === VALID_USER.email && password === VALID_USER.password) {
      res.json({
        token: makeToken(VALID_USER.id),
        user: { id: VALID_USER.id, name: VALID_USER.name, email: VALID_USER.email },
      });
      return;
    }
    res.status(401).json({ error: 'Invalid email or password' });
  });
}

export { VALID_USER };
