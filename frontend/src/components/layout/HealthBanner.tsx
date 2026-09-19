import { Icon } from '@/components/common/Icon'
import { useHealth } from '@/hooks/useApi'
import { formatStaleness } from '@/lib/time'

/**
 * Renders nothing when healthy — this app stays quiet until there's something worth
 * saying. Contract §3: "Show a red warning when overdue === true." This is that warning,
 * mounted once in AppShell so it's visible from any page, not only the dashboard.
 */
export function HealthBanner() {
  const { data } = useHealth()
  if (!data?.overdue) return null

  return (
    <div className="border-b border-bad/25 bg-bad-dim animate-fade-up">
      <div className="mx-auto flex max-w-6xl items-center gap-2.5 px-5 py-2.5 text-sm text-bad">
        <Icon name="alertTriangle" size={15} className="shrink-0" />
        <span>
          No successful scrape in {formatStaleness(data.lastRunAt)} — the scheduler may be down.
        </span>
      </div>
    </div>
  )
}
