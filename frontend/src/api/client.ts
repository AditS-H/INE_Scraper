import { ApiError } from './types'

export const API_BASE = import.meta.env.VITE_API_BASE ?? ''

/** True when the app was built without VITE_API_BASE — every request would be pointless. */
export const isApiConfigured = API_BASE.length > 0

type Query = Record<string, string | number | boolean | undefined | null>

export function buildQuery(query?: Query): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Shared client for every backend call. Builds `${VITE_API_BASE}${path}`, always sends/expects
 * JSON, and throws a typed ApiError (status + code + message) on any non-2xx response — exactly
 * the contract this app is written against (section 1 and 19 of the integration contract).
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  if (!isApiConfigured) {
    throw new ApiError(
      'VITE_API_BASE is not set, so the app has no backend to talk to.',
      0,
      'not_configured',
    )
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    })
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0, 'network_error')
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message = body?.message || body?.error || `Request failed (${response.status})`
    throw new ApiError(message, response.status, body?.error)
  }

  return body as T
}
