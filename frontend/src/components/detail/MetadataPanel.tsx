import type { LatestPrice, TrackedProduct } from '@/api/types'
import { Icon } from '@/components/common/Icon'
import { formatIST } from '@/lib/time'

interface MetadataPanelProps {
  product: TrackedProduct
  latest: LatestPrice | null
}

/**
 * A label:value grid rather than a "Brand · Category · SKU" line — this panel has the
 * room to be a proper spec sheet, which reads more like an instrument readout than a
 * caption line and keeps each field individually scannable.
 */
export function MetadataPanel({ product, latest }: MetadataPanelProps) {
  const rows: { label: string; value: string }[] = []
  if (product.brand) rows.push({ label: 'Brand', value: product.brand })
  if (product.category) rows.push({ label: 'Category', value: product.category })
  rows.push({ label: 'Store ID', value: product.store_product_id })
  if (latest?.stock_qty !== null && latest?.stock_qty !== undefined) {
    rows.push({ label: 'Stock quantity', value: String(latest.stock_qty) })
  }
  rows.push({ label: 'Tracking since', value: formatIST(product.created_at) })
  rows.push({ label: 'Check interval', value: `${product.scrape_interval_min} min` })

  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-5">
      {product.description && <p className="text-sm leading-relaxed text-ink-2">{product.description}</p>}

      <dl
        className={
          product.description
            ? 'mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line-soft pt-4 text-sm sm:grid-cols-3'
            : 'grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3'
        }
      >
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="text-xs text-ink-3">{row.label}</dt>
            <dd className="mt-0.5 truncate font-mono text-ink-1">{row.value}</dd>
          </div>
        ))}
      </dl>

      {product.url && (
        <a
          href={product.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-signal-ink hover:underline"
        >
          View on store
          <Icon name="external" size={13} />
        </a>
      )}
    </div>
  )
}
