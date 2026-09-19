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
  const catalog = await getFullCatalog({ maxPages, pageSize });
  return catalog.filter((item) => item.name?.toLowerCase().includes(needle)).slice(0, 25);
}

const catalogCache = { expiresAt: 0, items: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getFullCatalog({ maxPages = 20, pageSize = 60 } = {}) {
  if (catalogCache.expiresAt > Date.now()) return catalogCache.items;

  const first = await getCatalogWithRetry(1, pageSize);
  const pages = Math.min(Number(first.pages ?? 1), maxPages);
  const remaining = [];
  for (let start = 2; start <= pages; start += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, pages - start + 1) }, (_, index) => getCatalogWithRetry(start + index, pageSize)),
    );
    remaining.push(...batch);
  }
  const items = [first, ...remaining].flatMap((page) => page.items ?? []);
  catalogCache.items = items;
  catalogCache.expiresAt = Date.now() + 10 * 60 * 1000;
  return items;
}

export async function collectCompleteCatalog({ maxPasses = 12, pageSize = 60 } = {}) {
  const products = new Map();
  let expectedTotal = null;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    const first = await getCatalogWithRetry(1, pageSize);
    expectedTotal ??= Number(first.total ?? 0);
    const pages = Number(first.pages ?? 1);
    const add = (page) => (page.items ?? []).forEach((item) => {
      if (item.id != null) products.set(String(item.id), item);
    });
    add(first);

    for (let start = 2; start <= pages; start += 4) {
      const batch = await Promise.all(
        Array.from({ length: Math.min(4, pages - start + 1) }, (_, index) => getCatalogWithRetry(start + index, pageSize)),
      );
      batch.forEach(add);
    }

    if (expectedTotal > 0 && products.size >= expectedTotal) return [...products.values()];
  }

  throw new ScrapeError('CATALOG_INCOMPLETE', `catalogue collection stopped at ${products.size} of ${expectedTotal ?? 'unknown'} products`, { retryable: true });
}

async function getCatalogWithRetry(page, pageSize, maxAttempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await getCatalog(page, pageSize);
    } catch (error) {
      lastError = error;
      const retryable = error?.retryable || /upstream returned (408|425|429|5\d\d)/i.test(String(error?.message));
      if (!retryable || attempt === maxAttempts) throw error;
      await sleep(Math.min(5_000, 250 * 2 ** (attempt - 1)));
    }
  }
  throw lastError;
}