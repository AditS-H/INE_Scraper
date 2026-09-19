import { Router } from 'express';
import { db } from '../db/supabase.js';

export const alertsRouter = Router();

alertsRouter.get('/', async (request, response, next) => {
  try {
    const requestedLimit = Number(request.query.limit ?? 50);
    const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 50;
    const { data, error } = await db().from('alerts').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) throw error;
    response.json({ items: data ?? [] });
  } catch (error) { next(error); }
});

alertsRouter.post('/:id/read', async (request, response, next) => {
  try {
    const { data, error } = await db().from('alerts').update({ is_read: true }).eq('id', request.params.id).select('id,is_read').maybeSingle();
    if (error) throw error;
    if (!data) return response.status(404).json({ error: 'alert not found' });
    response.json(data);
  } catch (error) { next(error); }
});
