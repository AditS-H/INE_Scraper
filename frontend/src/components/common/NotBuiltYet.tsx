import { Icon } from './Icon'

interface NotBuiltYetProps {
  endpoint: string
  note?: string
}

/**
 * Deliberately styled apart from ErrorState. A 404 on a route the contract marks
 * "required; not implemented currently" isn't a bug in this app — it's a known gap
 * in the backend, and the two should never look the same to whoever is reading this.
 */
export function NotBuiltYet({ endpoint, note }: NotBuiltYetProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-signal/20 bg-signal-dim px-6 py-10 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-signal">
        <Icon name="sliders" size={18} />
      </div>
      <h3 className="text-base font-medium text-ink-1">Waiting on the backend</h3>
      <p className="max-w-sm text-sm text-ink-2">
        This view reads from{' '}
        <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-signal-ink">{endpoint}</code>,
        which isn't live yet. {note}
      </p>
    </div>
  )
}
