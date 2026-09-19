import { randomUUID } from 'node:crypto';
import pLimit from 'p-limit';
import { db } from '../db/supabase.js';
import { acquireLock, releaseLock } from '../lib/lock.js';
import { scrapeProduct } from '../scraper/index.js';
import { STORE_PROFILE as SP } from '../scraper/storeProfile.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const withTimeout = (promise, ms, message) => Promise.race([
  promise,
  new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
]);

export async function startRun({ trigger = 'cron', productIds = null } = {}) {
  const runId = randomUUID();
  if (!(await acquireLock(runId))) return { runId: null, skipped: true, reason: 'run already in progress' };
  const { error } = await db().from('scrape_runs').insert({ id: runId, trigger });
  if (error) {
    await releaseLock(runId);
    throw error;
  }
  void executeRun(runId, productIds).catch((error) => console.error('scrape run crashed', { runId, error }));
  return { runId, skipped: false };
}

export async function executeRun(runId, productIds = null) {
  const counts = { total: 0, success: 0, retried: 0, failed: 0 };
  const deadline = Date.now() + SP.limits.runBudgetMs;
  try {
    let query = db().from('tracked_products').select('*').eq('is_active', true);
    query = productIds?.length ? query.in('id', productIds) : query.lte('next_due_at', new Date().toISOString());
    const { data: products = [], error } = await withTimeout(query, 30_000, 'tracked product query timed out');
    if (error) throw error;
    counts.total = products.length;
    await db().from('scrape_runs').update({ total: counts.total }).eq('id', runId);

    const results = new Map();
    let pending = products;

   for (
  let pass = 0;
  pass <= SP.limits.retryPasses && pending.length;
  pass += 1
) {
  const passResults = await scrapePass(pending, deadline);
  const retry = [];

  for (const product of pending) {
    const result = passResults.get(product.id);

    if (!result) {
      const missing = budgetExceeded();

      results.set(
        product.id,
        results.has(product.id)
          ? mergeResults(results.get(product.id), missing)
          : missing
      );

      continue;
    }

    const merged = results.has(product.id)
      ? mergeResults(results.get(product.id), result)
      : result;

    results.set(product.id, merged);

    // Failed product gets another pass, unless:
    // 1. it succeeded
    // 2. we have exhausted all retry passes
    // 3. the run budget is exhausted
    if (
      !result.ok &&
      result.retryable !== false &&
      result.errorCode !== 'BUDGET_EXCEEDED' &&
      pass < SP.limits.retryPasses
    ) {
      retry.push(product);
    }
  }

  pending = retry;
}

    for (const product of products) {
      const result = results.get(product.id) ?? budgetExceeded();
      await persistResult(runId, product, result);
      counts[result.outcome] += 1;
    }
  } catch (error) {
    await db().from('scrape_runs').update({ ...counts, notes: String(error.message ?? error).slice(0, 500) }).eq('id', runId);
    throw error;
  } finally {
    await db().from('scrape_runs').update({ ...counts, finished_at: new Date().toISOString() }).eq('id', runId);
    await releaseLock(runId);
  }
  return counts;
}

async function scrapePass(products, deadline) {
  const results = new Map();
  const limit = pLimit(SP.limits.concurrency);

  await Promise.all(products.map((product) => limit(async () => {
    if (Date.now() > deadline) {
      results.set(product.id, budgetExceeded());
      return;
    }
    await sleep(Math.round(Math.random() * 900));
    const remainingMs = Math.max(1_000, Math.min(5 * 60_000, deadline - Date.now()));
    results.set(product.id, await withTimeout(
      scrapeProduct(product, { maxAttempts: SP.limits.attemptsPerPass }),
      remainingMs,
      'product scrape exceeded the run time budget',
    ).catch((error) => ({
      ok: false,
      outcome: 'failed',
      errorCode: 'TIMEOUT',
      errorMessage: String(error.message ?? error),
      attempts: 0,
      durationMs: remainingMs,
      startedAt: new Date(),
      trace: [],
      meta: { strategy: 'browser' },
    })));
  })));

  return results;
}

function mergeResults(first, second) {
  const firstAttempts = first.attempts ?? first.trace?.length ?? 0;
  const secondTrace = (second.trace ?? []).map((entry) => ({ ...entry, n: (entry.n ?? 0) + firstAttempts }));
  const attempts = firstAttempts + (second.attempts ?? second.trace?.length ?? 0);
  return {
    ...first,
    ...second,
    ok: second.ok,
    outcome: second.ok ? 'retried' : 'failed',
    attempts,
    durationMs: (first.durationMs ?? 0) + (second.durationMs ?? 0),
    startedAt: first.startedAt,
    trace: [...(first.trace ?? []), ...secondTrace],
    meta: { ...(first.meta ?? {}), ...(second.meta ?? {}), attempts },
  };
}

function budgetExceeded() {
  return {
    ok: false, outcome: 'failed', errorCode: 'BUDGET_EXCEEDED',
    errorMessage: 'run wall-clock budget exhausted before this product started',
    attempts: 0, durationMs: 0, startedAt: new Date(), trace: [], meta: { strategy: 'none' },
  };
}

export async function persistResult(runId, product, result) {
  const nextDueAt = new Date(Date.now() + product.scrape_interval_min * 60_000).toISOString();
  const logRow = {
    tracked_product_id: product.id,
    run_id: runId,
    outcome: result.outcome,
    attempts: result.attempts,
    strategy: result.meta?.strategy ?? 'none',
    http_status: result.httpStatus ?? null,
    error_code: result.errorCode ?? null,
    error_message: result.errorMessage ?? null,
    price_found: result.observation?.price ?? null,
    duration_ms: result.durationMs,
    attempt_trace: result.trace ?? [],
    started_at: result.startedAt.toISOString(),
    finished_at: new Date().toISOString(),
  };

  // The log is always written. The history insert below is reachable only for validated success.
  const { error: logError } = await db().from('scrape_logs').insert(logRow);
  if (logError) throw logError;

  if (result.ok) {
    const { error: historyError } = await db().from('price_history').insert({
      tracked_product_id: product.id, run_id: runId,
      price: result.observation.price, currency: result.observation.currency,
      in_stock: result.observation.in_stock, stock_status: result.observation.stock_status,
      stock_qty: result.observation.stock_qty, strategy: result.meta.strategy,
      extractor: result.meta.extractor, confidence: result.meta.confidence,
    });
    if (historyError) throw historyError;
    const { error: productError } = await db().from('tracked_products').update({
      last_scrape_at: new Date().toISOString(), last_outcome: result.outcome,
      last_price: result.observation.price, last_currency: result.observation.currency,
      last_in_stock: result.observation.in_stock, consecutive_failures: 0, next_due_at: nextDueAt,
    }).eq('id', product.id);
    if (productError) throw productError;
  } else {
    const { error: productError } = await db().from('tracked_products').update({
      last_scrape_at: new Date().toISOString(), last_outcome: 'failed',
      consecutive_failures: product.consecutive_failures + 1, next_due_at: nextDueAt,
    }).eq('id', product.id);
    if (productError) throw productError;
  }
}
