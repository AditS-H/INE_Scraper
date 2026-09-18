import { getProductDetails } from '../scraper/catalogClient.js';
import { scrapeProduct } from '../scraper/index.js';

const args = Object.fromEntries(process.argv.slice(2).flatMap((value, index, values) => value.startsWith('--') ? [[value.slice(2), values[index + 1]]] : []));
const productId = args.product;
if (!productId) {
  console.error('Usage: npm run scrape:once -- --product <storeProductId>');
  process.exitCode = 1;
} else {
  try {
    const details = await getProductDetails(productId);
    const result = await scrapeProduct({ store_product_id: String(productId), name: details.name ?? `Product ${productId}` });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 2;
  } catch (error) {
    console.error(error);
    process.exitCode = 2;
  }
}
