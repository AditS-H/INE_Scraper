// The backend stores UTC ISO-8601 timestamps. Every user-facing display must render
// them in Asia/Kolkata — this file is the one place that rule lives.

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  dateStyle: 'medium',
  timeStyle: 'short',
})

const timeOnlyFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  timeStyle: 'medium',
})

const relative = new Intl.RelativeTimeFormat('en-IN', { numeric: 'auto' })

/** "19 Sept 2026, 6:05 pm" in IST. */
export function formatIST(timestamp: string | null | undefined): string {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  return `${dateTimeFormatter.format(date)} IST`
}

/** "6:05:12 pm" in IST — for scrape-log rows where the date is implied by grouping. */
export function formatTimeIST(timestamp: string | null | undefined): string {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  return timeOnlyFormatter.format(date)
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

/** "12m ago" / "in 45m" / "just now" — used for sparkline hover, next-due, last-scrape. */
export function formatRelative(timestamp: string | null | undefined): string {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  const seconds = (date.getTime() - Date.now()) / 1000

  if (Math.abs(seconds) < 30) return 'just now'

  for (const [unit, secondsInUnit] of UNITS) {
    if (Math.abs(seconds) >= secondsInUnit) {
      return relative.format(Math.round(seconds / secondsInUnit), unit)
    }
  }
  return relative.format(Math.round(seconds / 60), 'minute')
}

/** "18.4s" / "820ms" — for scrape-log durations. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/** How stale the last successful run is, in plain words, for the overdue banner. */
export function formatStaleness(lastRunAt: string | null | undefined): string {
  if (!lastRunAt) return 'no run yet'
  const ms = Date.now() - new Date(lastRunAt).getTime()
  if (Number.isNaN(ms)) return 'unknown'
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours <= 0) return `${minutes}m`
  return `${hours}h${minutes.toString().padStart(2, '0')}m`
}
