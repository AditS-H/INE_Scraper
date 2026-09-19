import type { HistoryRange, PriceHistoryItem } from '@/api/types'

export interface ChartPoint {
  ts: number
  price: number
  inStock: boolean
  stockStatus: string
  scrapedAt: string
}

/** Ascending by scraped_at, per contract §9's recommended sort order for chart rendering. */
export function toChartPoints(items: PriceHistoryItem[]): ChartPoint[] {
  return [...items]
    .sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime())
    .map((item) => ({
      ts: new Date(item.scraped_at).getTime(),
      price: item.price,
      inStock: item.in_stock,
      stockStatus: item.stock_status,
      scrapedAt: item.scraped_at,
    }))
}

/**
 * Contiguous out-of-stock runs, as [start, end] timestamps, for ReferenceArea shading.
 * A single-sample run is padded so it's visible rather than a zero-width sliver.
 */
export function computeOutOfStockWindows(points: ChartPoint[]): { x1: number; x2: number }[] {
  const windows: { x1: number; x2: number }[] = []
  let runStart: number | null = null
  let runEnd: number | null = null

  for (const point of points) {
    if (!point.inStock) {
      if (runStart === null) runStart = point.ts
      runEnd = point.ts
    } else if (runStart !== null && runEnd !== null) {
      windows.push({ x1: runStart, x2: runEnd })
      runStart = null
      runEnd = null
    }
  }
  if (runStart !== null && runEnd !== null) windows.push({ x1: runStart, x2: runEnd })

  const MIN_WIDTH_MS = 20 * 60 * 1000
  return windows.map((w) => (w.x1 === w.x2 ? { x1: w.x1, x2: w.x2 + MIN_WIDTH_MS } : w))
}

const dayMonth = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })
const timeOnly = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })

/** Compact axis label — just a time for short ranges, day+time once the range spans multiple days. */
export function formatAxisTick(ts: number, range: HistoryRange): string {
  const date = new Date(ts)
  if (range === '24h') return timeOnly.format(date)
  return dayMonth.format(date)
}
