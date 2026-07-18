/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PROVIDED — shared data-model types for the seed data and the in-memory store.
 *  You normally won't need to change this file, but you may (see server.ts).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * These types describe the *data* that already exists in db.json — nothing more.
 * They are intentionally NOT an API contract: the shape of your list/detail/
 * refund responses, your pagination params, and how you model a refund are part
 * of what you design in `routes/transactions.ts`. Keep those types next to your
 * own code.
 */

/** The two environments the data and the store are partitioned by. */
export type Env = 'sandbox' | 'production';

/** A transaction's lifecycle status. */
export type TxStatus = 'succeeded' | 'pending' | 'failed' | 'refunded';

/** Event types that appear in a transaction's timeline. */
export type TxEventType =
  | 'created'
  | 'authorized'
  | 'captured'
  | 'authorization_failed'
  | 'refunded';

/** Lowercase ISO currency codes present in the seed data. */
export type Currency = 'usd' | 'eur' | 'gbp' | 'krw' | 'jpy';

/** Card brands present in the seed data. */
export type CardBrand = 'visa' | 'mastercard' | 'amex';

export interface TxEvent {
  type: TxEventType;
  /** ISO-8601 timestamp. */
  at: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
}

export interface PaymentMethod {
  type: 'card';
  brand: CardBrand;
  last4: string;
  /** 1–12 */
  exp_month: number;
  exp_year: number;
}

export interface TransactionMetadata {
  order_id: string;
  /** Present only when status is 'failed'. */
  failure_reason?: string;
}

/** A single transaction, exactly as stored in db.json (and the in-memory store). */
export interface Transaction {
  id: string;
  /** Integer, in MINOR units (cents). KRW/JPY have no minor unit. */
  amount: number;
  currency: Currency;
  status: TxStatus;
  customer: Customer;
  payment_method: PaymentMethod;
  /** Ordered lifecycle; drives the detail timeline. */
  events: TxEvent[];
  metadata: TransactionMetadata;
  /** ISO-8601 timestamp. */
  created_at: string;
}
