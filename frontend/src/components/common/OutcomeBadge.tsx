import type { ScrapeOutcome } from '@/api/types'
import { cn } from '@/lib/cn'

interface OutcomeBadgeProps {
  outcome: ScrapeOutcome | null
  size?: 'sm' | 'md'
}

const CONFIG: Record<
  'success' | 'retried' | 'failed' | 'pending',
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  success: {
    label: 'Success',
    dot: 'bg-ok',
    text: 'text-ok',
    bg: 'bg-ok-dim',
    border: 'border-ok/25',
  },
  retried: {
    label: 'Retried',
    dot: 'bg-warn',
    text: 'text-warn',
    bg: 'bg-warn-dim',
    border: 'border-warn/25',
  },
  failed: {
    label: 'Failed',
    dot: 'bg-bad',
    text: 'text-bad',
    bg: 'bg-bad-dim',
    border: 'border-bad/25',
  },
  pending: {
    label: 'Not scraped yet',
    dot: 'bg-ink-3',
    text: 'text-ink-2',
    bg: 'bg-surface-2',
    border: 'border-line',
  },
}

/** The one place outcome → color is decided. Never soften `failed` — the contract is explicit about this. */
export function OutcomeBadge({ outcome, size = 'md' }: OutcomeBadgeProps) {
  const config = CONFIG[outcome ?? 'pending']
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        config.bg,
        config.text,
        config.border,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', config.dot)} />
      {config.label}
    </span>
  )
}
