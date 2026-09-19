# INE Price Tracker: Remaining Work Plan

Date: 2026-09-19

This document describes what is still missing and how to finish the project in small, testable steps.

## Current State

Already working:

- Store recon report and browser-attested price flow
- Catalogue and product metadata fetching
- Cookie-popup handling
- Browser hover and reveal flow
- Encrypted price response handling
- Price and stock validation
- Retry attempts on the same browser page
- Six attempts per product pass
- One deferred retry pass
- Two concurrent scrape workers
- Honest failure behavior
- Supabase schema and run lock SQL
- Basic Express API
- React/Vite frontend shell
- Search modal and track-product request
- Product chart/table/log UI components
- Backend tests and frontend build

Verified commands:

```text
backend: npm test       -> passed
backend: npm run lint   -> passed
frontend: npm run build -> passed
frontend: npm run lint  -> passed
```

Important limitation: Supabase credentials are not configured in the local workspace, so real database persistence has not yet been tested.

---

# Priority Order

Complete the work in this order:

1. Configure Supabase and apply the schema.
2. Finish backend tracked-product routes.
3. Finish health/run routes.
4. Connect and test the frontend against the backend.
5. Add integration tests for five tracked products.
6. Add README, design note, and CI.
7. Deploy backend and frontend.
8. Configure external cron and collect real history.
9. Record the headed demo and prepare submission.

Do not deploy the frontend before the backend routes exist. The frontend is already wired to those contracts, but it currently shows `NotBuiltYet` for missing routes.

---

# Step 1: Configure Supabase

## 1.1 Create or open the Supabase project

Create a Supabase project in Singapore or Frankfurt.

## 1.2 Apply the schema

Open the Supabase SQL editor and run:

```text
backend/src/db/schema.sql
```

Confirm these tables exist:

```text
tracked_products
price_history
scrape_logs
scrape_runs
run_locks
```

## 1.3 Create the local backend environment file

Copy:

```text
backend/.env.example -> backend/.env
```

Fill in:

```env
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key>
CRON_SECRET=<random-secret>
CORS_ORIGINS=http://localhost:5173
STORE_BASE_URL=https://demo.inelabteamdev.com
MAX_ATTEMPTS=6
RETRY_PASSES=1
SCRAPE_CONCURRENCY=2
RUN_BUDGET_MS=480000
```

Never put `SUPABASE_SERVICE_KEY` or `CRON_SECRET` in the frontend.

## 1.4 Verify database connectivity

Start the backend:

```powershell
cd backend
npm start
```

Call:

```powershell
Invoke-RestMethod http://localhost:10000/api/health
```

Expected:

```json
{
  "ok": true,
  "databaseConfigured": true
}
```

---

# Step 2: Finish the Tracked Product API

File to update:

```text
backend/src/index.js
```

Create route modules if preferred:

```text
backend/src/routes/tracked.js
backend/src/routes/runs.js
backend/src/routes/alerts.js
```

## 2.1 Add `GET /api/tracked`

Query active products:

```text
tracked_products where is_active = true
```

Return:

```json
{
  "items": [
    {
      "id": "uuid",
      "store_product_id": "733",
      "name": "Ironwood Convertible X",
      "url": "https://demo.inelabteamdev.com/product/733",
      "category": "Laptops",
      "brand": "Ironwood",
      "description": "...",
      "is_active": true,
      "scrape_interval_min": 120,
      "next_due_at": "2026-09-19T14:00:00.000Z",
      "last_scrape_at": "2026-09-19T12:00:00.000Z",
      "last_outcome": "retried",
      "last_price": 71219,
      "last_currency": "INR",
      "last_in_stock": false,
      "consecutive_failures": 0,
      "previous_price": 72000,
      "price_delta": -781,
      "price_delta_percent": -1.08,
      "history_24h": []
    }
  ]
}
```

Implementation steps:

1. Select active `tracked_products`.
2. For each product, query the latest two `price_history` rows.
3. Calculate price delta.
4. Query the last 24-hour history points for the sparkline.
5. Return `{ items }`.

Validation:

```powershell
Invoke-RestMethod http://localhost:10000/api/tracked
```

## 2.2 Add `GET /api/tracked/:id`

Return:

```json
{
  "product": { "id": "uuid", "name": "Ironwood Convertible X" },
  "latest": {
    "price": 71219,
    "currency": "INR",
    "in_stock": false,
    "stock_status": "Out Of Stock",
    "stock_qty": 0,
    "scraped_at": "2026-09-19T12:00:00.000Z"
  }
}
```

Implementation steps:

1. Load one `tracked_products` row by UUID.
2. Return `404` if not found.
3. Load the latest `price_history` row.
4. Return `latest: null` when no successful scrape exists.

## 2.3 Add `GET /api/tracked/:id/history`

Request:

```text
GET /api/tracked/:id/history?range=24h
```

Valid ranges:

```text
24h | 7d | 30d | all
```

Implementation steps:

1. Convert the range into a UTC cutoff.
2. Query `price_history` by `tracked_product_id`.
3. Sort by `scraped_at` ascending.
4. Return only successful history rows.
5. Never add failed scrape rows or fake values.

Response:

```json
{
  "productId": "uuid",
  "range": "24h",
  "items": []
}
```

## 2.4 Add `GET /api/tracked/:id/logs`

Request:

```text
GET /api/tracked/:id/logs?limit=100
```

Implementation steps:

1. Parse and cap `limit`, for example between 1 and 500.
2. Query `scrape_logs` by product UUID.
3. Sort newest first.
4. Include `attempt_trace`.
5. Return failed rows without hiding them.

## 2.5 Add `DELETE /api/tracked/:id`

Implementation:

```text
UPDATE tracked_products SET is_active = false WHERE id = :id
```

Do not delete the database row. Preserve all history and logs.

Return:

```json
{
  "id": "uuid",
  "is_active": false
}
```

## 2.6 Add `PATCH /api/tracked/:id`

Request:

```json
{
  "scrape_interval_min": 60
}
```

Validate:

- Integer
- Greater than zero
- Reasonable maximum, such as 24 hours

Return the updated tracked product.

---

# Step 3: Add Manual Scrape Route

Route:

```text
POST /api/tracked/:id/scrape
```

Implementation steps:

1. Load the tracked product.
2. Return `404` if it does not exist or is inactive.
3. Enforce one manual request per product per minute.
4. Start a background run for this product.
5. Return immediately with `202`.

Response:

```json
{
  "accepted": true,
  "runId": "uuid",
  "productId": "uuid"
}
```

The frontend already polls faster for 90 seconds after this request.

Do not make the browser wait for the entire Playwright scrape.

---

# Step 4: Improve Health and Run Routes

## 4.1 Expand `GET /api/health`

Current health is too small. Add:

```json
{
  "ok": true,
  "databaseConfigured": true,
  "now": "2026-09-19T12:00:00.000Z",
  "uptimeSec": 500,
  "lastRunAt": "2026-09-19T10:00:00.000Z",
  "lastRunCounts": {
    "total": 5,
    "success": 4,
    "retried": 1,
    "failed": 0
  },
  "overdue": false
}
```

`overdue` should be true when the last run is older than 150 minutes.

## 4.2 Add `GET /api/runs`

Request:

```text
GET /api/runs?limit=20
```

Return recent `scrape_runs` rows with duration available from `started_at` and `finished_at`.

---

# Step 5: Add Alerts Routes

These are bonus features, but the frontend already supports them.

## 5.1 Add `GET /api/alerts`

Return unread and recent alerts, newest first.

## 5.2 Add `POST /api/alerts/:id/read`

Set:

```text
is_read = true
```

The alert table already exists in the specification, but the current schema should be checked to ensure the `alerts` table is present before using these routes.

---

# Step 6: Verify the Five-Product Customer Flow

After Supabase is configured:

## 6.1 Choose five products

Use the live catalogue:

```text
GET /api/store/catalog?page=1&pageSize=20
```

Select five product items.

## 6.2 Track all five

For each item, call:

```http
POST /api/tracked
Content-Type: application/json
```

Example body:

```json
{
  "store_product_id": "733",
  "name": "Ironwood Convertible X",
  "url": "https://demo.inelabteamdev.com/product/733",
  "category": "Laptops",
  "brand": "Ironwood",
  "description": "..."
}
```

Confirm each returns `201`.

## 6.3 Verify dashboard list

Call:

```text
GET /api/tracked
```

Confirm all five products appear.

## 6.4 Run the scrape cycle

Call the protected cron route:

```http
POST /api/cron/scrape
x-cron-secret: <CRON_SECRET>
```

Expected immediate response:

```json
{
  "runId": "uuid",
  "skipped": false
}
```

## 6.5 Verify persistence

After the background run completes, verify:

- One `scrape_logs` row per tracked product.
- Successful products have one new `price_history` row.
- Failed products have no new `price_history` row.
- `tracked_products.last_price` is updated only for success.
- `consecutive_failures` resets on success.
- Two products are processed concurrently.
- Failed first-pass products appear in the retry pass.

## 6.6 Verify the frontend

Open:

```text
/
/p/<tracked-product-uuid>
/health
```

Confirm:

- Search works.
- Tracking state changes to Tracking.
- Dashboard cards appear.
- Prices and stock are visible.
- Chart and table show successful history.
- Failed logs remain visible.
- Manual scrape shows an accepted state.
- Overdue warning appears when expected.

---

# Step 7: Add Tests

Current tests cover money parsing and quote decryption only. Add these small test files:

```text
backend/tests/errors.test.js
backend/tests/stock.test.js
backend/tests/extractors.test.js
backend/tests/scrapeRunner.test.js
backend/tests/api.test.js
```

## 7.1 Error tests

Verify:

- `404` is not retryable.
- `503` is retryable.
- `401` and `403` are retryable.
- Unknown errors are not silently treated as success.

## 7.2 Stock tests

Verify:

- `Out of stock` -> false.
- `In stock` -> true.
- `Only 3 left` -> true with quantity 3.
- `Just 194 left` -> true with quantity 194.
- `Selling fast - 53 left` -> true with quantity 53.
- Unknown label throws.

## 7.3 Browser/parser tests

Use fixture payloads or visible-state fixtures for:

- Current price extraction.
- List price plus current price.
- Out-of-stock with valid price.
- In-stock quantity text.
- Challenge failure.
- Successful rendered price.

## 7.4 Runner tests

Mock `scrapeProduct` and verify:

- Two products can be active at once.
- Failed first-pass products enter the retry queue.
- A successful retry is persisted once.
- A final failure writes no history row.
- Counts are correct.

## 7.5 API tests

Verify all tracked/history/log routes with a mocked Supabase client or test project.

---

# Step 8: Add Required Documentation

Create these root files:

```text
README.md
DESIGN_NOTE.md
```

## README must include

- Project purpose
- Architecture
- Local setup
- Environment variables
- Supabase setup
- Backend commands
- Frontend commands
- Scrape schedule
- API summary
- Deployment instructions
- Live URLs once deployed

## DESIGN_NOTE must include

1. Scraping reliability approach.
2. Browser attestation decision.
3. Retry and queue design.
4. Why two concurrent workers are used.
5. Honest failure/history invariant.
6. Supabase schema constraints.
7. What AI suggestions were wrong and how they were corrected.

Be honest that this store requires Playwright because recon showed browser attestation. Do not claim an HTTP-only production scraper if the actual implementation uses Playwright.

---

# Step 9: Add CI

Create:

```text
.github/workflows/ci.yml
```

Run on push and pull request:

```yaml
- backend npm ci
- backend npm run lint
- backend npm test
- frontend npm ci
- frontend npm run lint
- frontend npm run build
```

Do not include secrets in the workflow source.

---

# Step 10: Deployment

## 10.1 Render backend

Settings:

```text
Root directory: backend
Build command: npm ci
Start command: npm start
```

Environment variables:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
CRON_SECRET=...
CORS_ORIGINS=https://<vercel-app>.vercel.app
STORE_BASE_URL=https://demo.inelabteamdev.com
MAX_ATTEMPTS=6
RETRY_PASSES=1
SCRAPE_CONCURRENCY=2
RUN_BUDGET_MS=480000
```

Important: Playwright may not fit on Render free tier. If browser scraping is required in production, use a separate worker or GitHub Actions runner. Do not blindly install Chromium on a 512 MB Render instance.

## 10.2 Vercel frontend

Settings:

```text
Root directory: frontend
Framework: Vite
Environment variable: VITE_API_BASE=https://<render-service>.onrender.com
```

The existing `frontend/vercel.json` handles SPA route fallback.

## 10.3 External cron

Warm-up job:

```text
GET https://<render-service>.onrender.com/api/health
```

Scrape job:

```text
POST https://<render-service>.onrender.com/api/cron/scrape
Header: x-cron-secret: <CRON_SECRET>
```

Schedule every two hours, with warm-up approximately five minutes before the scrape trigger.

---

# Step 11: Final Acceptance Checklist

## Functionality

- [ ] Search returns live store products.
- [ ] Tracking five products returns `201` for each.
- [ ] Five products appear in `GET /api/tracked`.
- [ ] Cron trigger returns `202`.
- [ ] Two products scrape concurrently.
- [ ] Failed first-pass products enter the retry queue.
- [ ] Successful retries are persisted once.
- [ ] Successful scrapes create history rows.
- [ ] Failed scrapes create logs but no history rows.
- [ ] Out-of-stock products can still have valid prices.
- [ ] Price history chart works.
- [ ] Price history table works.
- [ ] Scrape logs show all attempts.
- [ ] Manual scrape works.
- [ ] Stop tracking preserves history.
- [ ] Health page shows run information.

## Quality

- [ ] Backend tests pass.
- [ ] Frontend typecheck/build passes.
- [ ] Frontend lint passes.
- [ ] No service-role key appears in frontend files or build output.
- [ ] No secrets are committed.
- [ ] CI workflow passes.

## Deployment

- [ ] Supabase schema applied.
- [ ] Render backend reachable.
- [ ] Vercel frontend reachable.
- [ ] CORS works.
- [ ] Cron warm-up job works.
- [ ] Cron scrape job works.
- [ ] At least three real scrape cycles exist.
- [ ] Dashboard contains real history data.

## Submission

- [ ] Public repository.
- [ ] Live frontend URL.
- [ ] Live backend health URL.
- [ ] Demo recording.
- [ ] README.
- [ ] DESIGN_NOTE.
- [ ] Recon report.
- [ ] HAR/cURL evidence if available.
- [ ] Resume PDF.
- [ ] Submission email sent before the deadline.

---

# Definition Of Done

The project is complete when a new user can:

1. Open the deployed frontend.
2. Search the live INE catalogue.
3. Track five products.
4. See all five in the dashboard.
5. Trigger or wait for a scrape run.
6. See valid price and stock data for successful products.
7. See honest failure logs for unsuccessful attempts.
8. Open a product detail page.
9. View history as a chart and table.
10. View every scrape attempt.
11. See the system health state.

At the current point, the scraper and frontend foundations are strong, but the missing backend data routes and Supabase configuration are the main blockers to this definition of done.
