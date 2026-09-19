import { db } from '../db/supabase.js';

export async function createAlertsForSuccess(product, observation) {
  // Get the most recent successful price/stock observation.
  const { data: previous, error } = await db()
    .from('price_history')
    .select('price, in_stock, scraped_at')
    .eq('tracked_product_id', product.id)
    .order('scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  // No previous observation = first successful scrape.
  // Don't generate an alert for the first data point.
  if (!previous) return;

  const alerts = [];

  // Price-drop alert
  if (
    Number.isFinite(previous.price) &&
    Number.isFinite(observation.price) &&
    observation.price < previous.price
  ) {
    const percentDrop =
      ((previous.price - observation.price) / previous.price) * 100;

    alerts.push({
      tracked_product_id: product.id,
      kind: 'price_drop',
      message: `${product.name} price dropped from ${previous.price} to ${observation.price} ${observation.currency} (${percentDrop.toFixed(2)}% drop).`,
      old_value: previous.price,
      new_value: observation.price,
    });
  }

  // Back-in-stock alert
  if (previous.in_stock === false && observation.in_stock === true) {
    alerts.push({
      tracked_product_id: product.id,
      kind: 'back_in_stock',
      message: `${product.name} is back in stock.`,
      old_value: 0,
      new_value: 1,
    });
  }

  if (!alerts.length) return;

  const { error: insertError } = await db()
    .from('alerts')
    .insert(alerts);

  if (insertError) throw insertError;
}