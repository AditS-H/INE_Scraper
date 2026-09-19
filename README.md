# INE Price Tracker

A price and stock tracker built for the INE assignment.

The app lets users search the mock store catalog, track products, and keep a history of price and stock changes. Scraping is handled in the backend with Playwright and runs automatically for products that are due.

## Live

- **Frontend:** https://ine-scraper.vercel.app
- **Backend:** https://ine-scraper-oun5.onrender.com

## What it does

- Search the mock store catalog by product name
- Track and untrack products
- Scrape price and stock information
- Store price and stock history
- Keep per-product scrape logs
- Retry temporary scraping failures
- Scrape multiple products concurrently
- Run scheduled scraping without the frontend being open
- Show recent scrape runs and backend health
- Show price-drop and back-in-stock alerts
- Detect scraping/page structure problems through scraper errors
- Support configurable scrape intervals
- Run automated CI checks with GitHub Actions

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- React Query
- Recharts
- Tailwind CSS

### Backend

- Node.js
- Express
- Playwright
- p-limit
- Zod

### Database

- Supabase / PostgreSQL

### Deployment

- Vercel — frontend
- Render — backend
- cron-job.org — scheduled backend triggers
- GitHub Actions — CI

## Project Structure

```text
INE_project/
├── backend/
│   ├── src/
│   │   ├── db/
│   │   ├── lib/
│   │   ├── routes/
│   │   ├── scraper/
│   │   ├── scripts/
│   │   ├── services/
│   │   ├── config.js
│   │   └── index.js
│   ├── tests/
│   └── package.json
│
├── frontend/
│   ├── src/
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
└── README.md
````

## How the Scraper Works

Tracked products are stored in Supabase.

Each product has its own:

* `scrape_interval_min`
* `next_due_at`
* active/inactive state

The current scrape interval is **120 minutes (2 hours)**.

cron-job.org sends:

```text
POST /api/cron/scrape
```

every 10 minutes.

The 10-minute cron is only used as a polling/wake-up mechanism. The backend checks which products are actually due and only scrapes those.

The selection logic is effectively:

```text
is_active = true
AND next_due_at <= current time
```

This keeps the actual product scrape interval at approximately 2 hours while allowing the Render backend to be reached regularly.

## Scraping Reliability

The scraper uses Playwright because the mock store requires browser-based interaction.

Scraping is limited to two concurrent product jobs:

```text
SCRAPE_CONCURRENCY=2
```

Retries are handled in passes:

```text
2 attempts per pass
3 passes maximum

2 × 3 = 6 attempts maximum per product
```

Retryable failures are given another pass, while non-retryable failures are recorded without unnecessarily repeating the same operation.

The scraper also has a run-time budget so a single long-running run cannot block the system indefinitely.

## Data Handling

Successful scrapes are stored in `price_history`.

Every scrape result is also stored in `scrape_logs`, including failures.

Failed scrapes do not write invalid price or stock values into price history.

Tracked products also keep their latest:

* Price
* Currency
* Stock state
* Scrape status
* Next scheduled scrape time
* Consecutive failure count

## Alerts

The app supports in-app alerts for:

* Price drops
* Back-in-stock events

Alerts are generated from successful scrape results by comparing the latest observation with the previous successful observation.

## CI/CD

GitHub Actions runs on pushes and pull requests.

### Backend checks

```bash
npm ci
npm run lint
npm test
```

### Frontend checks

```bash
npm ci
npm run lint
npm run build
```

The production backend is deployed through Render after the repository CI checks pass.

The production frontend is deployed through Vercel using its GitHub integration.

The overall flow is:

```text
Git push
   ↓
GitHub Actions
   ↓
Lint + tests + build
   ↓
CI passes
   ↓
Render deploys backend
Vercel deploys frontend
```

## Environment Variables

### Backend

Create:

```text
backend/.env
```

Example:

```env
PORT=10000

STORE_BASE_URL=https://demo.inelabteamdev.com

SUPABASE_URL=
SUPABASE_SERVICE_KEY=

CRON_SECRET=
CORS_ORIGINS=https://ine-scraper.vercel.app

MAX_ATTEMPTS=2
RETRY_PASSES=2
SCRAPE_CONCURRENCY=2
RUN_BUDGET_MS=480000

PLAYWRIGHT_HEADLESS=true
```

Do not commit real secret values to GitHub.

### Frontend

Create the required frontend environment variables in:

```text
frontend/.env
```

Do not commit secret values.

## Running Locally

### Backend

```bash
cd backend
npm install
npm run dev
```

The backend will start using the configured environment variables.

### Frontend

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Useful Backend Commands

Run tests:

```bash
cd backend
npm test
```

Check backend syntax:

```bash
npm run lint
```

Run a single scrape:

```bash
npm run scrape:once
```

Run a headed scrape:

```bash
npm run scrape:headed
```

## Scheduling

Tracked products currently use:

```text
scrape_interval_min = 120
```

which means each product is scheduled approximately every 2 hours.

The external scheduler runs every 10 minutes and checks for products whose `next_due_at` has arrived.

This separates the scheduler polling interval from the actual product scrape interval:

```text
Cron polling:       10 minutes
Product scraping:   120 minutes
```

## Notes

The scraper was tested against the provided mock store, including slow responses, retry scenarios, browser scraping, and different stock states.
