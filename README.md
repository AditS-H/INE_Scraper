# INE Product Price Tracker

A full-stack price and stock tracker for `https://demo.inelabteamdev.com/`.

## Architecture

```text
React/Vite frontend -> Express backend -> Supabase Postgres
                                      -> Playwright store scraper
External cron        -> POST /api/cron/scrape
```

The store catalogue and product metadata are public JSON. Price retrieval is browser-attested: the scraper opens the product page, accepts delayed cookie consent, hovers the price block, clicks Reveal, retries Try again on the same page, and validates the rendered price and stock state.

## Local setup

### Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
# Fill in SUPABASE_URL, SUPABASE_SERVICE_KEY, and CRON_SECRET
npm start
```

Apply `backend/src/db/schema.sql` in the Supabase SQL editor. Re-run it after schema updates, including the alerts table migration.

### Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
# Set VITE_API_BASE=http://localhost:10000
npm run dev
```

## Backend commands

| Command | Purpose |
|---|---|
| `npm start` | Start Express |
| `npm run dev` | Start Express with watch mode |
| `npm test` | Run backend tests |
| `npm run lint` | Check backend syntax |
| `node src/scripts/scrapeOnce.mjs --product 733` | Run a no-write live scrape |
| `node src/scripts/headedRun.mjs --product 733` | Run a visible browser scrape |

## Environment variables

```env
PORT=10000
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_KEY=<service-role-key; backend only>
CRON_SECRET=<random-secret>
CORS_ORIGINS=http://localhost:5173
STORE_BASE_URL=https://demo.inelabteamdev.com
PLAYWRIGHT_HEADLESS=true
PLAYWRIGHT_CHROMIUM_EXECUTABLE=
REQUEST_TIMEOUT_MS=30000
MAX_ATTEMPTS=6
RETRY_PASSES=1
SCRAPE_CONCURRENCY=2
RUN_BUDGET_MS=480000
```

The frontend only uses:

```env
VITE_API_BASE=http://localhost:10000
```

## API

Implemented routes:

```text
GET  /api/health
GET  /api/store/catalog?page=1&pageSize=20
GET  /api/store/search?q=laptop
GET  /api/tracked
POST /api/tracked
GET  /api/tracked/:id
GET  /api/tracked/:id/history?range=24h|7d|30d|all
GET  /api/tracked/:id/logs?limit=100
PATCH /api/tracked/:id
DELETE /api/tracked/:id
POST /api/tracked/:id/scrape
GET  /api/runs?limit=20
GET  /api/alerts
POST /api/alerts/:id/read
POST /api/cron/scrape
```

`POST /api/cron/scrape` is for the external scheduler only and requires `x-cron-secret`.

## Data integrity

- `price_history` contains successful validated observations only.
- Failed attempts create `scrape_logs` rows and no history row.
- Prices must be positive at both application and database level.
- Out-of-stock products can still have valid prices.
- Unknown stock states fail closed instead of being assumed in stock.
- Each product is attempted six times per pass, then failed products enter one deferred retry pass.
- Two products can scrape concurrently through `p-limit(2)`.

## Deployment

### Render

- Root directory: `backend`
- Build command: `npm ci`
- Start command: `npm start`
- Configure all backend environment variables.
- Set `CORS_ORIGINS` to the Vercel origin.

Playwright browser memory should be evaluated before using the free Render tier. A separate worker or GitHub Actions runner may be required for browser scraping.

### Vercel

- Root directory: `frontend`
- Framework: Vite
- Set `VITE_API_BASE` to the Render service URL.

### External cron

Warm-up:

```text
GET https://<render-service>.onrender.com/api/health
```

Scrape trigger every two hours:

```text
POST https://<render-service>.onrender.com/api/cron/scrape
x-cron-secret: <CRON_SECRET>
```

## Verification

```powershell
cd backend
npm test
npm run lint

cd ..\frontend
npm run lint
npm run build
```
