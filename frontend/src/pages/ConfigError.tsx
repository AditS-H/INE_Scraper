import { Icon } from '@/components/common/Icon'

/**
 * Extends the contract's "databaseConfigured === false -> show an admin error" principle
 * one level further back: if VITE_API_BASE itself is missing, there's no point rendering
 * a dashboard that will just fail every request.
 */
export function ConfigError() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md rounded-2xl border border-warn/25 bg-warn-dim p-6 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-warn">
          <Icon name="sliders" size={20} />
        </div>
        <h1 className="mt-3 text-lg font-semibold text-ink-1">Backend not configured</h1>
        <p className="mt-2 text-sm text-ink-2">
          This build has no{' '}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-ink-1">VITE_API_BASE</code> set,
          so it has nowhere to send requests. Set it to your Render service URL and redeploy.
        </p>
      </div>
    </div>
  )
}
