# INE Price Tracker — Frontend

React + Vite + TypeScript frontend for the INE product price tracker assignment. Built against
`FRONTEND_INTEGRATION_CONTRACT.md` — every route the contract documents is wired up, whether or
not the backend has shipped it yet (see **Backend status** below).

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4 (via `@tailwindcss/vite`, configured in `src/index.css`)
- TanStack React Query — polling, caching, retry
- React Router v7 (declarative mode) — `/`, `/p/:id`, `/health`
- Recharts — step-after price chart
- Self-hosted fonts (`@fontsource*`) — no external font requests at runtime

No UI or animation library: icons, toasts, and motion are hand-built in `src/components/common/`
and `src/index.css` to keep the bundle small and the look consistent.

## Setup

```bash
npm install
cp .env.example .env
# edit .env — set VITE_API_BASE to your backend URL
npm run dev
```

Build and typecheck:

```bash
npm run build      # tsc -b && vite build -> dist/
npm run lint        # oxlint
npm run preview     # serve the production build locally
```

## Environment variables

| Variable        | Required | Description                                                         |
| ---------------- | -------- | --------------------------------------------------------------------- |
| `VITE_API_BASE`  | Yes      | Base URL of the deployed backend, no trailing slash (e.g. a Render URL). If unset, the app shows a configuration-error screen instead of a broken dashboard. |

## Deploying to Vercel

1. New Project → import this repo → **Root Directory: `frontend`**.
2. Framework preset: Vite (auto-detected).
3. Add the `VITE_API_BASE` environment variable in Vercel's project settings.
4. Deploy. `vercel.json` already rewrites every path to `index.html`, so `/p/:id` and
   `/health` survive a hard refresh.

## Backend status (as of the integration contract this was built against)

Only these routes are live on the backend right now:

- `GET /api/health` (partial — missing `uptimeSec`, `lastRunAt`, `lastRunCounts`, `overdue`)
- `GET /api/store/catalog`, `GET /api/store/search`
- `POST /api/tracked` (tracking a product works end to end)

Everything else the dashboard/detail/health screens need —
`GET /api/tracked`, `GET /api/tracked/:id`, `.../history`, `.../logs`, `DELETE /api/tracked/:id`,
`POST /api/tracked/:id/scrape`, `PATCH /api/tracked/:id`, `GET /api/runs`, `GET /api/alerts` —
is documented in the contract but **not implemented yet**. This frontend is written against the
full contract regardless, so nothing needs to change here once those routes ship.

Until then, every screen that depends on a missing route shows a distinct "waiting on the
backend" panel (blue, informational) rather than a blank page or a generic error (red) — so it's
obvious at a glance which gaps are expected versus an actual bug. The product-detail page also
has one resilience fallback: if `GET /api/tracked/:id` 404s but the product is already present
in a successfully-loaded `GET /api/tracked` list, the page renders from that cached row instead
of going blank.

## Structure

```
src/
  api/          fetch client, typed endpoint functions, TS types (mirrors the contract's §20 exactly)
  hooks/         useApi.ts (all react-query hooks) + small utility hooks
  lib/           formatting (time/money/text), chart data-prep, design constants
  components/
    common/      Icon, badges, empty/error/not-built-yet states, toasts
    layout/      AppShell, health banner, alerts bell
    dashboard/   product card, sparkline
    search/      the command-palette-style track-a-product modal
    detail/      chart, table, log, metadata, actions for /p/:id
  pages/         Dashboard, ProductDetail, Health, ConfigError, NotFound
```

## Design notes

- **Color is functional, not decorative.** Green/amber/red are reserved for scrape outcome
  (`success`/`retried`/`failed`) only, per the contract's "never soften failed" rule. Stock and
  price-change use a separate palette so "out of stock" can never be misread as "the scrape
  failed."
- **No product photography exists in the API**, so cards use a plain monospace-initial tile
  instead of a broken `<img>` or a stock photo standing in for real data.
- **The chart is a step-after line** (not smoothed) because the source data is discrete samples,
  not a continuous signal — matching the contract's own reasoning. Out-of-stock windows are
  shaded directly on the chart.
- Motion is limited to what communicates state changing (a price ticking to its new value on
  update, a live/overdue pulse, cards settling in) — nothing decorative or scroll-triggered,
  and everything respects `prefers-reduced-motion`.
