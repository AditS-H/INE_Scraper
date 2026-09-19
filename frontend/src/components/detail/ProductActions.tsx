import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '@/api/types'
import type { TrackedProduct } from '@/api/types'
import { Icon } from '@/components/common/Icon'
import { Spinner } from '@/components/common/Spinner'
import { useToast } from '@/components/common/toast-context'
import { useManualScrape, useStopTracking, useUpdateInterval } from '@/hooks/useApi'
import { cn } from '@/lib/cn'

const INTERVAL_OPTIONS = [30, 60, 120, 240, 360]

interface ProductActionsProps {
  product: TrackedProduct
  manualScrape: ReturnType<typeof useManualScrape>
}

export function ProductActions({ product, manualScrape }: ProductActionsProps) {
  const navigate = useNavigate()
  const { show } = useToast()
  const stopTracking = useStopTracking(product.id)
  const updateInterval = useUpdateInterval(product.id)
  const [confirmingStop, setConfirmingStop] = useState(false)

  useEffect(() => {
    if (!confirmingStop) return
    const timer = window.setTimeout(() => setConfirmingStop(false), 3000)
    return () => window.clearTimeout(timer)
  }, [confirmingStop])

  if (!product.is_active) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-line bg-surface-1 px-3.5 py-2.5 text-sm text-ink-2">
        <Icon name="stopCircle" size={15} className="text-ink-3" />
        Tracking stopped — its history and logs are still kept below.
      </p>
    )
  }

  const handleScrapeNow = () => {
    manualScrape.mutate(undefined, {
      onSuccess: () => show('Scrape requested — new data will land shortly.', 'success'),
      onError: (error) => {
        if (error instanceof ApiError && error.status === 429) {
          show('A scrape was just requested — try again in a minute.', 'error')
        } else if (error instanceof ApiError && error.status === 409) {
          show('A scrape is already running for this product.', 'error')
        } else {
          show(error instanceof Error ? error.message : 'Could not request a scrape.', 'error')
        }
      },
    })
  }

  const handleStop = () => {
    if (!confirmingStop) {
      setConfirmingStop(true)
      return
    }
    stopTracking.mutate(undefined, {
      onSuccess: () => {
        show('Stopped tracking. History is kept.', 'default')
        navigate('/')
      },
      onError: (error) => show(error instanceof Error ? error.message : 'Could not stop tracking.', 'error'),
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleScrapeNow}
        disabled={manualScrape.isPending}
        className="flex items-center gap-1.5 rounded-lg bg-signal px-3.5 py-2 text-sm font-medium text-surface-0 transition-transform active:scale-95 disabled:opacity-60"
      >
        {manualScrape.isPending ? <Spinner size={13} /> : <Icon name="refresh" size={14} />}
        Scrape now
      </button>

      <label className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-1 px-2.5 py-2 text-xs text-ink-2">
        <Icon name="sliders" size={13} />
        <select
          value={product.scrape_interval_min}
          onChange={(event) => updateInterval.mutate(Number(event.target.value))}
          className="bg-transparent text-ink-1 focus:outline-none"
        >
          {!INTERVAL_OPTIONS.includes(product.scrape_interval_min) && (
            <option value={product.scrape_interval_min}>{product.scrape_interval_min}m</option>
          )}
          {INTERVAL_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`} checks
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        onClick={handleStop}
        disabled={stopTracking.isPending}
        className={cn(
          'flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60',
          confirmingStop
            ? 'border-bad/40 bg-bad-dim text-bad'
            : 'border-line bg-surface-1 text-ink-2 hover:text-ink-1',
        )}
      >
        {stopTracking.isPending ? <Spinner size={13} /> : <Icon name="stopCircle" size={14} />}
        {confirmingStop ? 'Click to confirm' : 'Stop tracking'}
      </button>
    </div>
  )
}
