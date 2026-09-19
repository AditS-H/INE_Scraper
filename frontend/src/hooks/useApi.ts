import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import * as api from '@/api/endpoints'
import type { HistoryRange, TrackProductRequest } from '@/api/types'
import { POLL_INTERVAL_MS, queryKeys } from '@/lib/constants'

// ---- Health -----------------------------------------------------------------

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: api.getHealth,
    refetchInterval: POLL_INTERVAL_MS,
  })
}

// ---- Store search / catalogue ------------------------------------------------

export function useStoreSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: queryKeys.search(trimmed),
    queryFn: () => api.searchStore(trimmed),
    // "On debounced query of at least two characters" — contract §10.1.
    enabled: trimmed.length >= 2,
  })
}

export function useTrackProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: TrackProductRequest) => api.trackProduct(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tracked })
    },
  })
}

// ---- Tracked-product dashboard ------------------------------------------------

export function useTrackedProducts() {
  return useQuery({
    queryKey: queryKeys.tracked,
    queryFn: api.getTracked,
    refetchInterval: POLL_INTERVAL_MS,
  })
}

export function useTrackedDetail(id: string | undefined, intervalMs: number = POLL_INTERVAL_MS) {
  return useQuery({
    queryKey: queryKeys.trackedDetail(id ?? ''),
    queryFn: () => api.getTrackedById(id as string),
    enabled: Boolean(id),
    refetchInterval: intervalMs,
  })
}

export function useHistory(
  id: string | undefined,
  range: HistoryRange,
  intervalMs: number = POLL_INTERVAL_MS,
) {
  return useQuery({
    queryKey: queryKeys.history(id ?? '', range),
    queryFn: () => api.getHistory(id as string, range),
    enabled: Boolean(id),
    refetchInterval: intervalMs,
  })
}

export function useLogs(id: string | undefined, intervalMs: number = POLL_INTERVAL_MS) {
  return useQuery({
    queryKey: queryKeys.logs(id ?? ''),
    queryFn: () => api.getLogs(id as string, 100),
    enabled: Boolean(id),
    refetchInterval: intervalMs,
  })
}

export const BOOST_INTERVAL_MS = 4_000
const BOOST_WINDOW_MS = 90_000

/**
 * Manual "scrape now". After acceptance, `boosted` flips true for 90s so the caller
 * can tighten polling on detail/history/logs to `BOOST_INTERVAL_MS` — the new log row
 * shows up fast, then it relaxes back to the normal 60s cadence. "Poll ... until a new
 * log appears" (contract §13), without polling that fast forever.
 */
export function useManualScrape(id: string) {
  const queryClient = useQueryClient()
  const [boosted, setBoosted] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.requestScrape(id),
    onSuccess: () => {
      setBoosted(true)
      queryClient.invalidateQueries({ queryKey: queryKeys.trackedDetail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.logs(id) })
    },
  })

  useEffect(() => {
    if (!boosted) return
    const timer = window.setTimeout(() => setBoosted(false), BOOST_WINDOW_MS)
    return () => window.clearTimeout(timer)
  }, [boosted])

  return { ...mutation, boosted }
}

export function useStopTracking(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.stopTracking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tracked })
      queryClient.invalidateQueries({ queryKey: queryKeys.trackedDetail(id) })
    },
  })
}

export function useUpdateInterval(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (scrapeIntervalMin: number) =>
      api.updateInterval(id, { scrape_interval_min: scrapeIntervalMin }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trackedDetail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tracked })
    },
  })
}

// ---- Runs / health page --------------------------------------------------------

export function useRuns() {
  return useQuery({
    queryKey: queryKeys.runs,
    queryFn: () => api.getRuns(20),
    refetchInterval: POLL_INTERVAL_MS,
  })
}

// ---- Alerts (bonus) -------------------------------------------------------------

export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: api.getAlerts,
    refetchInterval: POLL_INTERVAL_MS,
    retry: false,
  })
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.markAlertRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.alerts })
    },
  })
}

/** Derived from the tracked list — lets the search modal show "Tracking" without a server round trip. */
export function useTrackedIdSet(items: { store_product_id: string }[] | undefined): Set<string> {
  return useMemo(() => new Set((items ?? []).map((item) => item.store_product_id)), [items])
}
