import type { ReactNode } from 'react'
import { isNotImplemented } from '@/api/types'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Icon, type IconName } from '@/components/common/Icon'
import { NotBuiltYet } from '@/components/common/NotBuiltYet'
import { SkeletonBlock } from '@/components/common/Skeleton'
import { useHealth, useRuns } from '@/hooks/useApi'
import { cn } from '@/lib/cn'
import { formatDuration, formatIST, formatRelative } from '@/lib/time'

function StatCard({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: IconName
  label: string
  value: ReactNode
  tone?: 'default' | 'ok' | 'bad' | 'warn'
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface-1 p-4">
      <div className="flex items-center gap-1.5 text-xs text-ink-3">
        <Icon name={icon} size={13} />
        {label}
      </div>
      <p
        className={cn(
          'mt-1.5 text-lg font-semibold',
          tone === 'ok' && 'text-ok',
          tone === 'bad' && 'text-bad',
          tone === 'warn' && 'text-warn',
          tone === 'default' && 'text-ink-1',
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function Health() {
  const health = useHealth()
  const runs = useRuns()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-1">Health</h1>
        <p className="mt-0.5 text-sm text-ink-2">Backend status and recent scrape runs, refreshed every minute.</p>
      </div>

      {health.isError && (
        <ErrorState
          message={health.error instanceof Error ? health.error.message : 'Could not reach the backend.'}
          onRetry={() => health.refetch()}
        />
      )}

      {health.isSuccess && health.data.databaseConfigured === false && (
        <div className="rounded-2xl border border-warn/25 bg-warn-dim px-5 py-3.5 text-sm text-warn">
          The backend is running but its database isn't configured — set SUPABASE_URL and
          SUPABASE_SERVICE_KEY on Render.
        </div>
      )}

      {health.isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SkeletonBlock className="h-20 rounded-2xl" />
          <SkeletonBlock className="h-20 rounded-2xl" />
          <SkeletonBlock className="h-20 rounded-2xl" />
          <SkeletonBlock className="h-20 rounded-2xl" />
        </div>
      )}

      {health.isSuccess && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon="box"
            label="Backend"
            value={health.data.ok ? 'Online' : 'Unreachable'}
            tone={health.data.ok ? 'ok' : 'bad'}
          />
          <StatCard icon="clock" label="Last run" value={formatRelative(health.data.lastRunAt)} />
          <StatCard
            icon="alertTriangle"
            label="Overdue"
            value={health.data.overdue ? 'Yes' : 'No'}
            tone={health.data.overdue ? 'bad' : 'ok'}
          />
          <StatCard
            icon="sliders"
            label="Uptime"
            value={health.data.uptimeSec ? formatDuration(health.data.uptimeSec * 1000) : '—'}
          />
        </div>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium text-ink-1">Recent runs</h2>

        {runs.isLoading && (
          <div className="flex flex-col gap-2">
            <SkeletonBlock className="h-11 w-full rounded-xl" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
            <SkeletonBlock className="h-11 w-full rounded-xl" />
          </div>
        )}

        {runs.isError && isNotImplemented(runs.error) && (
          <NotBuiltYet endpoint="GET /api/runs" note="Each cron-triggered run will be listed here once it ships." />
        )}

        {runs.isError && !isNotImplemented(runs.error) && (
          <ErrorState
            message={runs.error instanceof Error ? runs.error.message : 'Could not load run history.'}
            onRetry={() => runs.refetch()}
          />
        )}

        {runs.isSuccess && runs.data.items.length === 0 && (
          <EmptyState icon="clock" title="No runs recorded yet" description="Once cron-job.org fires the first scrape, it will show up here." />
        )}

        {runs.isSuccess && runs.data.items.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-1 text-left text-xs text-ink-3">
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Started</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Trigger</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Duration</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium">Total</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-ok">Success</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-warn">Retried</th>
                  <th className="whitespace-nowrap px-4 py-2.5 font-medium text-bad">Failed</th>
                </tr>
              </thead>
              <tbody>
                {runs.data.items.map((run) => {
                  const durationMs = run.finished_at
                    ? new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()
                    : null
                  return (
                    <tr key={run.id} className="border-b border-line-soft last:border-0">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-2">
                        {formatIST(run.started_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 capitalize text-ink-2">{run.trigger}</td>
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-ink-2">
                        {durationMs !== null ? formatDuration(durationMs) : 'in progress'}
                      </td>
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-ink-1">{run.total}</td>
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-ok">{run.success}</td>
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-warn">{run.retried}</td>
                      <td className="tabular whitespace-nowrap px-4 py-2.5 text-bad">{run.failed}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
