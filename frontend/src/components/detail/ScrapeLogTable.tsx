import { useState } from 'react'
import type { ScrapeLogItem } from '@/api/types'
import { Icon } from '@/components/common/Icon'
import { OutcomeBadge } from '@/components/common/OutcomeBadge'
import { cn } from '@/lib/cn'
import { formatDuration, formatIST } from '@/lib/time'
import { AttemptTrace } from './AttemptTrace'

function ScrapeLogRow({ log }: { log: ScrapeLogItem }) {
  const [expanded, setExpanded] = useState(false)
  const hasError = log.outcome === 'failed' && (log.error_code || log.error_message)

  return (
    <div className="border-b border-line-soft last:border-0">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 text-left transition-colors hover:bg-surface-2/50"
      >
        <Icon
          name="chevronDown"
          size={14}
          className={cn('shrink-0 text-ink-3 transition-transform', expanded && 'rotate-180')}
        />
        <span className="w-40 shrink-0 font-mono text-xs text-ink-3">{formatIST(log.started_at)}</span>
        <OutcomeBadge outcome={log.outcome} size="sm" />
        <span className="text-xs text-ink-3">
          {log.attempts} attempt{log.attempts === 1 ? '' : 's'}
        </span>
        <span className="text-xs capitalize text-ink-3">{log.strategy}</span>
        <span className="tabular ml-auto text-xs text-ink-3">{formatDuration(log.duration_ms)}</span>
      </button>

      {hasError && (
        <p className="px-4 pb-2.5 pl-11 font-mono text-xs text-bad">
          {log.error_code ? `${log.error_code}: ` : ''}
          {log.error_message ?? 'No message recorded.'}
        </p>
      )}

      {expanded && (
        <div className="px-4 pb-3.5 pl-11">
          <AttemptTrace trace={log.attempt_trace} />
        </div>
      )}
    </div>
  )
}

interface ScrapeLogTableProps {
  logs: ScrapeLogItem[]
}

export function ScrapeLogTable({ logs }: ScrapeLogTableProps) {
  if (logs.length === 0) {
    return <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-3">No scrape attempts logged yet.</p>
  }

  return (
    <div className="rounded-xl border border-line">
      {logs.map((log) => (
        <ScrapeLogRow key={log.id} log={log} />
      ))}
    </div>
  )
}
