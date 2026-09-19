import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HistoryRange } from '@/api/types'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { computeOutOfStockWindows, formatAxisTick, type ChartPoint } from '@/lib/chart'
import { formatPrice } from '@/lib/money'
import { formatIST } from '@/lib/time'
import { cn } from '@/lib/cn'

interface PriceChartProps {
  points: ChartPoint[]
  currency: string | null
  range: HistoryRange
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean
  payload?: { payload: ChartPoint }[]
  currency: string | null
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl shadow-black/50">
      <p className="font-mono text-sm font-medium text-ink-1">{formatPrice(point.price, currency)}</p>
      <p className="mt-1 text-ink-3">{formatIST(point.scrapedAt)}</p>
      <p className={cn('mt-0.5', point.inStock ? 'text-signal-ink' : 'text-ink-3')}>{point.stockStatus}</p>
    </div>
  )
}

export function PriceChart({ points, currency, range }: PriceChartProps) {
  const reducedMotion = usePrefersReducedMotion()
  const outOfStockWindows = computeOutOfStockWindows(points)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-line-soft)" vertical={false} />
        <XAxis
          dataKey="ts"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={(ts: number) => formatAxisTick(ts, range)}
          stroke="var(--color-line)"
          tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          dataKey="price"
          domain={['auto', 'auto']}
          tickFormatter={(price: number) => formatPrice(price, currency)}
          stroke="var(--color-line)"
          tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <Tooltip content={<ChartTooltip currency={currency} />} cursor={{ stroke: 'var(--color-line)' }} />
        {outOfStockWindows.map((window) => (
          <ReferenceArea
            key={window.x1}
            x1={window.x1}
            x2={window.x2}
            fill="var(--color-ink-3)"
            fillOpacity={0.1}
            stroke="none"
            ifOverflow="extendDomain"
          />
        ))}
        <Line
          type="stepAfter"
          dataKey="price"
          stroke="var(--color-signal)"
          strokeWidth={2}
          dot={{ r: 2.5, fill: 'var(--color-signal)', strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={!reducedMotion}
          animationDuration={500}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
