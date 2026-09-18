import { chromium } from 'playwright';
import { config } from '../config.js';
import { classify, ScrapeError } from '../lib/errors.js';
import { normaliseStock } from '../lib/money.js';
import { decryptQuote } from './decryptQuote.js';
import { STORE_PROFILE as SP } from './storeProfile.js';
import { Observation } from './validate.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const retryDelay = (attempt) => Math.round(Math.min(SP.limits.maxBackoffMs, SP.limits.baseBackoffMs * 2 ** (attempt - 1) * (0.5 + Math.random())));

function traceError(trace, attempt, started, error, backoffMs = 0) {
  trace.push({
    n: attempt,
    ms: Date.now() - started,
    status: error.status ?? null,
    error: error.code ?? 'UNKNOWN',
    backoffMs,
  });
}

function observationFromQuote(quote, productName) {
  const stock = normaliseStock(Number(quote.s));
  return Observation.parse({
    price: Number(quote.p),
    currency: String(quote.c ?? 'INR').toUpperCase(),
    ...stock,
    name: productName,
  });
}

async function acceptCookieDialog(page) {
  const button = page.locator(SP.ui.acceptCookies);
  await button.waitFor({ state: 'visible', timeout: 3_000 })
    .then(() => button.click())
    .catch(() => {});
}

async function performHumanReveal(page) {
  const priceBlock = page.locator(SP.ui.priceBlock);
  await priceBlock.waitFor({ state: 'visible', timeout: SP.limits.requestTimeoutMs });
  const box = await priceBlock.boundingBox();
  if (!box) throw new ScrapeError('STRUCTURE_DRIFT', 'price block did not have a bounding box');

  await priceBlock.hover();
  for (let move = 0; move < SP.limits.hoverMoves; move += 1) {
    await page.mouse.move(box.x + 60 + move * 11, box.y + 44 + (move % 3) * 8);
    await sleep(90);
  }
  await sleep(Math.max(0, SP.limits.hoverDwellMs - SP.limits.hoverMoves * 90));
  const reveal = page.locator(SP.ui.revealButton);
  await reveal.waitFor({ state: 'visible', timeout: SP.limits.requestTimeoutMs });
  await reveal.click({ timeout: SP.limits.requestTimeoutMs });
}

async function scrapeOnce(storeProductId, productName, { headed = false, slowMo = 0 } = {}) {
  const browser = await chromium.launch({
    headless: !headed,
    slowMo,
    executablePath: config.playwrightExecutable,
    args: ['--disable-dev-shm-usage', '--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1360, height: 900 },
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  const page = await context.newPage();
  let sessionToken = null;
  let priceResponse = null;
  const responses = [];

  page.on('response', async (response) => {
    const path = new URL(response.url()).pathname;
    if (!path.startsWith('/api/')) return;
    responses.push({ path, status: response.status() });
    if (path === SP.paths.session && response.ok()) {
      const body = await response.json().catch(() => null);
      sessionToken = body?.token ?? null;
    }
    if (path === SP.paths.price(storeProductId) && response.ok()) {
      priceResponse = await response.json().catch(() => null);
    }
  });

  try {
    await page.goto(`${SP.baseUrl}/product/${encodeURIComponent(storeProductId)}`, {
      waitUntil: 'domcontentloaded',
      timeout: SP.limits.requestTimeoutMs,
    });
    await acceptCookieDialog(page);
    await performHumanReveal(page);

    await page.waitForFunction(
      () => document.querySelector('.price-success') || document.querySelector('.price-error'),
      undefined,
      { timeout: SP.limits.requestTimeoutMs, polling: 200 },
    );
    if (!priceResponse?.e || !sessionToken) {
      const pageText = await page.locator(SP.ui.priceBlock).innerText().catch(() => 'price reveal failed');
      throw new ScrapeError('SESSION_EXPIRED', pageText.slice(0, 300), { retryable: true });
    }
    const quote = decryptQuote(priceResponse.e, sessionToken);
    return { observation: observationFromQuote(quote, productName), quote, responses };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/**
 * Uses a brand-new browser context on every retry. It never reuses a challenge,
 * session token, page, or attestation after failure.
 */
export async function scrapeViaBrowser(storeProductId, { productName = `Product ${storeProductId}`, headed = false, slowMo = headed ? 250 : 0 } = {}) {
  const trace = [];
  let lastError;
  for (let attempt = 1; attempt <= SP.limits.maxAttempts; attempt += 1) {
    const started = Date.now();
    try {
      const result = await scrapeOnce(storeProductId, productName, { headed, slowMo });
      trace.push({ n: attempt, ms: Date.now() - started, status: 200, ok: true, responses: result.responses });
      return {
        observation: result.observation,
        meta: {
          strategy: 'browser',
          extractor: 'encrypted-response-v1',
          confidence: 'high',
          attempts: attempt,
          trace,
          quoteFormat: result.quote.f ?? null,
        },
      };
    } catch (rawError) {
      const error = rawError instanceof ScrapeError
        ? rawError
        : classify(rawError?.status, rawError) ?? new ScrapeError('BROWSER_FAILURE', String(rawError), { retryable: true, cause: rawError });
      lastError = error;
      const isLast = attempt === SP.limits.maxAttempts || !error.retryable;
      const backoffMs = isLast ? 0 : retryDelay(attempt);
      traceError(trace, attempt, started, error, backoffMs);
      if (isLast) {
        error.trace = trace;
        throw error;
      }
      await sleep(backoffMs);
    }
  }
  throw lastError;
}
