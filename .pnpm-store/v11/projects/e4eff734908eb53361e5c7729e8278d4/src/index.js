import cors from 'cors';
import express from 'express';
import { config, hasDatabaseConfig } from './config.js';
import { db } from './db/supabase.js';
import { getCatalog, searchCatalog } from './scraper/catalogClient.js';
import { startRun } from './services/scrapeRunner.js';

const app = express();
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

app.get('/api/health', (_request, response) => response.json({ ok: true, databaseConfigured: hasDatabaseConfig, now: new Date().toISOString() }));
app.get('/api/store/catalog', async (request, response, next) => {
  try { response.json(await getCatalog(Number(request.query.page) || 1, Number(request.query.pageSize) || 20)); } catch (error) { next(error); }
});
app.get('/api/store/search', async (request, response, next) => {
  try { response.json({ items: await searchCatalog(request.query.q) }); } catch (error) { next(error); }
});
app.post('/api/tracked', async (request, response, next) => {
  try {
    const { store_product_id, name, url, category, brand, description } = request.body ?? {};
    if (!store_product_id || !name) return response.status(400).json({ error: 'store_product_id and name are required' });
    const { data, error } = await db().from('tracked_products').upsert({ store_product_id, name, url, category, brand, description }, { onConflict: 'store_product_id' }).select().single();
    if (error) throw error;
    response.status(201).json(data);
  } catch (error) { next(error); }
});
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

app.listen(config.port, () => console.log(`INE backend listening on :${config.port}`));
