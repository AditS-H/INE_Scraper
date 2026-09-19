/** Both the health strip and the product-detail page poll at this cadence, per the contract. */
export const POLL_INTERVAL_MS = 60_000

export const SEARCH_DEBOUNCE_MS = 300

export const HISTORY_RANGES = ['24h', '7d', '30d', 'all'] as const

export const queryKeys = {
  health: ['health'] as const,
  search: (q: string) => ['search', q] as const,
  catalog: (page: number) => ['catalog', page] as const,
  tracked: ['tracked'] as const,
  trackedDetail: (id: string) => ['tracked', id] as const,
  history: (id: string, range: string) => ['tracked', id, 'history', range] as const,
  logs: (id: string) => ['tracked', id, 'logs'] as const,
  runs: ['runs'] as const,
  alerts: ['alerts'] as const,
}
