import 'dotenv/config';

const int = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const config = {
  port: int('PORT', 10000),
  storeBaseUrl: process.env.STORE_BASE_URL ?? 'https://demo.inelabteamdev.com',
  requestTimeoutMs: int('REQUEST_TIMEOUT_MS', 30_000),
  maxAttempts: int('MAX_ATTEMPTS', 6),
  retryPasses: int('RETRY_PASSES', 1),
  scrapeConcurrency: int('SCRAPE_CONCURRENCY', 2),
  runBudgetMs: int('RUN_BUDGET_MS', 8 * 60_000),
  cronSecret: process.env.CRON_SECRET ?? '',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((v) => v.trim()),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY ?? '',
  playwrightHeadless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
  playwrightExecutable: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
};

export const hasDatabaseConfig = Boolean(config.supabaseUrl && config.supabaseServiceKey);