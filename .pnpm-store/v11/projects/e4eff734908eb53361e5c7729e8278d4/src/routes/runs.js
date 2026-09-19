import { Router } from 'express';
import { db } from '../db/supabase.js';

export const runsRouter = Router();

runsRouter.get('/', async (request, response, next) => {
  try {
    const requestedLimit = Number(request.query.limit ?? 20);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
    const { data, error } = await db().from('scrape_runs').select('*').order('started_at', { ascending: false }).limit(limit);
    if (error) throw error;
    response.json({ items: data ?? [] });
  } catch (error) { next(error); }
});
