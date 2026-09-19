import { apiFetch, buildQuery } from './client'
import type {
  AlertsResponse,
  CatalogResponse,
  Health,
  HistoryRange,
  HistoryResponse,
  LogResponse,
  ManualScrapeResponse,
  MarkAlertReadResponse,
  PatchIntervalRequest,
  RunsResponse,
  SearchResponse,
  StopTrackingResponse,
  TrackedDetailResponse,
  TrackedListResponse,
  TrackedProduct,
  TrackProductRequest,
} from './types'

// ---- Implemented today -----------------------------------------------------

export const getHealth = () => apiFetch<Health>('/api/health')

export const getCatalog = (page = 1, pageSize = 20) =>
  apiFetch<CatalogResponse>(`/api/store/catalog${buildQuery({ page, pageSize })}`)

export const searchStore = (query: string) =>
  apiFetch<SearchResponse>(`/api/store/search${buildQuery({ q: query })}`)

export const trackProduct = (body: TrackProductRequest) =>
  apiFetch<TrackedProduct>('/api/tracked', {
    method: 'POST',
    body: JSON.stringify(body),
  })

// ---- Required by the spec, not live on the backend yet --------------------
// Calling these against the current backend 404s. Every hook that uses them
// treats a 404 as "not built yet" rather than a hard failure — see isNotImplemented.

export const getTracked = () => apiFetch<TrackedListResponse>('/api/tracked')

export const getTrackedById = (id: string) => apiFetch<TrackedDetailResponse>(`/api/tracked/${id}`)

export const getHistory = (id: string, range: HistoryRange) =>
  apiFetch<HistoryResponse>(`/api/tracked/${id}/history${buildQuery({ range })}`)

export const getLogs = (id: string, limit = 100) =>
  apiFetch<LogResponse>(`/api/tracked/${id}/logs${buildQuery({ limit })}`)

export const stopTracking = (id: string) =>
  apiFetch<StopTrackingResponse>(`/api/tracked/${id}`, { method: 'DELETE' })

export const updateInterval = (id: string, body: PatchIntervalRequest) =>
  apiFetch<TrackedProduct>(`/api/tracked/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })

export const requestScrape = (id: string) =>
  apiFetch<ManualScrapeResponse>(`/api/tracked/${id}/scrape`, { method: 'POST' })

export const getRuns = (limit = 20) => apiFetch<RunsResponse>(`/api/runs${buildQuery({ limit })}`)

export const getAlerts = () => apiFetch<AlertsResponse>('/api/alerts')

export const markAlertRead = (id: string) =>
  apiFetch<MarkAlertReadResponse>(`/api/alerts/${id}/read`, { method: 'POST' })

// Deliberately not exported: POST /api/cron/scrape requires x-cron-secret and is
// documented as "not a normal frontend endpoint" — cron-job.org calls it, not this app.
