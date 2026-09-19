import { chromium } from 'playwright';
import { config } from '../config.js';
import { classify, ScrapeError } from '../lib/errors.js';
import { normaliseStock, parseMoney } from '../lib/money.js';
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

async function observationFromPage(page, productName) {
  await page.locator('.price-success').waitFor({ state: 'visible', timeout: 5_000 });
  const priceText = await page.locator('.price-main').innerText();
  const prices = priceText.match(/(?:₹|INR)\s*[\d,]+(?:\.\d+)?/gi) ?? [];
  const currentPrice = prices.at(-1);
  if (!currentPrice) throw new ScrapeError('PARSE_FAILED', 'successful price block had no price');

 const stockText = (await page.locator('.price-facets').innerText())
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

let stock;

const quantityMatch = stockText.match(
  /(?:only|just)?\s*(\d+)\s+left\b/i
);

if (/out of stock|sold out|unavailable/.test(stockText) && !quantityMatch) {
  stock = {
    in_stock: false,
    stock_status: 'Out Of Stock',
    stock_qty: 0
  };
} else if (quantityMatch) {
  const quantity = Number(quantityMatch[1]);

  stock = {
    in_stock: true,
    stock_status: quantity === 1 ? 'Only 1 Left' : `Only ${quantity} Left`,
    stock_qty: quantity
  };
} else if (
  /in stock|available|limited stock|few left|selling fast/.test(stockText)
) {
  stock = {
    in_stock: true,
    stock_status: 'In Stock',
    stock_qty: null
  };
} else {
  throw new ScrapeError(
    'PARSE_FAILED',
    `successful price block had unknown stock state: ${stockText}`
  );
}

  const money = parseMoney(currentPrice);
  return Observation.parse({ price: money.amount, currency: money.currency, ...stock, name: productName });
}

async function acceptCookieDialog(page) {
  const button = page.locator(SP.ui.acceptCookies);
  const visible = await button.isVisible().catch(() => false);
  if (!visible) {
    await button.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  }
  if (await button.isVisible().catch(() => false)) await button.click({ timeout: 5_000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.locator('.cookie-overlay').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
}

async function performHumanReveal(page) {
  await acceptCookieDialog(page);
  const retry = page.getByRole('button', { name: /Try again/i });
  if (await retry.isVisible().catch(() => false)) {
    await retry.click({ timeout: SP.limits.requestTimeoutMs });
    return;
  }

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
  await page.waitForFunction(
    (selector) => {
      const button = document.querySelector(selector);
      return button && !button.disabled;
    },
    SP.ui.revealButton,
    { timeout: SP.limits.requestTimeoutMs, polling: 100 },
  );
  await reveal.click({ timeout: SP.limits.requestTimeoutMs });
}

async function createBrowserPage({ headed, slowMo }) {

  const browser = await chromium.launch({
    headless: !headed,
    slowMo,
    args: [
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled'
    ],
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
  return { browser, context, page };
}

async function scrapeAttempt(page, storeProductId, productName, state) {
  try {
    await performHumanReveal(page);
  } catch (error) {
    throw new ScrapeError('UI_TIMEOUT', `reveal interaction failed: ${error.message}`, { retryable: true, cause: error });
  }

  await page.waitForFunction(
    (selector) => {
      const text = document.querySelector(selector)?.textContent ?? '';
      return /Loaded in \d+ attempt|Couldn.t load the price/i.test(text);
    },
    SP.ui.priceBlock,
    { timeout: 12_000, polling: 100 },
  ).catch(() => {
    throw new ScrapeError('TIMEOUT', 'price result did not render', { retryable: true });
  });

  const pageText = await page.locator(SP.ui.priceBlock).innerText().catch(() => 'price reveal failed');
  if (/Couldn.t load the price|challenge_failed|TRY AGAIN/i.test(pageText)) {
    throw new ScrapeError('SESSION_EXPIRED', pageText.slice(0, 300), { retryable: true });
  }
  return { observation: await observationFromPage(page, productName), quote: { f: 'ui-rendered-v1' } };
}

async function scrapeOnce(storeProductId, productName, { headed = false, slowMo = 0 } = {}) {
  const { browser, context, page } = await createBrowserPage({ headed, slowMo });
  let sessionToken = null;
  const state = { sessionToken, sessionStatus: null, priceResponse: null };
  const responses = [];

  page.on('response', async (response) => {
    const path = new URL(response.url()).pathname;
    if (!path.startsWith('/api/')) return;
    responses.push({ path, status: response.status() });
    if (path === SP.paths.session) {
      state.sessionStatus = response.status();
      if (response.ok()) {
        const body = await response.json().catch(() => null);
        state.sessionToken = body?.token ?? null;
      }
    }
    if (path === SP.paths.price(storeProductId) && response.ok()) {
      state.priceResponse = await response.json().catch(() => null);
    }
  });

  try {
    await page.goto(`${SP.baseUrl}/product/${encodeURIComponent(storeProductId)}`, {
      waitUntil: 'domcontentloaded',
      timeout: SP.limits.requestTimeoutMs,
    });
    await acceptCookieDialog(page);
    const result = await scrapeAttempt(page, storeProductId, productName, state);
    return { ...result, responses };
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

/** Keeps one browser context across retries so the flow matches the store's UI retry behavior. */
export async function scrapeViaBrowser(storeProductId, { productName = `Product ${storeProductId}`, headed = false, slowMo = headed ? 250 : 0, maxAttempts = SP.limits.maxAttempts } = {}) {
  const trace = [];
  const { browser, context, page } = await createBrowserPage({ headed, slowMo });
  const state = { sessionToken: null, sessionStatus: null, priceResponse: null };
  const responses = [];
  page.on('response', async (response) => {
    const path = new URL(response.url()).pathname;
    if (!path.startsWith('/api/')) return;
    responses.push({ path, status: response.status() });
  });
  let lastError;
  try {
    await page.goto(`${SP.baseUrl}/product/${encodeURIComponent(storeProductId)}`, { waitUntil: 'domcontentloaded', timeout: SP.limits.requestTimeoutMs });
    await acceptCookieDialog(page);
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const started = Date.now();
      state.sessionToken = null;
      state.sessionStatus = null;
      state.priceResponse = null;
      try {
        const result = await scrapeAttempt(page, storeProductId, productName, state);
        trace.push({ n: attempt, ms: Date.now() - started, status: 200, ok: true, responses: responses.slice() });
        return { observation: result.observation, meta: { strategy: 'browser', extractor: result.quote.f ?? 'encrypted-response-v1', confidence: 'high', attempts: attempt, trace, quoteFormat: result.quote.f ?? null } };
      } catch (rawError) {
        const error = rawError instanceof ScrapeError ? rawError : classify(rawError?.status, rawError) ?? new ScrapeError('BROWSER_FAILURE', String(rawError), { retryable: true, cause: rawError });
        lastError = error;
        const isLast = attempt === SP.limits.maxAttempts || !error.retryable;
        const backoffMs = isLast ? 0 : retryDelay(attempt);
        traceError(trace, attempt, started, error, backoffMs);
        if (isLast) { error.trace = trace; throw error; }
        await sleep(backoffMs);
      }
    }
    throw lastError;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}