import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isNotImplemented } from '@/api/types'
import type { HistoryRange } from '@/api/types'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Icon } from '@/components/common/Icon'
import { NotBuiltYet } from '@/components/common/NotBuiltYet'
import { OutcomeBadge } from '@/components/common/OutcomeBadge'
import { PriceDelta } from '@/components/common/PriceDelta'
import { SkeletonBlock } from '@/components/common/Skeleton'
import { StockPill } from '@/components/common/StockPill'
import { HistoryTable } from '@/components/detail/HistoryTable'
import { MetadataPanel } from '@/components/detail/MetadataPanel'
import { PriceChart } from '@/components/detail/PriceChart'
import { ProductActions } from '@/components/detail/ProductActions'
import { RangeToggle } from '@/components/detail/RangeToggle'
import { ScrapeLogTable } from '@/components/detail/ScrapeLogTable'
import { BOOST_INTERVAL_MS, useHistory, useLogs, useManualScrape, useTrackedDetail, useTrackedProducts } from '@/hooks/useApi'
import { POLL_INTERVAL_MS } from '@/lib/constants'
import { toChartPoints } from '@/lib/chart'
import { useCountUp } from '@/hooks/useCountUp'
import { formatPrice } from '@/lib/money'
import { initials } from '@/lib/text'
import { cn } from '@/lib/cn'

export function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const [range, setRange] = useState<HistoryRange>('24h')
  const [view, setView] = useState<'chart' | 'table'>('chart')

  const manualScrape = useManualScrape(id ?? '')
  const pollInterval = manualScrape.boosted ? BOOST_INTERVAL_MS : POLL_INTERVAL_MS

  const detail = useTrackedDetail(id, pollInterval)
  const history = useHistory(id, range, pollInterval)
  const logs = useLogs(id, pollInterval)

  // If GET /api/tracked/:id 404s, fall back to this product's row from the dashboard list
  // query (if it's cached) so the page still renders instead of going fully blank.
  const trackedList = useTrackedProducts()
  const fallbackProduct = trackedList.data?.items.find((item) => item.id === id)
  const product = detail.data?.product ?? fallbackProduct
  const latest = detail.data?.latest ?? null

  const currentPrice = latest?.price ?? product?.last_price ?? null
  const currentCurrency = latest?.currency ?? product?.last_currency ?? null
  const animatedPrice = useCountUp(currentPrice)

  return (
    <div className="flex flex-col gap-6">
      <Link to="/" className="inline-flex w-fit items-center gap-1.5 text-sm text-ink-3 transition-colors hover:text-ink-1">
        <Icon name="chevronDown" size={13} className="rotate-90" />
        Back to dashboard
      </Link>

      {!product && (detail.isLoading || trackedList.isLoading) && (
        <div className="rounded-2xl border border-line bg-surface-1 p-5">
          <SkeletonBlock className="h-6 w-1/3" />
          <SkeletonBlock className="mt-3 h-9 w-1/4" />
        </div>
      )}

      {!product && detail.isError && isNotImplemented(detail.error) && (
        <NotBuiltYet
          endpoint="GET /api/tracked/:id"
          note="Metadata, current price, and actions for this product will appear here once it's live."
        />
      )}

      {!product && detail.isError && !isNotImplemented(detail.error) && (
        <ErrorState
          message={detail.error instanceof Error ? detail.error.message : 'Could not load this product.'}
          onRetry={() => detail.refetch()}
        />
      )}

      {product && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-3 font-mono text-sm font-medium text-ink-2">
                {initials(product.name)}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-ink-1">{product.name}</h1>
                {product.category && <p className="text-sm text-ink-3">{product.category}</p>}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <StockPill inStock={latest?.in_stock ?? product.last_in_stock} stockStatus={latest?.stock_status} />
                <OutcomeBadge outcome={product.last_outcome} />
              </div>
              {currentPrice !== null ? (
                <div className="text-right">
                  <p className="tabular font-mono text-2xl font-semibold text-ink-1">
                    {formatPrice(animatedPrice, currentCurrency)}
                  </p>
                  <PriceDelta
                    delta={product.price_delta}
                    percent={product.price_delta_percent}
                    currency={currentCurrency}
                  />
                </div>
              ) : (
                <p className="text-sm text-ink-3">
                  {product.last_scrape_at ? 'No successful scrape yet' : 'First scrape scheduled'}
                </p>
              )}
            </div>
          </div>

          <MetadataPanel product={product} latest={latest} />
          <ProductActions product={product} manualScrape={manualScrape} />
        </>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-medium text-ink-1">Price &amp; stock history</h2>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-line bg-surface-1 p-0.5">
              <button
                type="button"
                onClick={() => setView('chart')}
                aria-label="Chart view"
                className={cn('rounded-md p-1.5 transition-colors', view === 'chart' ? 'bg-surface-3 text-ink-1' : 'text-ink-3')}
              >
                <Icon name="chartView" size={14} />
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                aria-label="Table view"
                className={cn('rounded-md p-1.5 transition-colors', view === 'table' ? 'bg-surface-3 text-ink-1' : 'text-ink-3')}
              >
                <Icon name="tableView" size={14} />
              </button>
            </div>
            <RangeToggle value={range} onChange={setRange} />
          </div>
        </div>

        {history.isLoading && <SkeletonBlock className="h-[280px] w-full rounded-2xl" />}

        {history.isError && isNotImplemented(history.error) && (
          <NotBuiltYet endpoint="GET /api/tracked/:id/history" />
        )}

        {history.isError && !isNotImplemented(history.error) && (
          <ErrorState
            message={history.error instanceof Error ? history.error.message : 'Could not load price history.'}
            onRetry={() => history.refetch()}
          />
        )}

        {history.isSuccess && history.data.items.length === 0 && (
          <EmptyState
            icon="chartView"
            title="No successful scrapes in this range"
            description="Once a scrape succeeds, its price and stock will show up here — try a wider range or check back after the next run."
          />
        )}

        {history.isSuccess && history.data.items.length > 0 && (
          <div className="rounded-2xl border border-line bg-surface-1 p-4">
            {view === 'chart' ? (
              <PriceChart
                points={toChartPoints(history.data.items)}
                currency={history.data.items[0]?.currency ?? currentCurrency}
                range={range}
              />
            ) : (
              <HistoryTable items={history.data.items} />
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium text-ink-1">Scrape log</h2>

        {logs.isLoading && (
          <div className="flex flex-col gap-2">
            <SkeletonBlock className="h-11 w-full rounded-xl" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
          </div>
        )}

        {logs.isError && isNotImplemented(logs.error) && <NotBuiltYet endpoint="GET /api/tracked/:id/logs" />}

        {logs.isError && !isNotImplemented(logs.error) && (
          <ErrorState
            message={logs.error instanceof Error ? logs.error.message : 'Could not load the scrape log.'}
            onRetry={() => logs.refetch()}
          />
        )}

        {logs.isSuccess && <ScrapeLogTable logs={logs.data.items} />}
      </section>
    </div>
  )
}
