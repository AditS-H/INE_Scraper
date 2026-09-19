import { Router } from 'express';
import { db } from '../db/supabase.js';
import { startRun } from '../services/scrapeRunner.js';

export const trackedRouter = Router();
const manualRequests = new Map();

trackedRouter.get('/', async (request, response, next) => {
  try {
    const { data: products, error } = await db()
      .from('tracked_products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (error) throw error;

    const items = await Promise.all((products ?? []).map(async (product) => {
      const [historyResult, sparklineResult] = await Promise.all([
        db().from('price_history').select('price').eq('tracked_product_id', product.id).order('scraped_at', { ascending: false }).limit(2),
        db().from('price_history').select('scraped_at,price,currency,in_stock,stock_status').eq('tracked_product_id', product.id).gte('scraped_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).order('scraped_at', { ascending: true }),
      ]);
      if (historyResult.error) throw historyResult.error;
      if (sparklineResult.error) throw sparklineResult.error;
      const latest = historyResult.data?.[0]?.price ?? null;
      const previous = historyResult.data?.[1]?.price ?? null;
      const delta = latest !== null && previous !== null ? latest - previous : null;
      return {
        ...product,
        previous_price: previous,
        price_delta: delta,
        price_delta_percent: delta !== null && previous ? (delta / previous) * 100 : null,
        history_24h: sparklineResult.data ?? [],
      };
    }));
    response.json({ items });
  } catch (error) { next(error); }
});

trackedRouter.post('/', async (request, response, next) => {
  try {
    const { store_product_id, name, url, category, brand, description } = request.body ?? {};
    if (!store_product_id || !name) return response.status(400).json({ error: 'store_product_id and name are required' });
    const row = {
      store_product_id: String(store_product_id), name, url, category, brand, description,
      is_active: true,
      next_due_at: new Date().toISOString(),
    };
    const { data, error } = await db().from('tracked_products').upsert(row, { onConflict: 'store_product_id' }).select().single();
    if (error) throw error;
    response.status(201).json(data);
  } catch (error) { next(error); }
});

trackedRouter.get('/:id', async (request, response, next) => {
  try {
    const product = await findProduct(request.params.id);
    if (!product) return response.status(404).json({ error: 'tracked product not found' });
    const { data: latest, error } = await db().from('price_history').select('price,currency,in_stock,stock_status,stock_qty,scraped_at').eq('tracked_product_id', product.id).order('scraped_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    response.json({ product, latest: latest ?? null });
  } catch (error) { next(error); }
});

trackedRouter.get('/:id/history', async (request, response, next) => {
  try {
    const product = await findProduct(request.params.id);
    if (!product) return response.status(404).json({ error: 'tracked product not found' });
    const range = String(request.query.range ?? '24h');
    const durations = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };
    if (range !== 'all' && !durations[range]) return response.status(400).json({ error: 'range must be 24h, 7d, 30d, or all' });
    let query = db().from('price_history').select('*').eq('tracked_product_id', product.id).order('scraped_at', { ascending: true });
    if (range !== 'all') query = query.gte('scraped_at', new Date(Date.now() - durations[range] * 60 * 60 * 1000).toISOString());
    const { data, error } = await query;
    if (error) throw error;
    response.json({ productId: product.id, range, items: data ?? [] });
  } catch (error) { next(error); }
});

trackedRouter.get('/:id/logs', async (request, response, next) => {
  try {
    const product = await findProduct(request.params.id);
    if (!product) return response.status(404).json({ error: 'tracked product not found' });
    const requestedLimit = Number(request.query.limit ?? 100);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
    const { data, error } = await db().from('scrape_logs').select('*').eq('tracked_product_id', product.id).order('started_at', { ascending: false }).limit(limit);
    if (error) throw error;
    response.json({ productId: product.id, items: data ?? [] });
  } catch (error) { next(error); }
});

trackedRouter.delete('/:id', async (request, response, next) => {
  try {
    const { data, error } = await db().from('tracked_products').update({ is_active: false }).eq('id', request.params.id).select('id,is_active').maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: 'tracked product not found' });
    response.json(data);
  } catch (error) { next(error); }
});

trackedRouter.patch('/:id', async (request, response, next) => {
  try {
    const interval = Number(request.body?.scrape_interval_min);
    if (!Number.isInteger(interval) || interval < 1 || interval > 24 * 60) return response.status(400).json({ error: 'scrape_interval_min must be an integer from 1 to 1440' });
    const { data, error } = await db().from('tracked_products').update({ scrape_interval_min: interval }).eq('id', request.params.id).select().maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: 'tracked product not found' });
    response.json(data);
  } catch (error) { next(error); }
});

trackedRouter.post('/:id/scrape', async (request, response, next) => {
  try {
    const product = await findProduct(request.params.id);
    if (!product || !product.is_active) return response.status(404).json({ error: 'active tracked product not found' });
    const now = Date.now();
    const last = manualRequests.get(product.id) ?? 0;
    if (now - last < 60_000) return response.status(429).json({ error: 'manual scrape limited to once per minute per product' });
    manualRequests.set(product.id, now);
    const run = await startRun({ trigger: 'manual', productIds: [product.id] });
    if (run.skipped) return response.status(409).json({ error: run.reason, runId: null, productId: product.id });
    response.status(202).json({ accepted: true, runId: run.runId, productId: product.id });
  } catch (error) { next(error); }
});

async function findProduct(id) {
  const { data, error } = await db().from('tracked_products').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}