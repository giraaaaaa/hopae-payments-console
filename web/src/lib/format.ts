/** Compact count for tight UI (filter tabs): 15514 → "15.5K", 3 → "3". */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n)
}
