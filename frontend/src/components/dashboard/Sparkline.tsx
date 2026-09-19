import type { MiniHistoryPoint } from '@/api/types'

interface SparklineProps {
  points: MiniHistoryPoint[] | undefined
  width?: number
  height?: number
}

/**
 * Step-after, same as the full price chart (contract §9: "step-after chart because
 * observations are discrete samples") — a smoothed curve here would visually imply
 * continuous data the scraper never actually collected.
 */
export function Sparkline({ points, width = 108, height = 30 }: SparklineProps) {
  if (!points || points.length < 2) {
    return (
      <div className="flex h-[30px] items-center text-xs text-ink-3" style={{ width }}>
        Not enough data yet
      </div>
    )
  }

  const prices = points.map((p) => p.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pad = 3
  const stepX = width / (points.length - 1)
  const yFor = (price: number) => height - pad - ((price - min) / range) * (height - pad * 2)

  let d = `M0,${yFor(prices[0])}`
  for (let i = 1; i < points.length; i++) {
    const x = i * stepX
    d += ` L${x},${yFor(prices[i - 1])} L${x},${yFor(prices[i])}`
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={d} fill="none" className="stroke-signal" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={width} cy={yFor(prices[prices.length - 1])} r={2.25} className="fill-signal" />
    </svg>
  )
}
