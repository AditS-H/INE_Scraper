import type { HistoryRange } from '@/api/types'
import { HISTORY_RANGES } from '@/lib/constants'
import { cn } from '@/lib/cn'

interface RangeToggleProps {
  value: HistoryRange
  onChange: (range: HistoryRange) => void
}

const LABELS: Record<HistoryRange, string> = { '24h': '24h', '7d': '7d', '30d': '30d', all: 'All' }

export function RangeToggle({ value, onChange }: RangeToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface-1 p-0.5" role="tablist" aria-label="History range">
      {HISTORY_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          role="tab"
          aria-selected={value === range}
          onClick={() => onChange(range)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            value === range ? 'bg-surface-3 text-ink-1' : 'text-ink-3 hover:text-ink-1',
          )}
        >
          {LABELS[range]}
        </button>
      ))}
    </div>
  )
}
