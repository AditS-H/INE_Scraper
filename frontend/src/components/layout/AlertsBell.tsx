import { useState } from 'react'
import { Icon } from '@/components/common/Icon'
import { useAlerts, useMarkAlertRead } from '@/hooks/useApi'
import { formatRelative } from '@/lib/time'
import { cn } from '@/lib/cn'

/**
 * Alerts is a bonus route the contract marks "not implemented currently." A 404 here
 * is expected right now, so this stays silent rather than showing a broken bell — unlike
 * the main dashboard/detail screens, this one peripheral affordance just doesn't render
 * until the backend has something to say.
 */
export function AlertsBell() {
  const [open, setOpen] = useState(false)
  const { data, error } = useAlerts()
  const markRead = useMarkAlertRead()

  if (error) return null

  const items = data?.items ?? []
  const unreadCount = items.filter((item) => !item.is_read).length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Alerts${unreadCount ? `, ${unreadCount} unread` : ''}`}
        className="relative rounded-lg p-2 text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink-1"
      >
        <Icon name="bell" size={17} />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-bad" />
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close alerts"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-40 mt-2 w-80 animate-pop-in rounded-xl border border-line bg-surface-1 p-1.5 shadow-xl shadow-black/40">
            {items.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-ink-3">No alerts yet.</p>
            ) : (
              <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
                {items.slice(0, 10).map((alert) => (
                  <li key={alert.id}>
                    <button
                      type="button"
                      onClick={() => markRead.mutate(alert.id)}
                      className={cn(
                        'w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-2',
                        !alert.is_read && 'bg-surface-2/70',
                      )}
                    >
                      <p className="text-sm text-ink-1">{alert.message}</p>
                      <p className="mt-0.5 text-xs text-ink-3">{formatRelative(alert.created_at)}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
