/**
 * PROVIDED — minimal ambient types for `json-server` (0.17.x ships none).
 *
 * Only the handful of helpers this server actually uses are declared, just
 * enough for `npm run typecheck` to pass. json-server is built on Express, so
 * `create()` returns a normal Express app.
 */
declare module 'json-server' {
  import type { Express, RequestHandler } from 'express';

  export function create(): Express;
  export function defaults(opts?: {
    logger?: boolean;
    static?: string;
    bodyParser?: boolean;
    noCors?: boolean;
    readOnly?: boolean;
  }): RequestHandler[];
  export const bodyParser: RequestHandler;
  export function router(source: string | object): RequestHandler;
}
