import { Icon } from './Icon'
import { cn } from '@/lib/cn'

interface StockPillProps {
  inStock: boolean | null
  stockStatus?: string | null
}

/**
 * Stock is rendered independently from scrape outcome (contract §21) — it deliberately
 * does not reuse the green/amber/red outcome palette, so "out of stock" (a legitimate,
 * successfully-scraped fact) can never read as "the scrape failed."
 */
export function StockPill({ inStock, stockStatus }: StockPillProps) {
  if (inStock === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-sm text-ink-3">
        <Icon name="box" size={13} />
        Stock unknown
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm',
        inStock ? 'border-signal/25 bg-signal-dim text-signal-ink' : 'border-line bg-surface-2 text-ink-2',
      )}
    >
      <Icon name="box" size={13} />
      {stockStatus || (inStock ? 'In stock' : 'Out of stock')}
    </span>
  )
}
