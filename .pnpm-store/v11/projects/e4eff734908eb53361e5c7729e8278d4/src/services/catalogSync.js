import { db } from '../db/supabase.js';
import { collectCompleteCatalog } from '../scraper/catalogClient.js';

const INSERT_BATCH_SIZE = 100;

export async function syncCatalogToDatabase() {
  const catalog = await collectCompleteCatalog({ maxPasses: 12, pageSize: 60 });
  const { data: existing, error: existingError } = await db()
    .from('tracked_products')
    .select('store_product_id');
  if (existingError) throw existingError;

  const existingIds = new Set((existing ?? []).map((row) => String(row.store_product_id)));
  const seenIds = new Set();
  const missing = catalog
    .filter((product) => {
      const id = String(product.id ?? '');
      if (!product.id || !product.name || existingIds.has(id) || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    })
    .map((product) => ({
      store_product_id: String(product.id),
      name: product.name,
      url: `${process.env.STORE_BASE_URL ?? 'https://demo.inelabteamdev.com'}/product/${product.id}`,
      category: product.category ?? null,
      brand: product.brand ?? null,
      description: product.description ?? null,
      is_active: false,
    }));

  for (let start = 0; start < missing.length; start += INSERT_BATCH_SIZE) {
    const { error } = await db().from('tracked_products').insert(missing.slice(start, start + INSERT_BATCH_SIZE));
    if (error) throw error;
  }

  return { catalogCount: catalog.length, insertedCount: missing.length };
}