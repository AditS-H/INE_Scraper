// Types mirror FRONTEND_INTEGRATION_CONTRACT.md section 20 exactly.
// snake_case is kept as-is (not converted) per the contract's explicit instruction.

export type ScrapeOutcome = 'success' | 'retried' | 'failed'
export type ScrapeStrategy = 'browser' | 'none'
export type HistoryRange = '24h' | '7d' | '30d' | 'all'
export type AlertKind = 'price_drop' | 'back_in_stock' | 'structure_drift' | 'stale'
export type ConfidenceLevel = 'high' | 'verified' | 'low'

export interface Health {
  ok: boolean
  databaseConfigured?: boolean
  now: string
  uptimeSec?: number
  lastRunAt?: string | null
  lastRunCounts?: {
    total: number
    success: number
    retried: number
    failed: number
  } | null
  overdue?: boolean
}

export interface StoreProduct {
  id: number | string
  slug: string
  name: string
  brand: string
  category: string
  sku: string
  description: string
}

export interface CatalogResponse {
  page: number
  pageSize: number
  pages: number
  total: number
  items: StoreProduct[]
}

export interface SearchResponse {
  items: StoreProduct[]
}

export interface TrackProductRequest {
  store_product_id: string
  name: string
  url?: string | null
  category?: string | null
  brand?: string | null
  description?: string | null
}

// Lightweight point embedded on dashboard list rows for the sparkline —
// distinct (smaller) shape from PriceHistoryItem below.
export interface MiniHistoryPoint {
  scraped_at: string
  price: number
  currency: string
  in_stock: boolean
  stock_status: string
}

export interface TrackedProduct {
  id: string
  store_product_id: string
  name: string
  url: string | null
  category: string | null
  brand: string | null
  description: string | null
  is_active: boolean
  scrape_interval_min: number
  next_due_at: string
  created_at: string
  last_scrape_at: string | null
  last_outcome: ScrapeOutcome | null
  last_price: number | null
  last_currency: string | null
  last_in_stock: boolean | null
  consecutive_failures: number
  previous_price?: number | null
  price_delta?: number | null
  price_delta_percent?: number | null
  history_24h?: MiniHistoryPoint[]
}

export interface TrackedListResponse {
  items: TrackedProduct[]
}

export interface LatestPrice {
  price: number
  currency: string
  in_stock: boolean
  stock_status: string
  stock_qty: number | null
  scraped_at: string
}

export interface TrackedDetailResponse {
  product: TrackedProduct
  latest: LatestPrice | null
}

export interface PriceHistoryItem {
  id: string
  scraped_at: string
  price: number
  currency: string
  in_stock: boolean
  stock_status: string
  stock_qty: number | null
  strategy: ScrapeStrategy
  extractor: string
  confidence: ConfidenceLevel
  run_id: string | null
}

export interface HistoryResponse {
  productId: string
  range: HistoryRange
  items: PriceHistoryItem[]
}

export interface AttemptTraceItem {
  n: number
  ms: number
  status?: number | null
  ok?: boolean
  error?: string
  backoffMs?: number
}

export interface ScrapeLogItem {
  id: string
  tracked_product_id: string
  run_id: string | null
  outcome: ScrapeOutcome
  attempts: number
  strategy: ScrapeStrategy
  http_status: number | null
  error_code: string | null
  error_message: string | null
  price_found: number | null
  duration_ms: number
  attempt_trace: AttemptTraceItem[]
  started_at: string
  finished_at: string | null
}

export interface LogResponse {
  productId: string
  items: ScrapeLogItem[]
}

export interface ManualScrapeResponse {
  accepted: boolean
  runId: string
  productId: string
}

export interface StopTrackingResponse {
  id: string
  is_active: boolean
}

export interface PatchIntervalRequest {
  scrape_interval_min: number
}

export interface RunItem {
  id: string
  trigger: string
  started_at: string
  finished_at: string | null
  total: number
  success: number
  retried: number
  failed: number
  notes: string | null
}

export interface RunsResponse {
  items: RunItem[]
}

export interface AlertItem {
  id: string
  tracked_product_id: string
  kind: AlertKind
  message: string
  old_value: number | null
  new_value: number | null
  is_read: boolean
  created_at: string
}

export interface AlertsResponse {
  items: AlertItem[]
}

export interface MarkAlertReadResponse {
  id: string
  is_read: boolean
}

/** Thrown by apiFetch. Carries the HTTP status and the backend's error code alongside the message. */
export class ApiError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/** True for a 404 specifically — used to tell "route not built yet on the backend" apart from a real failure. */
export function isNotImplemented(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
