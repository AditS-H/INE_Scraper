import { config } from '../config.js';

// This is the single source of truth for facts learned in docs/recon-report.json.
export const STORE_PROFILE = {
  baseUrl: config.storeBaseUrl,
  revealMechanism: 'browser_attested_session',
  paths: {
    catalog: (page = 1, pageSize = 20) => `/api/catalog?page=${page}&pageSize=${pageSize}`,
    details: (id) => `/api/product/${id}`,
    challenge: '/api/challenge',
    session: '/api/session',
    price: (id) => `/api/products/${id}/price`,
  },
  ui: {
    priceBlock: '.price-block',
    revealButton: 'button[aria-label="Reveal price"]',
    acceptCookies: 'button[aria-label="Accept cookies"]',
  },
  limits: {
    requestTimeoutMs: config.requestTimeoutMs,
    maxAttempts: config.maxAttempts,
    attemptsPerPass: config.maxAttempts,
    retryPasses: config.retryPasses,
    baseBackoffMs: 700,
    maxBackoffMs: 8_000,
    hoverMoves: 8,
    hoverDwellMs: 700,
    concurrency: config.scrapeConcurrency,
    runBudgetMs: config.runBudgetMs,
  },
  crypto: {
    responseKeyPrefix: 'ine-mock-store-shared-k3y|enc|',
  },
};
