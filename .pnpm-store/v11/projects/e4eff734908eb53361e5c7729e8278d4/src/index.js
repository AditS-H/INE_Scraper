import cors from 'cors';
import express from 'express';
import { config, hasDatabaseConfig } from './config.js';
import { db } from './db/supabase.js';
import { getCatalog, searchCatalog } from './scraper/catalogClient.js';
import { trackedRouter } from './routes/tracked.js';
import { runsRouter } from './routes/runs.js';
import { alertsRouter } from './routes/alerts.js';
import { startRun } from './services/scrapeRunner.js';
import { syncCatalogToDatabase } from './services/catalogSync.js';

const app = express();
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

app.get('/api/health', async (_request, response, next) => {
  try {
    let lastRun = null;
    if (hasDatabaseConfig) {
      const { data, error } = await db().from('scrape_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      lastRun = data;
    }
    const lastRunAt = lastRun?.finished_at ?? lastRun?.started_at ?? null;
    const overdue = lastRunAt ? Date.now() - new Date(lastRunAt).getTime() > 150 * 60_000 : false;
    response.json({
      ok: true,
      databaseConfigured: hasDatabaseConfig,
      now: new Date().toISOString(),
      uptimeSec: Math.round(process.uptime()),
      lastRunAt,
      lastRunCounts: lastRun ? { total: lastRun.total, success: lastRun.success, retried: lastRun.retried, failed: lastRun.failed } : null,
      overdue,
    });
  } catch (error) { next(error); }
});
app.get('/api/store/catalog', async (request, response, next) => {
  try { response.json(await getCatalog(Number(request.query.page) || 1, Number(request.query.pageSize) || 20)); } catch (error) { next(error); }
});
app.get('/api/store/search', async (request, response, next) => {
  try { response.json({ items: await searchCatalog(request.query.q) }); } catch (error) { next(error); }
});
app.use('/api/tracked', trackedRouter);
app.use('/api/runs', runsRouter);
app.use('/api/alerts', alertsRouter);
app.post('/api/cron/scrape', async (request, response, next) => {
  try {
    if (!config.cronSecret || request.get('x-cron-secret') !== config.cronSecret) return response.status(401).json({ error: 'unauthorized' });
    const run = await startRun({ trigger: 'cron' });
    return response.status(202).json(run);
  } catch (error) { next(error); }
});
app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'internal_error', message: String(error.message ?? error) });
});

app.listen(config.port, () => {
  console.log(`INE backend listening on :${config.port}`);
  if (hasDatabaseConfig) {
    syncCatalogToDatabase()
      .then(({ catalogCount, insertedCount }) => console.log('catalog sync complete', { catalogCount, insertedCount }))
      .catch((error) => console.error('catalog sync failed', error));
  }
});