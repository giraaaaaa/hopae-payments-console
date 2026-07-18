/**
 * Amounts from the API are integers in MINOR units. KRW and JPY are
 * zero-decimal currencies: `12000` already means ₩12,000 / ¥12,000.
 */

export type Currency = 'usd' | 'eur' | 'gbp' | 'krw' | 'jpy'

const ZERO_DECIMAL: ReadonlySet<string> = new Set(['krw', 'jpy'])

/** Convert an API minor-unit amount to a major-unit number. */
export function toMajorUnits(amount: number, currency: Currency): number {
  return ZERO_DECIMAL.has(currency) ? amount : amount / 100
}

/** Format a minor-unit amount as a localized currency string, e.g. "$1,250.00". */
export function formatAmount(
  amount: number,
  currency: Currency,
  locale = 'en-US',
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(toMajorUnits(amount, currency))
}
