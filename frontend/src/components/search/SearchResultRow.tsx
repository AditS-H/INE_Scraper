import type { StoreProduct } from '@/api/types'
import { Icon } from '@/components/common/Icon'
import { Spinner } from '@/components/common/Spinner'
import { initials } from '@/lib/text'
import { cn } from '@/lib/cn'

interface SearchResultRowProps {
  product: StoreProduct
  isTracked: boolean
  isPending: boolean
  onTrack: () => void
}

export function SearchResultRow({ product, isTracked, isPending, onTrack }: SearchResultRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 font-mono text-xs font-medium text-ink-2">
        {initials(product.name)}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink-1">{product.name}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
          <span className="rounded bg-surface-3 px-1.5 py-0.5 text-ink-2">{product.category}</span>
          <span className="truncate">
            {product.brand} · {product.sku}
          </span>
        </p>
      </div>

      <button
        type="button"
        onClick={onTrack}
        disabled={isTracked || isPending}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          isTracked
            ? 'cursor-default bg-surface-2 text-ink-3'
            : 'bg-signal text-surface-0 hover:bg-signal/90 active:scale-95 disabled:opacity-60',
        )}
      >
        {isPending ? (
          <Spinner size={13} />
        ) : isTracked ? (
          <Icon name="check" size={13} />
        ) : (
          <Icon name="plus" size={13} />
        )}
        {isTracked ? 'Tracking' : 'Track'}
      </button>
    </div>
  )
}
