import { describe, expect, it } from 'vitest'
import { formatAmount, toMajorUnits } from './money'

describe('toMajorUnits', () => {
  it('divides cent-based currencies by 100', () => {
    expect(toMajorUnits(125000, 'usd')).toBe(1250)
    expect(toMajorUnits(99, 'eur')).toBe(0.99)
    expect(toMajorUnits(5000, 'gbp')).toBe(50)
  })

  it('keeps zero-decimal currencies as-is (KRW/JPY have no minor unit)', () => {
    expect(toMajorUnits(12000, 'krw')).toBe(12000)
    expect(toMajorUnits(2150, 'jpy')).toBe(2150)
  })
})

describe('formatAmount', () => {
  it('formats cent-based currencies with two decimals', () => {
    expect(formatAmount(125000, 'usd')).toBe('$1,250.00')
    expect(formatAmount(4800, 'usd')).toBe('$48.00')
    expect(formatAmount(20250, 'gbp')).toBe('£202.50')
  })

  it('formats zero-decimal currencies without dividing or decimals', () => {
    expect(formatAmount(12000, 'krw')).toBe('₩12,000')
    expect(formatAmount(2150, 'jpy')).toBe('¥2,150')
  })
})
