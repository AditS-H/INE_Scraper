import { describeDelta } from '@/lib/money'
import { cn } from '@/lib/cn'
import { Icon } from './Icon'

interface PriceDeltaProps {
  delta: number | null | undefined
  percent: number | null | undefined
  currency: string | null | undefined
}

/**
 * Deliberately does not borrow red/green from the outcome badge — that palette means
 * "did the scrape work," not "did the price move." A drop leans toward the signal/ok
 * hues (good news for someone watching a price), a rise stays neutral ink. Red is
 * reserved for `failed` scrapes only, everywhere in this app.
 */
export function PriceDelta({ delta, percent, currency }: PriceDeltaProps) {
  const described = describeDelta(delta, percent, currency)
  if (!described) return null

  if (described.direction === 'flat') {
    return (
      <span className="inline-flex items-center gap-1 text-sm text-ink-3">
        <Icon name="minus" size={13} />
        Unchanged
      </span>
    )
  }

  const isDrop = described.direction === 'down'
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm font-medium tabular', isDrop ? 'text-ok' : 'text-ink-2')}>
      <Icon name={isDrop ? 'arrowDown' : 'arrowUp'} size={13} />
      {described.text}
    </span>
  )
}
