import { ScrapeError, classify } from '../lib/errors.js';
import { STORE_PROFILE as SP } from './storeProfile.js';

async function fetchJson(path) {
  let response;
  try {
    response = await fetch(`${SP.baseUrl}${path}`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(SP.limits.requestTimeoutMs),
    });
  } catch (error) {
    throw classify(null, error) ?? new ScrapeError('NETWORK', String(error), { retryable: true, cause: error });
  }
  const failure = classify(response.status, null);
  if (failure) throw failure;
  return response.json();
}

export async function getCatalog(page = 1, pageSize = 20) {
  return fetchJson(SP.paths.catalog(page, pageSize));
}

export async function getProductDetails(id) {
  return fetchJson(SP.paths.details(id));
}

export async function searchCatalog(query, { maxPages = 50, pageSize = 20 } = {}) {
  const needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return [];
  const first = await getCatalog(1, pageSize);
  const pages = Math.min(Number(first.pages ?? 1), maxPages);
  const all = [first.items ?? []];
  for (let page = 2; page <= pages; page += 1) all.push((await getCatalog(page, pageSize)).items ?? []);
  return all.flat().filter((item) => item.name?.toLowerCase().includes(needle));
}
