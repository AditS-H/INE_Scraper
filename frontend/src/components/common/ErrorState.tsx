import { Icon } from './Icon'
import { cn } from '@/lib/cn'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
  compact?: boolean
}

export function ErrorState({ message, onRetry, compact }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-xl border border-bad/25 bg-bad-dim text-center',
        compact ? 'p-5' : 'p-10',
      )}
    >
      <Icon name="alertTriangle" size={compact ? 18 : 22} className="text-bad" />
      <p className="max-w-sm text-sm text-ink-2">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink-1 transition-colors hover:border-bad/40 hover:text-bad"
        >
          Try again
        </button>
      )}
    </div>
  )
}
