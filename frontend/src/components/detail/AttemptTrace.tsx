import type { AttemptTraceItem } from '@/api/types'
import { cn } from '@/lib/cn'

interface AttemptTraceProps {
  trace: AttemptTraceItem[]
}

/** Renders each attempt as one log line — matches the build spec's own trace notation (attempt → wait → attempt). */
export function AttemptTrace({ trace }: AttemptTraceProps) {
  if (trace.length === 0) {
    return <p className="text-xs text-ink-3">No per-attempt trace was recorded for this run.</p>
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-0 p-3 font-mono text-xs leading-relaxed">
      {trace.map((attempt) => (
        <div key={attempt.n} className="flex flex-wrap items-baseline gap-x-2.5">
          <span className="text-ink-3">#{attempt.n}</span>
          <span className={cn('font-medium', attempt.ok ? 'text-ok' : attempt.error ? 'text-bad' : 'text-ink-2')}>
            {attempt.ok ? 'ok' : (attempt.error ?? 'unknown')}
          </span>
          {attempt.status !== undefined && attempt.status !== null && (
            <span className="text-ink-3">HTTP {attempt.status}</span>
          )}
          <span className="text-ink-3">{attempt.ms}ms</span>
          {attempt.backoffMs !== undefined && <span className="text-ink-3">→ waited {attempt.backoffMs}ms</span>}
        </div>
      ))}
    </div>
  )
}
