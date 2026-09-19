import { Link } from 'react-router-dom'
import type { TrackedProduct } from '@/api/types'
import { Icon } from '@/components/common/Icon'
import { OutcomeBadge } from '@/components/common/OutcomeBadge'
import { PriceDelta } from '@/components/common/PriceDelta'
import { StockPill } from '@/components/common/StockPill'
import { useCountUp } from '@/hooks/useCountUp'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/money'
import { formatRelative } from '@/lib/time'
import { initials } from '@/lib/text'
import { Sparkline } from './Sparkline'

interface ProductCardProps {
  product: TrackedProduct
}

export function ProductCard({ product }: ProductCardProps) {
  const animatedPrice = useCountUp(product.last_price)
  const hasScraped = product.last_scrape_at !== null
  const hasPrice = product.last_price !== null

  return (
    <Link
      to={`/p/${product.id}`}
      className="group flex flex-col gap-4 rounded-2xl border border-line bg-surface-1 p-5 transition-colors hover:border-signal/40"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3 font-mono text-xs font-medium text-ink-2">
          {initials(product.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[0.9375rem] font-medium text-ink-1 group-hover:text-signal-ink">
            {product.name}
          </h3>
          {product.category && <p className="truncate text-xs text-ink-3">{product.category}</p>}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          {hasPrice ? (
            <>
              <p className="tabular font-mono text-2xl font-semibold text-ink-1">
                {formatPrice(animatedPrice, product.last_currency)}
              </p>
              <div className="mt-1">
                <PriceDelta
                  delta={product.price_delta}
                  percent={product.price_delta_percent}
                  currency={product.last_currency}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-3">{hasScraped ? 'No successful scrape yet' : 'First scrape scheduled'}</p>
          )}
        </div>
        <Sparkline points={product.history_24h} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <StockPill inStock={product.last_in_stock} />
        <OutcomeBadge outcome={product.last_outcome} size="sm" />
      </div>

      <div className="flex items-center justify-between border-t border-line-soft pt-3 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <Icon name="clock" size={12} />
          Next check {formatRelative(product.next_due_at)}
        </span>
        {product.consecutive_failures > 0 && (
          <span className={cn('font-medium text-warn')}>{product.consecutive_failures} failures in a row</span>
        )}
      </div>
    </Link>
  )
}
