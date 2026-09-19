import { db } from '../db/supabase.js';

const LOCK_KEY = 'scrape-run';

export async function acquireLock(runId, leaseMs = 15 * 60_000) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseMs);
  const { data, error } = await db().rpc('acquire_run_lock', {
    p_key: LOCK_KEY,
    p_run_id: runId,
    p_now: now.toISOString(),
    p_expires: expiresAt.toISOString(),
  });
  if (error) throw error;
  return data === true;
}

export async function releaseLock(runId) {
  const { error } = await db().from('run_locks').delete().eq('key', LOCK_KEY).eq('run_id', runId);
  if (error) throw error;
}
