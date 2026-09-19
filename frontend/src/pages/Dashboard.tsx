import { useOutletContext } from 'react-router-dom'
import { isNotImplemented } from '@/api/types'
import type { AppOutletContext } from '@/components/layout/AppShell'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Icon } from '@/components/common/Icon'
import { NotBuiltYet } from '@/components/common/NotBuiltYet'
import { SkeletonCard } from '@/components/common/Skeleton'
import { ProductCard } from '@/components/dashboard/ProductCard'
import { useHealth, useTrackedProducts } from '@/hooks/useApi'
import { formatRelative } from '@/lib/time'

function RunSummaryStrip() {
  const { data: health } = useHealth()
  if (!health?.lastRunCounts) return null

  const { total, success, retried, failed } = health.lastRunCounts
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-line bg-surface-1 px-5 py-3.5 text-sm">
      <span className="flex items-center gap-1.5 text-ink-2">
        <Icon name="clock" size={13} />
        Last run {formatRelative(health.lastRunAt)}
      </span>
      <span className="text-ink-3">{total} products scraped</span>
      <span className="flex items-center gap-1.5 text-ok">
        <span className="h-1.5 w-1.5 rounded-full bg-ok" />
        {success} success
      </span>
      {retried > 0 && (
        <span className="flex items-center gap-1.5 text-warn">
          <span className="h-1.5 w-1.5 rounded-full bg-warn" />
          {retried} retried
        </span>
      )}
      {failed > 0 && (
        <span className="flex items-center gap-1.5 text-bad">
          <span className="h-1.5 w-1.5 rounded-full bg-bad" />
          {failed} failed
        </span>
      )}
    </div>
  )
}

export function Dashboard() {
  const { openSearch } = useOutletContext<AppOutletContext>()
  const tracked = useTrackedProducts()

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink-1">Tracked products</h1>
          <p className="mt-0.5 text-sm text-ink-2">Prices and stock, scraped every two hours.</p>
        </div>
        <button
          type="button"
          onClick={openSearch}
          className="hidden items-center gap-1.5 rounded-lg bg-signal px-3.5 py-2 text-sm font-medium text-surface-0 transition-transform active:scale-95 sm:flex"
        >
          <Icon name="plus" size={15} />
          Track a product
        </button>
      </div>

      <RunSummaryStrip />

      {tracked.isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {tracked.isError && isNotImplemented(tracked.error) && (
        <NotBuiltYet
          endpoint="GET /api/tracked"
          note="Tracking a product still works — it just won't show up in this grid until the list route ships."
        />
      )}

      {tracked.isError && !isNotImplemented(tracked.error) && (
        <ErrorState
          message={tracked.error instanceof Error ? tracked.error.message : 'Could not load tracked products.'}
          onRetry={() => tracked.refetch()}
        />
      )}

      {tracked.isSuccess && tracked.data.items.length === 0 && (
        <EmptyState
          icon="inbox"
          title="No products tracked yet"
          description="Search the store and track a product to start watching its price."
          action={
            <button
              type="button"
              onClick={openSearch}
              className="mt-1 flex items-center gap-1.5 rounded-lg bg-signal px-3.5 py-2 text-sm font-medium text-surface-0"
            >
              <Icon name="plus" size={15} />
              Track a product
            </button>
          }
        />
      )}

      {tracked.isSuccess && tracked.data.items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tracked.data.items.map((product, index) => (
            <div key={product.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
