import { createClient } from '@supabase/supabase-js';
import { config, hasDatabaseConfig } from '../config.js';

let client;

export function db() {
  if (!hasDatabaseConfig) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required for persistence. Use npm run scrape:once for a no-write live scraper check.');
  }
  client ??= createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
