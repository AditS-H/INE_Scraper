import { scrapeViaBrowser } from './browserStrategy.js';

export async function scrapeProduct(product, { headed = false, maxAttempts } = {}) {
  const startedAt = new Date();
  const started = Date.now();
  try {
    const result = await scrapeViaBrowser(product.store_product_id, { productName: product.name, headed, maxAttempts });
    const attempts = result.meta.attempts;
    return {
      ok: true,
      outcome: attempts > 1 ? 'retried' : 'success',
      observation: result.observation,
      meta: result.meta,
      attempts,
      durationMs: Date.now() - started,
      startedAt,
      trace: result.meta.trace,
    };
  } catch (error) {
    return {
  ok: false,
  outcome: 'failed',
  errorCode: error.code ?? 'UNKNOWN',
  errorMessage: String(error.message ?? error).slice(0, 1000),
  httpStatus: error.status ?? null,
  retryable: error.retryable ?? false,
  attempts: Math.max(1, error.trace?.length ?? 1),
  durationMs: Date.now() - started,
  startedAt,
  trace: error.trace ?? [],
  meta: { strategy: 'browser' },
};
  }
}
