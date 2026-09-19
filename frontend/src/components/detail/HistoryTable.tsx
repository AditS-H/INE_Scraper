import type { PriceHistoryItem } from '@/api/types'
import { formatPrice } from '@/lib/money'
import { formatIST } from '@/lib/time'
import { cn } from '@/lib/cn'

interface HistoryTableProps {
  items: PriceHistoryItem[]
}

export function HistoryTable({ items }: HistoryTableProps) {
  const rows = [...items].sort((a, b) => new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime())

  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surface-1 text-left text-xs text-ink-3">
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Scraped at</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Price</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Stock</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Strategy</th>
            <th className="whitespace-nowrap px-4 py-2.5 font-medium">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line-soft last:border-0">
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-2">{formatIST(row.scraped_at)}</td>
              <td className="tabular whitespace-nowrap px-4 py-2.5 font-mono text-ink-1">
                {formatPrice(row.price, row.currency)}
              </td>
              <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{row.stock_status}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-ink-3">{row.strategy}</td>
              <td
                className={cn(
                  'whitespace-nowrap px-4 py-2.5 capitalize',
                  row.confidence === 'low' ? 'text-warn' : 'text-ink-3',
                )}
              >
                {row.confidence}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
