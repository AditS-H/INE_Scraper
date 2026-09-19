const formatterCache = new Map<string, Intl.NumberFormat>()

function currencyFormatter(currency: string): Intl.NumberFormat {
  const cached = formatterCache.get(currency)
  if (cached) return cached
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  formatterCache.set(currency, formatter)
  return formatter
}

/**
 * Formats a validated price. Deliberately takes `price: number | null` rather than
 * defaulting — per the contract, `null` means "no successful scrape yet", never `0`.
 * Callers must branch on null themselves rather than passing 0 through this.
 */
export function formatPrice(price: number | null | undefined, currency: string | null | undefined): string {
  if (price === null || price === undefined || !currency) return '—'
  try {
    return currencyFormatter(currency).format(price)
  } catch {
    return `${currency} ${price.toLocaleString('en-IN')}`
  }
}

export interface PriceDelta {
  direction: 'up' | 'down' | 'flat'
  text: string
}

/** "down 0.33% (₹50)" style summary for a price change, or null when there's nothing to compare. */
export function describeDelta(
  delta: number | null | undefined,
  percent: number | null | undefined,
  currency: string | null | undefined,
): PriceDelta | null {
  if (delta === null || delta === undefined || delta === 0) {
    return delta === 0 ? { direction: 'flat', text: 'unchanged' } : null
  }
  const direction = delta > 0 ? 'up' : 'down'
  const absDelta = formatPrice(Math.abs(delta), currency)
  const pct = percent !== null && percent !== undefined ? ` (${Math.abs(percent).toFixed(2)}%)` : ''
  return { direction, text: `${absDelta}${pct}` }
}
