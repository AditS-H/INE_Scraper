# Design Note

## Reliability

Recon showed that the INE store does not expose a usable unauthenticated price API. The price flow requires browser-derived attestation, a session token, trusted UI interaction, and an encrypted price response. The scraper therefore uses Playwright for the price tier.

Each product is opened once per scrape attempt set. Cookie consent is accepted when it appears. The scraper performs the real hover and Reveal flow, then clicks the store's Try again action on the same page when the challenge fails. It waits for the rendered success/error state rather than waiting only for a DOM node that exists while the price is hidden.

A product receives six attempts in its first pass. Failed products enter one deferred retry pass after the first batch, and two products can run concurrently through `p-limit(2)`. Full-jitter backoff prevents all products from retrying at the same time.

## Correctness and honest history

A successful result must contain a positive price, three-letter currency, boolean stock state, stock label, and valid optional quantity. Out-of-stock products still retain their valid current price. Stock labels such as `Only 3 left`, `Just 194 left`, and `Selling fast - 53 left` are treated as in stock with a quantity.

A failed scrape never writes to `price_history`. It writes a `scrape_logs` row containing the final outcome, error, duration, and attempt trace. The database also enforces `price > 0`, valid currency length, and non-negative stock quantity.

The runner persists one final result per product after the retry queue completes. Successful queued retries merge their attempt traces so the UI can show the complete path from first failure to success.

## Persistence and scheduling

Supabase stores tracked products, successful price history, scrape logs, run summaries, and a lease lock. The lock prevents overlapping cron runs and expires for crash recovery. The external cron topology is intentional because an in-process timer cannot survive a sleeping Render free instance.

The frontend polls health and product data. Manual scrape requests return `202` immediately and the frontend polls for the resulting log/history update.

## Tradeoffs

| Decision | Choice | Reason |
|---|---|---|
| Price strategy | Playwright browser flow | Required by browser attestation and encrypted price session. |
| Retry model | Same-page retries plus deferred product queue | Matches the store's successful manual Try again behavior and prevents one product from blocking all others. |
| Concurrency | Two products | Improves throughput for I/O-bound browser work while limiting memory and store pressure. |
| Failed history | No history row | A chart gap is truthful; copying the previous price would be misleading. |
| Metadata | Catalogue JSON | Name, brand, SKU, category, and description come directly from the store catalogue response. |

## What went wrong first

1. A money parser regex accidentally excluded digits from formatted currency strings. The parser was corrected and regression-tested.
2. Cookie consent appeared after page load and intercepted hover. Cookie handling now waits for delayed consent and rechecks immediately before every reveal attempt.
3. Initial retries created a new browser context for every attempt. The flow was changed to keep one page/context and click Try again.
4. The store sometimes returned a successful visible price while the response body did not expose the encrypted field consistently. The scraper now uses a guarded rendered-success fallback and still refuses error-state pages.
5. Live stock text varied (`Out of stock`, `Just N left`, `Selling fast - N left`). The parser now recognizes the observed variants and fails closed on unknown labels.
6. The runner initially had no deferred queue. Failed products now receive a later retry pass while other products continue.

## Current verification evidence

- Backend unit tests pass.
- Backend syntax checks pass.
- Frontend lint and production build pass.
- Live catalogue and product details return correctly.
- Five products were persisted through the real Supabase tracking API.
- Concurrent scraper simulation returned valid price/currency/stock for four of five products in one run; one failed honestly without a price.
