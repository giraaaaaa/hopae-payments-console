import { describe, expect, it } from 'vitest'
import { formatCount } from './format'

describe('formatCount', () => {
  it('keeps small counts exact', () => {
    expect(formatCount(3)).toBe('3')
    expect(formatCount(91)).toBe('91')
    expect(formatCount(999)).toBe('999')
  })

  it('compacts thousands', () => {
    expect(formatCount(15514)).toBe('15.5K')
    expect(formatCount(12155)).toBe('12.2K')
    expect(formatCount(1000)).toBe('1K')
  })
})
