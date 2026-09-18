import { getProductDetails } from '../scraper/catalogClient.js';
import { scrapeProduct } from '../scraper/index.js';

const args = Object.fromEntries(process.argv.slice(2).flatMap((value, index, values) => value.startsWith('--') ? [[value.slice(2), values[index + 1]]] : []));
if (!args.product) {
  console.error('Usage: npm run scrape:headed -- --product <storeProductId>');
  process.exitCode = 1;
} else {
  const details = await getProductDetails(args.product);
  const result = await scrapeProduct({ store_product_id: String(args.product), name: details.name ?? `Product ${args.product}` }, { headed: true });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 2;
}
