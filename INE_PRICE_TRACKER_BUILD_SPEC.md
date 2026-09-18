# INE Product Price Tracker — Complete Build Specification

**Target:** INE Software Engineer Intern Assignment — Product Price Tracker (Web Scraping)
**Store:** `https://demo.inelabteamdev.com/`
**Deadline:** 2026-09-20 23:59 IST
**Stack (mandated):** React/Vue on Vercel · Node+Express or Django on Render · Supabase Postgres · external cron · Playwright/Puppeteer only where genuinely needed

This document is written to be handed directly to an AI coding agent (Claude Code, Cursor, Codex) or a
human. It is prescriptive. Where a decision is left open it is marked **[DECIDE AFTER RECON]** and the
decision rule is given.

---

## 0. READ THIS FIRST — instructions to the implementing agent

1. **Do Phase 1 (recon) before writing a single line of scraper code.** The whole architecture hangs on
   one unknown: how the "reveal price" step is gated. Phase 1 produces `docs/recon-report.json`. Every
   later phase reads from it. Do not guess. Do not skip.
2. **Fill `backend/src/scraper/storeProfile.js` from the recon report.** That file is the only place
   store-specific knowledge lives. No selectors, URLs, or field names anywhere else in the codebase.
3. **Build order is fixed** (see §2). It is ordered so that at every checkpoint you have a submittable
   artifact. If you run out of time, you stop at a checkpoint and still submit something coherent.
4. **Non-negotiable invariant:** a scrape either produces a *validated* `(price, currency, stock)` tuple
   that gets written to `price_history`, **or** it writes nothing to `price_history` and writes a
   `failed` row to `scrape_logs`. There is no third outcome. Never write `NULL`/`0`/`"N/A"` prices.
   The grader is explicitly testing this.
5. **Every attempt is logged, including retries and failures.** The brief says "Failures must be recorded
   honestly, not hidden." Treat a hidden failure as a build-breaking bug.
6. **The production scrape path must not require a browser** unless recon proves otherwise. Render's free
   tier is 512 MB RAM / 0.1 CPU; Chromium will OOM or thrash. Browser tier exists for (a) the mandated
   headed recording, (b) an explicit fallback, ideally hosted on GitHub Actions rather than Render.
7. **Do not scrape anything except `demo.inelabteamdev.com`.** Explicit rule in the brief.

### Grading weights (from the brief) — optimise for these in this order

| Weight | Criterion | Where this spec addresses it |
|---|---|---|
| 1 | Scraping reliability across many unattended runs | §5 HTTP client, §6 orchestrator, §7 run lock + budget, §11 watchdog |
| 2 | Correctness under difficulty (late content, slow responses, never wrong/empty data) | §5.4 extractor ladder, §5.5 validation gate, §5.6 two-source agreement |
| 3 | Honest history and logging | §4 schema, §7.3 log writer, §9 UI log table |
| 4 | Judgment (HTTP vs browser, free-tier scheduling) | §3 two-tier design, §10 cron topology |
| 5 | Deployment reachable from live link | §10 |

---

## 1. What is actually known vs. unknown about the store

### Known / reported (from the assignment brief + your own manual exploration)

- The catalogue is served by a JSON API that is effectively open — product list and metadata come back
  without auth.
- **Price is deliberately gated behind a 3-step UI flow:** click *Details* → hover the price area →
  click *Reveal Price*.
- The store deliberately injects: frequent price changes, asynchronous/late-loading content, slow
  responses, and intermittent errors.
- It is a client-rendered SPA (the served HTML is an empty root div plus a JS bundle), so *nothing*
  useful comes from a plain `GET /` + HTML parse of the shell. Any HTML-parsing strategy must target
  whatever the API returns, not the shell.

### Unknown — resolved by Phase 1

- **U1.** Does the reveal endpoint require a nonce/token issued by an earlier request?
- **U2.** If yes, is the nonce **single-use**?
- **U3.** What is its **TTL**?
- **U4.** Is it bound to a **session cookie**?
- **U5.** Is the flow **step-gated** (server refuses reveal unless it saw `details` and/or `hover` first)?
- **U6.** Are `Referer` / `Origin` / `User-Agent` / a custom header checked?
- **U7.** Is the price actually present-but-obfuscated in an earlier payload (client-side decode only)?
- **U8.** Latency distribution and error rate of the reveal call (sets timeouts + retry budget).
- **U9.** Rate limit behaviour (429 + `Retry-After`?).

### The five possible reveal mechanisms, and what each implies

| # | Mechanism | Detection signal | Implementation |
|---|---|---|---|
| A | **Open endpoint** — `GET /api/products/:id/price` works cold from curl | Fresh-session direct call returns 200 + price | Trivial. Single HTTP call. |
| B | **Nonce / reveal token** — details response carries `revealToken`, reveal consumes it | Replaying reveal twice fails; token string in details payload | Always re-fetch details → reveal, **per scrape**. Never cache the token. |
| C | **Session-bound** — cookie from an earlier request required | Stripping `Cookie` → 401/403 | Use a per-run `CookieJar`; establish session at run start; re-establish on 401. |
| D | **Step-gated state machine** — server tracks details→hover→reveal per session | Direct reveal on fresh session → 409/412/403 | Replay the exact request chain in order, including the hover beacon. |
| E | **Client-side obfuscation** — price is in the payload, encoded (base64/xor/offset) | Reveal call absent from network log, or price field present but unreadable | Decode in Node. Zero extra requests. Best case. |

> **Design consequence that holds for A–E:** the scraper *always* performs the full chain from a cold
> state on every run. That single decision makes U2/U3/U4 irrelevant to production correctness — an
> expired or single-use token can never be the cause of a failed run, because we never reuse one. The
> cost is 1–3 extra HTTP requests per product per 2 hours. That is nothing. **Do not build a token
> cache. This is the single most common way this assignment breaks in production.**

---

## 2. Build order and time plan (you have ~2 days)

| Checkpoint | Deliverable | Est. |
|---|---|---|
| **C0** | Repo scaffold, Supabase project + schema applied, `.env` files | 45 min |
| **C1** | **Phase 1 recon complete**, `docs/recon-report.json` committed, `storeProfile.js` filled | 1.5 h |
| **C2** | HTTP scraper tier working locally for one product end-to-end (price + stock validated) | 2 h |
| **C3** | Orchestrator + DB writes + scrape logs + run lock; `npm run scrape:once` green | 2 h |
| **C4** | Express API + `/api/cron/scrape`; deployed to Render; cron-job.org firing | 2 h |
| **C5** | React frontend (search, track, chart, log table) deployed to Vercel | 3 h |
| **C6** | Playwright headed tier + chaos injection; record the 2–4 min video | 1.5 h |
| **C7** | README + DESIGN_NOTE + CI workflow + bonus features | 2 h |

**Minimum viable submission is C4 + a table-only frontend.** If time collapses, cut bonuses, cut the
chart (ship a table — the brief says "chart *or* table"), never cut the scrape log or the honest-failure
behaviour.

---

## 3. Architecture

```
                    ┌──────────────────────┐
  cron-job.org ────►│  POST /api/cron/scrape│  (x-cron-secret)  ── returns 202 immediately
  (warmup + trigger)└──────────┬───────────┘
                               │ background, lock-guarded
                               ▼
                    ┌──────────────────────┐
                    │   ScrapeRunner       │  p-limit(2), jitter, wall-clock budget
                    └──────────┬───────────┘
                               │ per product
                               ▼
                 ┌─────────────────────────────┐
                 │  Tier A: HTTP strategy      │  undici/axios + CookieJar
                 │  chain: search/details →    │  extractor ladder → validate
                 │  (hover) → reveal           │
                 └──────┬──────────────┬───────┘
                        │ ok           │ fail / low-confidence
                        │              ▼
                        │   ┌─────────────────────────────┐
                        │   │ Tier B: Playwright strategy │  (local + GH Actions; off on Render)
                        │   │ real UI: Details→hover→Reveal│
                        │   └──────────────┬──────────────┘
                        ▼                  ▼
                 ┌────────────────────────────────┐
                 │ Validation gate + agreement    │
                 └───────┬───────────────┬────────┘
                    success             failure
                        │                │
              price_history          (nothing)
              scrape_logs(success|retried)   scrape_logs(failed, reason)
```

**Two-tier justification (put this in the design note):** the store is an SPA but its *data* is JSON, so
JavaScript rendering is not genuinely required — the brief explicitly says "Reach for a headless browser
only where the page genuinely requires it." Tier A is ~300 ms and ~40 MB; Tier B is ~4 s and ~400 MB and
does not fit Render free. Tier B is retained as (i) the mandated observable headed run and (ii) an
escape hatch if the store adds a real JS-only gate, hosted on GitHub Actions where a browser is free.

### Tech choices

- Backend: **Node 20 + Express**. (Django is equally allowed; this spec is Node.)
- HTTP: **undici** (`request` / `Agent` with per-request timeouts) + **tough-cookie** for the jar.
  `axios` + `axios-cookiejar-support` is an acceptable substitute.
- HTML parsing (only if recon shows HTML fragments): **cheerio**.
- Browser: **Playwright** (better auto-waiting + `page.route` interception than Puppeteer — we need
  route interception for chaos injection in the recording).
- DB access: **@supabase/supabase-js** with the **service role key, backend only**.
- Frontend: **React 18 + Vite + TypeScript + Tailwind + Recharts**.
- Concurrency limiter: **p-limit**.
- Validation: **zod**.

---

## 4. PHASE 1 — Recon (do this first)

### 4.1 Manual pass (10 minutes, do it yourself, it's fast)

1. Open `https://demo.inelabteamdev.com/` in Chrome. DevTools → **Network** → filter **Fetch/XHR** →
   check **Preserve log** and **Disable cache**.
2. Reload. Note every request the app makes on boot. Look for: `/api/products`, `/api/search`,
   `/config`, `/health`, an OpenAPI doc.
3. Search a product by partial name. Note the search request — is it server-side (`?q=`) or is the whole
   catalogue fetched once and filtered client-side? **This determines §8.2.**
4. Click **Details**. Note the request. **Open its Response tab and read every field name.** Look for
   anything like `revealToken`, `nonce`, `priceToken`, `sig`, `exp`, `challenge`, `_t`, or a
   price-shaped-but-unreadable field (`cHJpY2U6...`, `"p":"MTI5OTk="`).
5. **Hover** the price. Does a request fire? (Many mocks fire a `POST /api/.../hover` beacon; some do
   nothing and the hover is pure CSS.) Record it either way — "hover fires nothing" is a valuable finding.
6. Click **Reveal Price**. Right-click the reveal request → **Copy → Copy as cURL (bash)**. Paste it into
   `docs/reveal.curl.txt`. This is your ground truth.
7. Also: right-click anywhere in Network → **Save all as HAR with content** → `docs/store-flow.har`.
   Commit it. It is evidence for the design note and a fixture source for tests.
8. Open the JS bundle (Sources → the `assets/index-*.js`) and Ctrl-F for `reveal`, `nonce`, `token`,
   `atob`, `price`. If you find `atob(` near price handling, you are in **mechanism E** and the price
   never needed a network round-trip at all.

### 4.2 Automated experiment matrix

Create `backend/src/scripts/recon.mjs`. It takes the cURL you captured, re-issues it under mutations,
and writes a machine-readable report. This answers U1–U9 in one run.

```js
// backend/src/scripts/recon.mjs
// Usage: node src/scripts/recon.mjs --product <storeProductId>
// Writes docs/recon-report.json
import { request } from 'undici';
import { CookieJar } from 'tough-cookie';
import fs from 'node:fs/promises';

const BASE = 'https://demo.inelabteamdev.com';
const out = { base: BASE, ranAt: new Date().toISOString(), findings: {}, samples: [] };

const jar = new CookieJar();

async function call(path, { method = 'GET', headers = {}, body, useJar = true, label } = {}) {
  const url = path.startsWith('http') ? path : BASE + path;
  const cookie = useJar ? await jar.getCookieString(url) : '';
  const t0 = Date.now();
  let res, text, err = null;
  try {
    res = await request(url, {
      method,
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        referer: BASE + '/',
        origin: BASE,
        ...(cookie ? { cookie } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      headersTimeout: 15000,
      bodyTimeout: 15000,
    });
    text = await res.body.text();
    const sc = res.headers['set-cookie'];
    if (useJar && sc) for (const c of [].concat(sc)) await jar.setCookie(c, url);
  } catch (e) { err = String(e); }
  const rec = {
    label, method, url,
    status: res?.statusCode ?? null,
    ms: Date.now() - t0,
    retryAfter: res?.headers['retry-after'] ?? null,
    setCookie: !!res?.headers['set-cookie'],
    err,
    bodyPreview: (text || '').slice(0, 1200),
  };
  out.samples.push(rec);
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ...rec, json, text };
}

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) =>
  v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a, []));
const PID = args.product;

// ---- EDIT THESE THREE PATHS FROM YOUR CAPTURED cURL -------------------------
const P = {
  list:    '/api/products',
  details: (id) => `/api/products/${id}`,
  hover:   (id) => `/api/products/${id}/hover`,      // set to null if hover fires nothing
  reveal:  (id) => `/api/products/${id}/reveal`,
  revealMethod: 'POST',
  // where the token lives in the details response, e.g. 'revealToken' or 'data.nonce'
  tokenPath: 'revealToken',
  // how the reveal call carries it: 'body' | 'query' | 'header'
  tokenTransport: 'body',
  tokenHeaderName: 'x-reveal-token',
};
// -----------------------------------------------------------------------------

const pick = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

function buildReveal(id, token) {
  const base = P.reveal(id);
  if (!token) return { path: base, body: undefined, headers: {} };
  if (P.tokenTransport === 'query')  return { path: `${base}?token=${encodeURIComponent(token)}`, body: undefined, headers: {} };
  if (P.tokenTransport === 'header') return { path: base, body: {}, headers: { [P.tokenHeaderName]: token } };
  return { path: base, body: { token }, headers: {} };
}

async function fullChain(id, { doHover = true } = {}) {
  const d = await call(P.details(id), { label: 'details' });
  const token = P.tokenPath ? pick(d.json, P.tokenPath) : null;
  if (doHover && P.hover) await call(P.hover(id), { method: 'POST', body: {}, label: 'hover' });
  const r = buildReveal(id, token);
  const rev = await call(r.path, { method: P.revealMethod, body: r.body, headers: r.headers, label: 'reveal' });
  return { details: d, token, reveal: rev };
}

// ---------- U1/U7: is there a token at all / is price already present? -------
const first = await fullChain(PID);
out.findings.tokenPresent = !!first.token;
out.findings.tokenSample = first.token ?? null;
out.findings.detailsContainsPriceLikeField = /(?:price|amount|cost|mrp)/i.test(first.details.text || '');
out.findings.revealStatus = first.reveal.status;

// ---------- U2: single-use? replay the SAME token twice ----------------------
if (first.token) {
  const r = buildReveal(PID, first.token);
  const again = await call(r.path, { method: P.revealMethod, body: r.body, headers: r.headers, label: 'replay-immediate' });
  out.findings.tokenReplayable = again.status === first.reveal.status && again.status < 400;
}

// ---------- U3: TTL bracket --------------------------------------------------
if (first.token) {
  const ttl = [];
  const fresh = await fullChain(PID);
  for (const wait of [30, 60, 120, 300]) {
    await new Promise(r => setTimeout(r, wait * 1000 - (ttl.at(-1)?.waitedTotal ?? 0) * 1000));
    const r = buildReveal(PID, fresh.token);
    const res = await call(r.path, { method: P.revealMethod, body: r.body, headers: r.headers, label: `ttl-${wait}s` });
    ttl.push({ waitedTotal: wait, status: res.status, ok: res.status < 400 });
    if (res.status >= 400) break;
  }
  out.findings.ttlProbe = ttl;
  const firstFail = ttl.find(t => !t.ok);
  out.findings.ttlSecondsUpperBound = firstFail ? firstFail.waitedTotal : '>300 (or unlimited)';
}

// ---------- U4: session-bound? ----------------------------------------------
{
  const d = await call(P.details(PID), { label: 'details-for-nocookie' });
  const token = P.tokenPath ? pick(d.json, P.tokenPath) : null;
  const r = buildReveal(PID, token);
  const res = await call(r.path, { method: P.revealMethod, body: r.body, headers: r.headers, useJar: false, label: 'reveal-no-cookie' });
  out.findings.requiresCookie = res.status >= 400;
}

// ---------- U5: step-gated? cold reveal, no details, no hover ---------------
{
  const cold = new CookieJar(); void cold;
  const r = buildReveal(PID, null);
  const res = await call(r.path, { method: P.revealMethod, body: r.body, headers: r.headers, useJar: false, label: 'reveal-cold' });
  out.findings.coldRevealStatus = res.status;
  out.findings.stepGated = res.status >= 400;
}

// ---------- U5b: does skipping hover break it? ------------------------------
if (P.hover) {
  const res = await fullChain(PID, { doHover: false });
  out.findings.hoverRequired = res.reveal.status >= 400;
}

// ---------- U6: header checks ------------------------------------------------
for (const strip of ['referer', 'origin', 'user-agent']) {
  const d = await call(P.details(PID), { label: `details-strip-${strip}` });
  const token = P.tokenPath ? pick(d.json, P.tokenPath) : null;
  const r = buildReveal(PID, token);
  const res = await call(r.path, {
    method: P.revealMethod, body: r.body,
    headers: { ...r.headers, [strip]: undefined, [strip]: '' },
    label: `reveal-strip-${strip}`,
  });
  out.findings[`requires_${strip}`] = res.status >= 400;
}

// ---------- U8: latency + error-rate distribution (20 chains) ---------------
{
  const lat = [], statuses = {};
  for (let i = 0; i < 20; i++) {
    const t0 = Date.now();
    const res = await fullChain(PID);
    lat.push(Date.now() - t0);
    statuses[res.reveal.status] = (statuses[res.reveal.status] || 0) + 1;
    await new Promise(r => setTimeout(r, 400));
  }
  lat.sort((a, b) => a - b);
  const q = (p) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))];
  out.findings.latencyMs = { p50: q(0.5), p90: q(0.9), p95: q(0.95), p99: q(0.99), max: lat.at(-1) };
  out.findings.statusDistribution = statuses;
  out.findings.errorRate = 1 - (statuses[200] || 0) / 20;
}

// ---------- U9: rate limiting ------------------------------------------------
{
  const burst = await Promise.all(Array.from({ length: 12 }, (_, i) =>
    call(P.details(PID), { label: `burst-${i}` })));
  out.findings.rateLimited = burst.some(b => b.status === 429);
  out.findings.retryAfterSeen = burst.map(b => b.retryAfter).find(Boolean) ?? null;
}

await fs.mkdir('docs', { recursive: true });
await fs.writeFile('docs/recon-report.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.findings, null, 2));
```

### 4.3 Playwright HAR capture (records the real UI chain, headed)

```js
// backend/src/scripts/captureFlow.mjs
// Usage: node src/scripts/captureFlow.mjs --q "laptop"
import { chromium } from 'playwright';

const BASE = 'https://demo.inelabteamdev.com';
const browser = await chromium.launch({ headless: false, slowMo: 400 });
const ctx = await browser.newContext({ recordHar: { path: 'docs/store-flow.har', content: 'embed' } });
const page = await ctx.newPage();

const chain = [];
page.on('request', r => chain.push({ t: Date.now(), m: r.method(), u: r.url(), rt: r.resourceType() }));
page.on('response', async r => {
  if (!/\/api\//.test(r.url())) return;
  let body = ''; try { body = (await r.text()).slice(0, 800); } catch {}
  console.log('◀', r.status(), r.url(), '\n   ', body, '\n');
});

await page.goto(BASE, { waitUntil: 'networkidle' });
// TODO: replace the three selectors below with the real ones (inspect once, hardcode).
await page.fill('input[type="search"], input[placeholder*="earch"]', process.argv.at(-1));
await page.keyboard.press('Enter');
await page.click('text=Details');
await page.hover('[data-testid="price"], .price, :text("Reveal")');
await page.click('text=Reveal Price');
await page.waitForTimeout(4000);

console.log(JSON.stringify(chain.filter(c => c.rt === 'xhr' || c.rt === 'fetch'), null, 2));
await ctx.close(); await browser.close();
```

### 4.4 Decision table — read your report, pick the path

| Finding | Action |
|---|---|
| `coldRevealStatus === 200` | **Mechanism A.** One HTTP call per product. Skip details/hover in prod. |
| `tokenPresent === true` | **Mechanism B.** Chain details→reveal every scrape. Never cache. |
| `requiresCookie === true` | **Mechanism C.** Per-run `CookieJar`, fresh per run; on 401 rebuild jar and retry once. |
| `hoverRequired === true` or `stepGated === true` | **Mechanism D.** Replay all three calls in order, in the same jar, with a small delay between. |
| Reveal call never appears in HAR / `atob(` found in bundle | **Mechanism E.** Decode locally, zero extra calls. |
| `requires_referer/origin === true` | Pin those headers in `httpClient` defaults. |
| `errorRate > 0` | Expected — the store injects errors. Feeds §5.2 retry budget. |
| `latencyMs.p99` | Set `REQUEST_TIMEOUT_MS = ceil(p99 * 2)`, floor 12 000, cap 25 000. |
| `rateLimited === true` | Set `CONCURRENCY = 1`, honour `Retry-After`, add 500–1500 ms inter-request jitter. |

Commit `docs/recon-report.json`, `docs/store-flow.har`, `docs/reveal.curl.txt`. These make the design
note write itself and prove to the interviewer you did real reverse-engineering, not vibes.

---

## 5. Data model (Supabase / Postgres)

Apply with the Supabase SQL editor. Keep this file at `backend/src/db/schema.sql` and commit it.

```sql
-- ============ enums ============
do $$ begin
  create type scrape_outcome as enum ('success', 'retried', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type scrape_strategy as enum ('http', 'browser', 'none');
exception when duplicate_object then null; end $$;

-- ============ tracked products ============
create table if not exists tracked_products (
  id                  uuid primary key default gen_random_uuid(),
  store_product_id    text not null unique,      -- id as used by the store API
  name                text not null,
  slug                text,
  url                 text,
  image_url           text,
  category            text,
  brand               text,
  rating              numeric(3,2),
  description         text,
  is_active           boolean not null default true,
  scrape_interval_min integer not null default 120,   -- bonus: per-product frequency
  next_due_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  -- denormalised for fast dashboard reads
  last_scrape_at      timestamptz,
  last_outcome        scrape_outcome,
  last_price          numeric(12,2),
  last_currency       text,
  last_in_stock       boolean,
  consecutive_failures integer not null default 0
);

-- ============ price history (successes ONLY) ============
create table if not exists price_history (
  id                uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  run_id            uuid,
  price             numeric(12,2) not null check (price > 0),
  currency          text not null default 'INR',
  in_stock          boolean not null,
  stock_status      text not null,          -- raw normalised label, e.g. 'In Stock', 'Low Stock'
  stock_qty         integer,                -- null when store does not expose a number
  strategy          scrape_strategy not null,
  extractor         text not null,          -- which rung of the ladder produced the value
  confidence        text not null default 'high',  -- high | verified | low
  scraped_at        timestamptz not null default now()
);
create index if not exists ph_product_time on price_history (tracked_product_id, scraped_at desc);

-- ============ scrape log (EVERY attempt, honestly) ============
create table if not exists scrape_logs (
  id                uuid primary key default gen_random_uuid(),
  tracked_product_id uuid references tracked_products(id) on delete cascade,
  run_id            uuid,
  outcome           scrape_outcome not null,
  attempts          integer not null default 1,
  strategy          scrape_strategy not null default 'http',
  http_status       integer,
  error_code        text,       -- TIMEOUT | HTTP_5XX | RATE_LIMITED | PARSE_FAILED | VALIDATION_FAILED | STRUCTURE_DRIFT | CIRCUIT_OPEN | BUDGET_EXCEEDED | SESSION_EXPIRED
  error_message     text,
  price_found       numeric(12,2),  -- nullable: what we got, for auditability
  duration_ms       integer not null,
  attempt_trace     jsonb,      -- [{n, ms, status, error, backoffMs}] – the honest per-attempt record
  started_at        timestamptz not null default now(),
  finished_at       timestamptz
);
create index if not exists sl_product_time on scrape_logs (tracked_product_id, started_at desc);
create index if not exists sl_run on scrape_logs (run_id);

-- ============ run-level summary + distributed lock ============
create table if not exists scrape_runs (
  id            uuid primary key default gen_random_uuid(),
  trigger       text not null,             -- cron | manual | ci
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  total         integer not null default 0,
  success       integer not null default 0,
  retried       integer not null default 0,
  failed        integer not null default 0,
  notes         text
);

create table if not exists run_locks (
  key         text primary key,
  run_id      uuid,
  acquired_at timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- ============ bonus: structure-change detection ============
create table if not exists structure_signatures (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null,        -- 'details' | 'reveal' | 'search'
  signature   text not null,        -- sorted key fingerprint of the response shape
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  sample      jsonb
);
create unique index if not exists ss_scope_sig on structure_signatures (scope, signature);

-- ============ bonus: alerts ============
create table if not exists alerts (
  id                uuid primary key default gen_random_uuid(),
  tracked_product_id uuid references tracked_products(id) on delete cascade,
  kind              text not null,   -- price_drop | back_in_stock | structure_drift | stale
  message           text not null,
  old_value         numeric(12,2),
  new_value         numeric(12,2),
  is_read           boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ============ RLS: backend-only writes ============
alter table tracked_products     enable row level security;
alter table price_history        enable row level security;
alter table scrape_logs          enable row level security;
alter table scrape_runs          enable row level security;
alter table alerts               enable row level security;
-- No policies for anon/authenticated => only the service_role key (backend) can touch these.
```

**Why `price_history` has `price numeric NOT NULL CHECK (price > 0)`:** the database itself enforces the
"never store empty or wrong data" rule. Even if application logic regresses, a bad write throws instead
of silently corrupting the history. Say this in the design note — schema-level invariants read well.

---

## 6. `storeProfile.js` — the only file that knows about the store

```js
// backend/src/scraper/storeProfile.js
// EVERY store-specific fact lives here. Filled from docs/recon-report.json.
export const STORE_PROFILE = {
  baseUrl: 'https://demo.inelabteamdev.com',

  // --- mechanism, from §4.4 decision table: 'open' | 'nonce' | 'session' | 'stepped' | 'encoded'
  revealMechanism: 'nonce',            // [DECIDE AFTER RECON]

  paths: {
    list:    '/api/products',
    search:  (q) => `/api/products?search=${encodeURIComponent(q)}`, // or null => client-side filter
    details: (id) => `/api/products/${id}`,
    hover:   (id) => `/api/products/${id}/hover`,   // null if hover fires no request
    reveal:  (id) => `/api/products/${id}/reveal`,
  },
  revealMethod: 'POST',

  token: {
    path: 'revealToken',        // dot-path inside the details response
    transport: 'body',          // 'body' | 'query' | 'header'
    headerName: 'x-reveal-token',
    bodyKey: 'token',
  },

  requiredHeaders: {            // pin whatever recon proved is checked
    referer: 'https://demo.inelabteamdev.com/',
    origin:  'https://demo.inelabteamdev.com',
    'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    accept: 'application/json, text/plain, */*',
  },

  // where values live in the reveal/details payloads, tried in order (the "ladder", §7.4)
  fieldPaths: {
    price:       ['price', 'data.price', 'result.price', 'amount', 'currentPrice'],
    priceString: ['priceFormatted', 'displayPrice', 'price_text'],
    currency:    ['currency', 'currencyCode', 'data.currency'],
    stockStatus: ['stockStatus', 'availability', 'stock.status', 'inventory.label'],
    stockQty:    ['stockQty', 'quantity', 'stock.quantity', 'inventory.count'],
    name:        ['name', 'title', 'productName'],
  },

  encoded: {                    // only used when revealMechanism === 'encoded'
    field: 'p',
    decode: (v) => Number(Buffer.from(String(v), 'base64').toString('utf8')),
  },

  money: {
    defaultCurrency: 'INR',
    decimalSeparator: '.',      // '.' or ','  — set from a real sample, do not guess
    // Indian grouping (1,23,456.78) and western (123,456.78) both handled by the parser.
  },

  stockMap: {
    true:  ['in stock', 'available', 'in_stock', 'instock', 'limited stock', 'low stock', 'few left'],
    false: ['out of stock', 'sold out', 'unavailable', 'out_of_stock', 'backorder', 'pre-order', 'discontinued'],
  },

  // UI selectors — only used by the browser tier
  ui: {
    searchInput: 'input[placeholder*="earch"], input[type="search"]',
    resultCard:  '[data-testid="product-card"], .product-card',
    detailsBtn:  'text=Details',
    priceArea:   '[data-testid="price"], .price',
    revealBtn:   'text=Reveal Price',
    // a value predicate, NOT a selector — see §7.6 for why this matters
    revealedPriceIsReady: (txt) => /\d/.test(txt) && !/[•*]{2,}|hidden|reveal|loading|—/i.test(txt),
  },

  limits: {
    requestTimeoutMs: 15000,   // = ceil(p99 * 2) from recon
    maxAttempts: 4,
    baseBackoffMs: 700,
    maxBackoffMs: 8000,
    concurrency: 2,            // 1 if recon showed rate limiting
    interRequestJitterMs: [120, 600],
    runBudgetMs: 8 * 60 * 1000,
    circuitBreakerThreshold: 5,
  },
};
```

---

## 7. Scraper core

### 7.1 Error taxonomy (`backend/src/lib/errors.js`)

Retry classification is where most naive scrapers waste their budget.

```js
export class ScrapeError extends Error {
  constructor(code, message, { status = null, retryable = false, cause = null } = {}) {
    super(message); this.code = code; this.status = status; this.retryable = retryable; this.cause = cause;
  }
}

export const classify = (status, err) => {
  if (err && /timeout|ETIMEDOUT|UND_ERR_(HEADERS|BODY)_TIMEOUT/i.test(String(err)))
    return new ScrapeError('TIMEOUT', 'request timed out', { retryable: true, cause: err });
  if (err && /ECONNRESET|ECONNREFUSED|EAI_AGAIN|ENOTFOUND|socket hang up/i.test(String(err)))
    return new ScrapeError('NETWORK', String(err), { retryable: true, cause: err });
  if (status === 429) return new ScrapeError('RATE_LIMITED', 'rate limited', { status, retryable: true });
  if (status === 408 || status === 425) return new ScrapeError('TIMEOUT', 'server timeout', { status, retryable: true });
  if (status >= 500)  return new ScrapeError('HTTP_5XX', `upstream ${status}`, { status, retryable: true });
  if (status === 401 || status === 403)
    return new ScrapeError('SESSION_EXPIRED', 'auth/session rejected', { status, retryable: true }); // retry ONCE with a fresh session
  if (status === 409 || status === 410 || status === 412)
    return new ScrapeError('TOKEN_INVALID', 'nonce consumed/expired', { status, retryable: true });   // retry with a fresh chain
  if (status === 404) return new ScrapeError('NOT_FOUND', 'product gone', { status, retryable: false });
  if (status >= 400)  return new ScrapeError('HTTP_4XX', `client error ${status}`, { status, retryable: false });
  return null;
};
```

**Rules:** never retry 400/404/422. Retry 401/403/409/410 exactly once and only after rebuilding the
session/token chain from scratch — retrying the same dead token is pointless and looks bad in the log.

### 7.2 HTTP client with retry, jitter, backoff, circuit breaker

```js
// backend/src/scraper/httpClient.js
import { request } from 'undici';
import { CookieJar } from 'tough-cookie';
import { STORE_PROFILE as SP } from './storeProfile.js';
import { classify, ScrapeError } from '../lib/errors.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rand = ([a, b]) => a + Math.random() * (b - a);

export class StoreClient {
  constructor({ jar = new CookieJar(), trace = [] } = {}) {
    this.jar = jar;                 // fresh per RUN (not per process) unless a 401 forces a rebuild
    this.trace = trace;             // honest per-attempt record, persisted into scrape_logs.attempt_trace
    this.consecutiveFailures = 0;
  }

  reset() { this.jar = new CookieJar(); }

  get circuitOpen() { return this.consecutiveFailures >= SP.limits.circuitBreakerThreshold; }

  async fetchJson(path, { method = 'GET', body, headers = {}, label = path } = {}) {
    if (this.circuitOpen) throw new ScrapeError('CIRCUIT_OPEN', 'circuit breaker open', { retryable: false });

    const url = path.startsWith('http') ? path : SP.baseUrl + path;
    let lastErr = null;

    for (let n = 1; n <= SP.limits.maxAttempts; n++) {
      const t0 = Date.now();
      let status = null;
      try {
        await sleep(rand(SP.limits.interRequestJitterMs));
        const cookie = await this.jar.getCookieString(url);
        const res = await request(url, {
          method,
          headers: {
            ...SP.requiredHeaders,
            ...(cookie ? { cookie } : {}),
            ...(body ? { 'content-type': 'application/json' } : {}),
            ...headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          headersTimeout: SP.limits.requestTimeoutMs,
          bodyTimeout: SP.limits.requestTimeoutMs,
        });
        status = res.statusCode;

        const sc = res.headers['set-cookie'];
        if (sc) for (const c of [].concat(sc)) await this.jar.setCookie(c, url).catch(() => {});

        const text = await res.body.text();
        const failure = classify(status, null);
        if (failure) {
          failure.retryAfterMs = res.headers['retry-after']
            ? Number(res.headers['retry-after']) * 1000 : null;
          throw failure;
        }

        let json = null;
        try { json = JSON.parse(text); } catch { /* may legitimately be HTML — caller decides */ }

        this.trace.push({ label, n, ms: Date.now() - t0, status, ok: true });
        this.consecutiveFailures = 0;
        return { status, json, text, attempts: n };

      } catch (raw) {
        const err = raw instanceof ScrapeError ? raw : classify(status, raw)
          ?? new ScrapeError('UNKNOWN', String(raw), { retryable: false });
        lastErr = err;

        const isLast = n === SP.limits.maxAttempts;
        const backoff = err.retryAfterMs ?? Math.min(
          SP.limits.maxBackoffMs,
          SP.limits.baseBackoffMs * 2 ** (n - 1) * (0.5 + Math.random())   // full jitter
        );

        this.trace.push({
          label, n, ms: Date.now() - t0, status: err.status ?? null,
          error: err.code, backoffMs: isLast || !err.retryable ? 0 : Math.round(backoff),
        });

        if (!err.retryable || isLast) { this.consecutiveFailures++; throw err; }
        await sleep(backoff);
      }
    }
    throw lastErr;
  }
}
```

Points worth calling out in the interview:
- **Full jitter** (`base * 2^n * random(0.5..1.5)`) not fixed backoff — prevents synchronised retry storms
  when several products fail at once.
- **`Retry-After` wins over computed backoff.** Politeness and correctness.
- **Circuit breaker** stops a dead store from consuming the entire 8-minute run budget; remaining
  products fail fast with `CIRCUIT_OPEN` and are logged honestly rather than timing out one by one.
- **The `trace` array is persisted.** The scrape log shows literally "attempt 1 → 503 → waited 812 ms →
  attempt 2 → timeout → waited 1.9 s → attempt 3 → 200". That is what "honest logging" means.

### 7.3 Money parser (`backend/src/lib/money.js`)

```js
import { STORE_PROFILE as SP } from '../scraper/storeProfile.js';

const SYMBOL_TO_CODE = { '₹': 'INR', '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' };

/** Strict-by-profile parse. Returns { amount, currency, confidence } or throws. */
export function parseMoney(input, fallbackCurrency = SP.money.defaultCurrency) {
  if (typeof input === 'number' && Number.isFinite(input))
    return { amount: round2(input), currency: fallbackCurrency, confidence: 'high' };

  const raw = String(input ?? '').trim();
  if (!raw) throw new Error('empty price input');

  const symbol = Object.keys(SYMBOL_TO_CODE).find(s => raw.includes(s));
  const code = raw.match(/\b(INR|USD|EUR|GBP|JPY)\b/i)?.[1]?.toUpperCase();
  const currency = code ?? (symbol ? SYMBOL_TO_CODE[symbol] : fallbackCurrency);

  // keep digits and separators only; handles ₹1,23,456.78 and 1.234,56 and 12 345,67
  const cleaned = raw.replace(/[^\d.,\s']/g, '').replace(/[\s']/g, '');
  if (!/\d/.test(cleaned)) throw new Error(`no digits in price: ${raw}`);

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const lastSep = Math.max(lastDot, lastComma);
  let normalised;

  if (lastSep === -1) {
    normalised = cleaned;
  } else {
    const decimalsAfter = cleaned.length - lastSep - 1;
    const sepChar = cleaned[lastSep];
    // 1–2 trailing digits => decimal separator; 3 => grouping (e.g. 1,234)
    const isDecimal = decimalsAfter > 0 && decimalsAfter <= 2;
    normalised = isDecimal
      ? cleaned.slice(0, lastSep).replace(/[.,]/g, '') + '.' + cleaned.slice(lastSep + 1)
      : cleaned.replace(/[.,]/g, '');
    if (isDecimal && sepChar !== SP.money.decimalSeparator) {
      // format disagrees with the profile => flag, do not silently accept
      return { amount: round2(Number(normalised)), currency, confidence: 'low' };
    }
  }

  const amount = Number(normalised);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`unparseable price: ${raw}`);
  return { amount: round2(amount), currency, confidence: 'high' };
}

const round2 = (n) => Math.round(n * 100) / 100;

export function normaliseStock(statusRaw, qty) {
  const s = String(statusRaw ?? '').trim().toLowerCase();
  if (SP.stockMap.false.some(k => s.includes(k))) return { in_stock: false, stock_status: title(s), stock_qty: qty ?? 0 };
  if (SP.stockMap.true.some(k => s.includes(k)))  return { in_stock: true,  stock_status: title(s), stock_qty: qty ?? null };
  if (Number.isInteger(qty)) return { in_stock: qty > 0, stock_status: qty > 0 ? 'In Stock' : 'Out of Stock', stock_qty: qty };
  throw new Error(`unrecognised stock label: ${statusRaw}`);   // fail loudly, never assume "in stock"
}
const title = (s) => s.replace(/\b\w/g, c => c.toUpperCase());
```

`normaliseStock` **throws on an unknown label**. Defaulting an unknown label to `in_stock: true` is
exactly the "silently store incorrect data" failure the brief punishes.

### 7.4 Extractor ladder + structure-drift detection

```js
// backend/src/scraper/extractors.js
import { STORE_PROFILE as SP } from './storeProfile.js';
import { parseMoney, normaliseStock } from '../lib/money.js';
import * as cheerio from 'cheerio';

const pick = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

const firstPath = (obj, paths) => {
  for (const p of paths) { const v = pick(obj, p); if (v !== undefined && v !== null && v !== '') return { v, p }; }
  return null;
};

/** Ordered rungs. First that succeeds wins; the rung index is recorded for drift detection. */
export const PRICE_RUNGS = [
  { name: 'json.numericField',  fn: (ctx) => { const h = firstPath(ctx.json, SP.fieldPaths.price); if (!h) return null; return { ...parseMoney(h.v), via: `json:${h.p}` }; } },
  { name: 'json.stringField',   fn: (ctx) => { const h = firstPath(ctx.json, SP.fieldPaths.priceString); if (!h) return null; return { ...parseMoney(h.v), via: `json:${h.p}` }; } },
  { name: 'json.encoded',       fn: (ctx) => { if (SP.revealMechanism !== 'encoded') return null; const v = pick(ctx.json, SP.encoded.field); if (v == null) return null; return { ...parseMoney(SP.encoded.decode(v)), via: 'encoded' }; } },
  { name: 'json.deepScan',      fn: (ctx) => { const hit = deepFindPrice(ctx.json); return hit ? { ...parseMoney(hit.v), via: `deep:${hit.path}`, confidence: 'low' } : null; } },
  { name: 'html.jsonld',        fn: (ctx) => { if (!ctx.text?.includes('application/ld+json')) return null; const $ = cheerio.load(ctx.text); for (const el of $('script[type="application/ld+json"]').toArray()) { try { const d = JSON.parse($(el).text()); const p = d?.offers?.price ?? d?.price; if (p) return { ...parseMoney(p), via: 'jsonld' }; } catch {} } return null; } },
  { name: 'html.microdata',     fn: (ctx) => { if (!ctx.text) return null; const $ = cheerio.load(ctx.text); const c = $('[itemprop="price"]').attr('content') ?? $('[itemprop="price"]').first().text(); return c ? { ...parseMoney(c), via: 'microdata' } : null; } },
  { name: 'html.regex',         fn: (ctx) => { if (!ctx.text) return null; const m = ctx.text.match(/(?:₹|Rs\.?|INR|\$)\s?([\d][\d.,\s]{0,14}\d)/i); return m ? { ...parseMoney(m[0]), via: 'regex', confidence: 'low' } : null; } },
];

function deepFindPrice(obj, path = '', depth = 0) {
  if (obj == null || depth > 6) return null;
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const p = path ? `${path}.${k}` : k;
      if (/^(price|amount|cost|mrp|sellingprice|currentprice)$/i.test(k) &&
          (typeof v === 'number' || (typeof v === 'string' && /\d/.test(v)))) return { v, path: p };
      const nested = deepFindPrice(v, p, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

export function extractPrice(ctx) {
  const errors = [];
  for (let i = 0; i < PRICE_RUNGS.length; i++) {
    try {
      const r = PRICE_RUNGS[i].fn(ctx);
      if (r) return { ...r, rung: i, rungName: PRICE_RUNGS[i].name, confidence: r.confidence ?? 'high' };
    } catch (e) { errors.push(`${PRICE_RUNGS[i].name}: ${e.message}`); }
  }
  throw new Error(`PARSE_FAILED price — tried ${PRICE_RUNGS.length} rungs. ${errors.join(' | ')}`);
}

export function extractStock(ctx) {
  const st = firstPath(ctx.json ?? {}, SP.fieldPaths.stockStatus);
  const qt = firstPath(ctx.json ?? {}, SP.fieldPaths.stockQty);
  if (!st && !qt) {
    if (ctx.text) {
      const m = ctx.text.match(/(in stock|out of stock|sold out|low stock|only \d+ left)/i);
      if (m) return { ...normaliseStock(m[1], null), via: 'text' };
    }
    throw new Error('PARSE_FAILED stock — no stock field found');
  }
  return { ...normaliseStock(st?.v, qt?.v != null ? Number(qt.v) : null), via: st?.p ?? qt?.p };
}

/** Fingerprint of a response's shape. Change => the store's structure moved. */
export function signature(json) {
  const keys = [];
  (function walk(o, prefix = '', d = 0) {
    if (o == null || d > 4 || typeof o !== 'object') return;
    for (const k of Object.keys(o).sort()) { keys.push(prefix + k); walk(o[k], prefix + k + '.', d + 1); }
  })(json);
  return keys.join('|');
}
```

**Why the ladder matters (bonus criterion "change detection"):** you persist which rung succeeded. If
the site's payload moves and rung 0 stops working while rung 3 still returns a value, the scrape
*succeeds* (no false failure) **and** you raise a `structure_drift` alert. A scraper that only has one
selector either breaks or lies. This is the single most impressive 30 lines in the project.

### 7.5 Validation gate + two-source agreement

```js
// backend/src/scraper/validate.js
import { z } from 'zod';

export const Observation = z.object({
  price: z.number().positive().max(10_000_000),
  currency: z.string().min(3).max(3),
  in_stock: z.boolean(),
  stock_status: z.string().min(1),
  stock_qty: z.number().int().nonnegative().nullable(),
  name: z.string().min(1).optional(),
});

/**
 * The store *deliberately* changes prices often, so a large delta is NOT proof of error.
 * Policy: large delta or low confidence => re-verify with an independent fetch and require
 * agreement. Disagreement => FAIL (never guess).
 */
export function needsVerification(obs, lastPrice, confidence) {
  if (confidence !== 'high') return true;
  if (lastPrice == null) return false;
  const delta = Math.abs(obs.price - lastPrice) / lastPrice;
  return delta > 0.7;
}

export function agrees(a, b) {
  return a.in_stock === b.in_stock &&
         Math.abs(a.price - b.price) / Math.max(a.price, b.price) < 0.02; // 2% tolerance for live drift
}
```

### 7.6 HTTP strategy (Tier A)

```js
// backend/src/scraper/httpStrategy.js
import { StoreClient } from './httpClient.js';
import { STORE_PROFILE as SP } from './storeProfile.js';
import { extractPrice, extractStock, signature } from './extractors.js';
import { Observation } from './validate.js';
import { ScrapeError } from '../lib/errors.js';

const pick = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);

/** Runs the FULL cold chain every time. Token caching is deliberately absent. */
export async function scrapeViaHttp(storeProductId, { client = new StoreClient() } = {}) {
  const trace = client.trace;

  // 1. details (also the source of the reveal token, and of product metadata)
  const details = await client.fetchJson(SP.paths.details(storeProductId), { label: 'details' });

  // 2. hover beacon, only if the store actually gates on it
  if (SP.paths.hover && ['stepped'].includes(SP.revealMechanism)) {
    await client.fetchJson(SP.paths.hover(storeProductId), { method: 'POST', body: {}, label: 'hover' })
      .catch(() => { /* beacon is advisory; failure here must not fail the scrape */ });
  }

  // 3. reveal
  let ctx;
  if (SP.revealMechanism === 'encoded') {
    ctx = { json: details.json, text: details.text };
  } else {
    const token = SP.token.path ? pick(details.json, SP.token.path) : null;
    if (SP.revealMechanism === 'nonce' && !token)
      throw new ScrapeError('STRUCTURE_DRIFT', `no token at ${SP.token.path} in details payload`, { retryable: false });

    let path = SP.paths.reveal(storeProductId), body, headers = {};
    if (token) {
      if (SP.token.transport === 'query')  path += `?${SP.token.bodyKey}=${encodeURIComponent(token)}`;
      if (SP.token.transport === 'header') headers[SP.token.headerName] = token;
      if (SP.token.transport === 'body')   body = { [SP.token.bodyKey]: token };
    }
    const reveal = await client.fetchJson(path, { method: SP.revealMethod, body, headers, label: 'reveal' });
    ctx = { json: reveal.json ?? details.json, text: reveal.text };
  }

  // 4. extract + validate
  const priceHit = extractPrice(ctx);
  const stockHit = extractStock({ json: { ...(details.json ?? {}), ...(ctx.json ?? {}) }, text: ctx.text });
  const name = pick(details.json ?? {}, SP.fieldPaths.name[0]);

  const obs = Observation.parse({
    price: priceHit.amount,
    currency: priceHit.currency,
    in_stock: stockHit.in_stock,
    stock_status: stockHit.stock_status,
    stock_qty: stockHit.stock_qty ?? null,
    ...(name ? { name } : {}),
  });

  return {
    observation: obs,
    meta: {
      strategy: 'http',
      extractor: priceHit.rungName,
      via: priceHit.via,
      confidence: priceHit.confidence,
      rung: priceHit.rung,
      attempts: trace.filter(t => t.label === 'reveal').length || 1,
      signatures: { details: signature(details.json), reveal: signature(ctx.json) },
      trace,
    },
  };
}
```

### 7.7 Browser strategy (Tier B) — and the one trap everybody falls into

```js
// backend/src/scraper/browserStrategy.js
import { chromium } from 'playwright';
import { STORE_PROFILE as SP } from './storeProfile.js';
import { parseMoney, normaliseStock } from '../lib/money.js';
import { Observation } from './validate.js';

/**
 * @param opts.headed  true => visible window (for the mandated recording)
 * @param opts.chaos   'slow' | 'error' | 'flaky' | null  => deterministic fault injection
 */
export async function scrapeViaBrowser(storeProductId, opts = {}) {
  const { headed = false, chaos = null, slowMo = headed ? 350 : 0, productName } = opts;
  const browser = await chromium.launch({
    headless: !headed,
    slowMo,
    args: ['--disable-dev-shm-usage', '--no-sandbox'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  const trace = [];

  // ---- deterministic chaos so the video ALWAYS demonstrates retry ----------
  if (chaos) {
    let hit = 0;
    await page.route(/\/reveal|\/price/, async (route) => {
      hit++;
      if (chaos === 'slow' && hit === 1) { trace.push({ n: hit, injected: 'delay-9s' }); await new Promise(r => setTimeout(r, 9000)); return route.continue(); }
      if (chaos === 'error' && hit <= 2) { trace.push({ n: hit, injected: 'http-503' }); return route.fulfill({ status: 503, body: 'Service Unavailable' }); }
      if (chaos === 'flaky') {
        if (hit === 1) { trace.push({ n: hit, injected: 'delay-9s' }); await new Promise(r => setTimeout(r, 9000)); return route.continue(); }
        if (hit === 2) { trace.push({ n: hit, injected: 'http-503' }); return route.fulfill({ status: 503, body: 'Service Unavailable' }); }
      }
      trace.push({ n: hit, injected: null });
      return route.continue();
    });
  }

  try {
    await page.goto(SP.baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (productName) {
      await page.fill(SP.ui.searchInput, productName);
      await page.keyboard.press('Enter');
      await page.waitForSelector(SP.ui.resultCard, { timeout: 15000 });
    }
    await page.click(SP.ui.detailsBtn, { timeout: 15000 });
    await page.hover(SP.ui.priceArea, { timeout: 15000 }).catch(() => {});
    await page.click(SP.ui.revealBtn, { timeout: 15000 });

    // ⚠️ THE TRAP: waitForSelector(priceArea) resolves instantly because the element
    // already exists showing a placeholder ("•••" / "Loading"). You must wait on the
    // VALUE, not the node. This is what "content loads asynchronously" is testing.
    const text = await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const t = el.textContent || '';
        return /\d/.test(t) && !/[•*]{2,}|hidden|reveal|loading|—/i.test(t) ? t : false;
      },
      SP.ui.priceArea,
      { timeout: 30000, polling: 250 }
    ).then(h => h.jsonValue());

    const stockText = await page.locator('text=/in stock|out of stock|sold out|low stock/i')
      .first().textContent({ timeout: 8000 }).catch(() => null);

    const money = parseMoney(text);
    const stock = normaliseStock(stockText, null);

    const observation = Observation.parse({
      price: money.amount, currency: money.currency,
      in_stock: stock.in_stock, stock_status: stock.stock_status, stock_qty: stock.stock_qty ?? null,
    });

    return { observation, meta: { strategy: 'browser', extractor: 'ui.revealFlow', confidence: money.confidence, attempts: 1, trace } };
  } finally {
    await ctx.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
```

**Interview gold, put it in the design note:** `waitForSelector` on the price node is the default
suggestion from every AI assistant and it is wrong here — the node exists before the value arrives, so
the scraper reads `"•••"`, `parseFloat` yields `NaN`, and a naive implementation writes `0` or `null`
into the history. `waitForFunction` with a *value predicate* is the correct primitive.

### 7.8 Orchestrator (Tier A → Tier B → verify)

```js
// backend/src/scraper/index.js
import { StoreClient } from './httpClient.js';
import { scrapeViaHttp } from './httpStrategy.js';
import { scrapeViaBrowser } from './browserStrategy.js';
import { needsVerification, agrees } from './validate.js';
import { STORE_PROFILE as SP } from './storeProfile.js';

const BROWSER_FALLBACK = process.env.BROWSER_FALLBACK_ENABLED === 'true';

export async function scrapeProduct(product, { runId, client } = {}) {
  const startedAt = new Date();
  const c = client ?? new StoreClient();
  const t0 = Date.now();

  try {
    const primary = await scrapeViaHttp(product.store_product_id, { client: c });

    let result = primary;
    let confidence = primary.meta.confidence;

    if (needsVerification(primary.observation, product.last_price, confidence)) {
      const verifier = BROWSER_FALLBACK
        ? await scrapeViaBrowser(product.store_product_id, { productName: product.name })
        : await scrapeViaHttp(product.store_product_id, { client: new StoreClient() });

      if (!agrees(primary.observation, verifier.observation)) {
        return fail(product, runId, startedAt, t0, c, {
          code: 'VALIDATION_FAILED',
          message: `sources disagree: ${primary.observation.price} vs ${verifier.observation.price}`,
          priceFound: primary.observation.price,
        });
      }
      result = verifier;
      confidence = 'verified';
    }

    const attempts = c.trace.filter(t => t.error).length + 1;
    return {
      ok: true,
      outcome: attempts > 1 ? 'retried' : 'success',
      observation: result.observation,
      meta: { ...result.meta, confidence },
      attempts,
      durationMs: Date.now() - t0,
      startedAt,
      trace: c.trace,
    };

  } catch (err) {
    // Escalate to the browser ONLY for parse/structure failures — not for network failures,
    // where a browser would fail identically and burn 400 MB proving it.
    const escalatable = ['PARSE_FAILED', 'STRUCTURE_DRIFT'].includes(err.code) ||
                        /PARSE_FAILED/.test(err.message ?? '');
    if (BROWSER_FALLBACK && escalatable) {
      try {
        const b = await scrapeViaBrowser(product.store_product_id, { productName: product.name });
        return {
          ok: true, outcome: 'retried', observation: b.observation,
          meta: { ...b.meta, confidence: 'verified', escalatedFrom: err.code },
          attempts: c.trace.length + 1, durationMs: Date.now() - t0, startedAt, trace: c.trace,
        };
      } catch (be) { err.message += ` | browser fallback: ${be.message}`; }
    }
    return fail(product, runId, startedAt, t0, c, {
      code: err.code ?? 'UNKNOWN',
      message: err.message,
      status: err.status ?? null,
    });
  }
}

function fail(product, runId, startedAt, t0, c, { code, message, status = null, priceFound = null }) {
  return {
    ok: false, outcome: 'failed',
    errorCode: code, errorMessage: String(message).slice(0, 1000),
    httpStatus: status, priceFound,
    attempts: Math.max(1, c.trace.length),
    durationMs: Date.now() - t0, startedAt, trace: c.trace,
  };
}
```

---

## 8. Run orchestration, locking and persistence

### 8.1 Distributed lock (survives Render restarts, prevents overlapping runs)

```js
// backend/src/lib/lock.js
import { db } from '../db/supabase.js';

const KEY = 'scrape-run';

export async function acquireLock(runId, leaseMs = 10 * 60 * 1000) {
  const now = new Date();
  const expires = new Date(now.getTime() + leaseMs);

  // steal the lock only if the previous lease has expired (crash recovery)
  const { data, error } = await db.rpc('acquire_run_lock', {
    p_key: KEY, p_run_id: runId, p_now: now.toISOString(), p_expires: expires.toISOString(),
  });
  if (error) throw error;
  return data === true;
}

export async function releaseLock(runId) {
  await db.from('run_locks').delete().eq('key', KEY).eq('run_id', runId);
}
```

```sql
-- add to schema.sql
create or replace function acquire_run_lock(p_key text, p_run_id uuid, p_now timestamptz, p_expires timestamptz)
returns boolean language plpgsql as $$
begin
  insert into run_locks(key, run_id, acquired_at, expires_at)
  values (p_key, p_run_id, p_now, p_expires)
  on conflict (key) do update
    set run_id = excluded.run_id, acquired_at = excluded.acquired_at, expires_at = excluded.expires_at
    where run_locks.expires_at < p_now;
  return found;
end $$;
```

### 8.2 The runner

```js
// backend/src/services/scrapeRunner.js
import pLimit from 'p-limit';
import { randomUUID } from 'node:crypto';
import { db } from '../db/supabase.js';
import { StoreClient } from '../scraper/httpClient.js';
import { scrapeProduct } from '../scraper/index.js';
import { STORE_PROFILE as SP } from '../scraper/storeProfile.js';
import { acquireLock, releaseLock } from '../lib/lock.js';
import { recordSignatures } from './structureWatch.js';
import { evaluateAlerts } from './alerts.js';
import { log } from '../lib/logger.js';

export async function startRun({ trigger = 'cron', productIds = null } = {}) {
  const runId = randomUUID();
  if (!(await acquireLock(runId))) return { runId: null, skipped: true, reason: 'run already in progress' };

  await db.from('scrape_runs').insert({ id: runId, trigger });
  // fire and forget; the HTTP caller (cron-job.org) must not wait
  execute(runId, productIds).catch(e => log.error('run crashed', { runId, e: String(e) }));
  return { runId, skipped: false };
}

async function execute(runId, productIds) {
  const deadline = Date.now() + SP.limits.runBudgetMs;
  const counts = { total: 0, success: 0, retried: 0, failed: 0 };

  try {
    let q = db.from('tracked_products').select('*').eq('is_active', true);
    if (productIds?.length) q = q.in('id', productIds);
    else q = q.lte('next_due_at', new Date().toISOString());
    const { data: products = [] } = await q;
    counts.total = products.length;
    log.info('run started', { runId, products: products.length });

    const limit = pLimit(SP.limits.concurrency);
    const sharedJarClient = new StoreClient();   // one session per run; §4.4 mechanism C

    await Promise.all(products.map(p => limit(async () => {
      if (Date.now() > deadline) {
        await persist(runId, p, budgetExceeded(p), counts);
        return;
      }
      await new Promise(r => setTimeout(r, Math.random() * 1500));  // de-synchronise
      const client = new StoreClient({ jar: sharedJarClient.jar });  // share cookies, isolate trace
      const res = await scrapeProduct(p, { runId, client });
      await persist(runId, p, res, counts);
    })));

  } finally {
    await db.from('scrape_runs').update({
      finished_at: new Date().toISOString(), ...counts,
    }).eq('id', runId);
    await releaseLock(runId);
    log.info('run finished', { runId, ...counts });
  }
}

const budgetExceeded = (p) => ({
  ok: false, outcome: 'failed', errorCode: 'BUDGET_EXCEEDED',
  errorMessage: 'run wall-clock budget exhausted before this product was reached',
  attempts: 0, durationMs: 0, startedAt: new Date(), trace: [],
});

async function persist(runId, product, res, counts) {
  counts[res.outcome]++;

  // 1. the log row — ALWAYS, success or failure
  await db.from('scrape_logs').insert({
    tracked_product_id: product.id,
    run_id: runId,
    outcome: res.outcome,
    attempts: res.attempts,
    strategy: res.meta?.strategy ?? 'none',
    http_status: res.httpStatus ?? null,
    error_code: res.errorCode ?? null,
    error_message: res.errorMessage ?? null,
    price_found: res.observation?.price ?? res.priceFound ?? null,
    duration_ms: res.durationMs,
    attempt_trace: res.trace ?? [],
    started_at: res.startedAt,
    finished_at: new Date().toISOString(),
  });

  const nextDue = new Date(Date.now() + product.scrape_interval_min * 60_000).toISOString();

  // 2. the history row — ONLY on success
  if (res.ok) {
    await db.from('price_history').insert({
      tracked_product_id: product.id,
      run_id: runId,
      price: res.observation.price,
      currency: res.observation.currency,
      in_stock: res.observation.in_stock,
      stock_status: res.observation.stock_status,
      stock_qty: res.observation.stock_qty,
      strategy: res.meta.strategy,
      extractor: res.meta.extractor,
      confidence: res.meta.confidence,
    });

    await evaluateAlerts(product, res.observation);
    await recordSignatures(res.meta.signatures);

    await db.from('tracked_products').update({
      last_scrape_at: new Date().toISOString(),
      last_outcome: res.outcome,
      last_price: res.observation.price,
      last_currency: res.observation.currency,
      last_in_stock: res.observation.in_stock,
      consecutive_failures: 0,
      next_due_at: nextDue,
    }).eq('id', product.id);
  } else {
    await db.from('tracked_products').update({
      last_scrape_at: new Date().toISOString(),
      last_outcome: 'failed',
      consecutive_failures: product.consecutive_failures + 1,
      next_due_at: nextDue,     // do NOT back off past the next cycle; the brief wants a fixed cadence
    }).eq('id', product.id);
  }
}
```

### 8.3 Structure-drift watcher (bonus)

```js
// backend/src/services/structureWatch.js
import { db } from '../db/supabase.js';

export async function recordSignatures(sigs = {}) {
  for (const [scope, signature] of Object.entries(sigs)) {
    if (!signature) continue;
    const { data: known } = await db.from('structure_signatures').select('id').eq('scope', scope).limit(50);
    const { data: exact } = await db.from('structure_signatures').select('id').eq('scope', scope).eq('signature', signature).maybeSingle();

    if (exact) { await db.from('structure_signatures').update({ last_seen: new Date().toISOString() }).eq('id', exact.id); continue; }

    await db.from('structure_signatures').insert({ scope, signature });
    if (known?.length) {  // a NEW shape appeared where others already existed => drift
      await db.from('alerts').insert({
        kind: 'structure_drift',
        message: `Response shape changed for "${scope}". Extractors still succeeded, but review selectors.`,
      });
    }
  }
}
```

### 8.4 Alerts (bonus)

```js
// backend/src/services/alerts.js
import { db } from '../db/supabase.js';

const DROP_PCT = Number(process.env.ALERT_DROP_PCT ?? 5);

export async function evaluateAlerts(product, obs) {
  const prev = product.last_price;
  if (prev && obs.price < prev * (1 - DROP_PCT / 100)) {
    await db.from('alerts').insert({
      tracked_product_id: product.id, kind: 'price_drop',
      message: `${product.name} dropped ${(100 * (prev - obs.price) / prev).toFixed(1)}%`,
      old_value: prev, new_value: obs.price,
    });
    await sendEmail(`Price drop: ${product.name}`, `${prev} → ${obs.price}`);
  }
  if (product.last_in_stock === false && obs.in_stock === true) {
    await db.from('alerts').insert({
      tracked_product_id: product.id, kind: 'back_in_stock',
      message: `${product.name} is back in stock`,
    });
    await sendEmail(`Back in stock: ${product.name}`, obs.stock_status);
  }
}

async function sendEmail(subject, body) {
  if (!process.env.SENDGRID_API_KEY || !process.env.ALERT_TO_EMAIL) return;  // optional, never fatal
  try {
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.SENDGRID_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: process.env.ALERT_TO_EMAIL }] }],
        from: { email: process.env.ALERT_FROM_EMAIL },
        subject, content: [{ type: 'text/plain', value: body }],
      }),
    });
  } catch { /* alerting must never break a scrape */ }
}
```

---

## 9. Backend API (Express)

### 9.1 Routes

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ ok, uptime, lastRunAt, lastRunOutcome, overdue }` — also the **warm-up** target |
| GET | `/api/store/search?q=` | proxies the mock store's search; §9.2 |
| GET | `/api/tracked` | list + latest price, delta, last outcome, 24h sparkline |
| POST | `/api/tracked` | body `{ storeProductId }`; fetches metadata, upserts, schedules `next_due_at = now()` |
| DELETE | `/api/tracked/:id` | soft delete (`is_active=false`) — preserves history |
| GET | `/api/tracked/:id` | detail + metadata |
| GET | `/api/tracked/:id/history?range=24h\|7d\|30d\|all` | `[{ scraped_at, price, in_stock, stock_status }]` |
| GET | `/api/tracked/:id/logs?limit=100` | scrape log incl. `attempt_trace` |
| PATCH | `/api/tracked/:id` | `{ scrape_interval_min }` — bonus, configurable frequency |
| POST | `/api/tracked/:id/scrape` | manual single scrape (rate-limited to 1/min per product) |
| POST | `/api/cron/scrape` | **protected**, returns `202` immediately |
| GET | `/api/runs?limit=20` | run history for the health view |
| GET | `/api/alerts` / POST `/api/alerts/:id/read` | bonus |

### 9.2 Search — depends on recon finding #3

- **If the store exposes server-side search** (`/api/products?search=`): proxy it directly, pass `q`.
- **If search is client-side only:** fetch the full catalogue, cache it in memory for 10 minutes
  (`Map` + timestamp), and filter case-insensitively on partial name. **Do not** hit the store once per
  keystroke — debounce 300 ms on the frontend *and* cache on the backend. Mention the cache in the
  design note; it shows you thought about load on the target.

```js
// backend/src/routes/store.js
import { Router } from 'express';
import { StoreClient } from '../scraper/httpClient.js';
import { STORE_PROFILE as SP } from '../scraper/storeProfile.js';

export const storeRouter = Router();
let cache = { at: 0, items: [] };
const TTL = 10 * 60 * 1000;

storeRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json({ items: [] });
  try {
    const client = new StoreClient();
    if (SP.paths.search) {
      const r = await client.fetchJson(SP.paths.search(q), { label: 'search' });
      return res.json({ items: normalise(r.json), source: 'store' });
    }
    if (Date.now() - cache.at > TTL) {
      const r = await client.fetchJson(SP.paths.list, { label: 'list' });
      cache = { at: Date.now(), items: normalise(r.json) };
    }
    const needle = q.toLowerCase();
    res.json({ items: cache.items.filter(i => i.name.toLowerCase().includes(needle)).slice(0, 25), source: 'cache' });
  } catch (e) {
    res.status(502).json({ error: 'store unreachable', code: e.code ?? 'UNKNOWN' });
  }
});

const normalise = (json) => (Array.isArray(json) ? json : json?.products ?? json?.data ?? [])
  .map(p => ({
    storeProductId: String(p.id ?? p._id ?? p.sku),
    name: p.name ?? p.title,
    category: p.category ?? null,
    brand: p.brand ?? null,
    imageUrl: p.image ?? p.imageUrl ?? p.thumbnail ?? null,
    rating: p.rating?.rate ?? p.rating ?? null,
    description: p.description ?? null,
  }))
  .filter(p => p.storeProductId && p.name);
```

### 9.3 Cron route — the free-tier-aware bit

```js
// backend/src/routes/cron.js
import { Router } from 'express';
import { startRun } from '../services/scrapeRunner.js';
import { db } from '../db/supabase.js';

export const cronRouter = Router();

cronRouter.post('/scrape', async (req, res) => {
  if (req.get('x-cron-secret') !== process.env.CRON_SECRET)
    return res.status(401).json({ error: 'unauthorized' });

  const { runId, skipped, reason } = await startRun({ trigger: 'cron' });

  // 202 IMMEDIATELY. cron-job.org's free tier gives you ~30 s before it records a failure;
  // a full run takes minutes. Acknowledge, then work in the background.
  res.status(202).json({ accepted: !skipped, runId, reason: reason ?? null });
});

// warm-up + watchdog target
cronRouter.get('/health', async (_req, res) => {
  const { data } = await db.from('scrape_runs').select('*').order('started_at', { ascending: false }).limit(1);
  const last = data?.[0] ?? null;
  const ageMin = last ? (Date.now() - new Date(last.started_at)) / 60000 : null;
  res.json({
    ok: true,
    uptimeSec: Math.round(process.uptime()),
    lastRunAt: last?.started_at ?? null,
    lastRunCounts: last ? { total: last.total, success: last.success, retried: last.retried, failed: last.failed } : null,
    overdue: ageMin != null && ageMin > 150,     // 2 h cadence + 30 min grace
  });
});
```

### 9.4 App bootstrap

```js
// backend/src/index.js
import express from 'express';
import cors from 'cors';
import { storeRouter } from './routes/store.js';
import { trackedRouter } from './routes/tracked.js';
import { cronRouter } from './routes/cron.js';
import { log } from './lib/logger.js';

const app = express();
app.use(express.json());
app.use(cors({ origin: (process.env.CORS_ORIGINS ?? '*').split(',') }));

app.use('/api/store', storeRouter);
app.use('/api/tracked', trackedRouter);
app.use('/api', cronRouter);           // /api/health and /api/cron/scrape

app.use((err, _req, res, _next) => {
  log.error('unhandled', { err: String(err) });
  res.status(500).json({ error: 'internal' });
});

process.on('unhandledRejection', (r) => log.error('unhandledRejection', { r: String(r) }));
process.on('uncaughtException',  (e) => log.error('uncaughtException', { e: String(e) }));

app.listen(process.env.PORT || 10000, () => log.info('listening', { port: process.env.PORT || 10000 }));
```

---

## 10. Frontend (React + Vite + Tailwind + Recharts)

### 10.1 Screens

**1 · Dashboard (`/`)**
- Header strip: last run time, success/retried/failed counts for that run, and a **red banner when
  `health.overdue === true`** ("No successful scrape in 2h37m — scheduler may be down"). This is the
  visible proof that the app never "silently stops".
- Card grid, one per tracked product: image, name, current price, Δ vs previous scrape (green/red),
  stock pill, last-outcome badge, 24 h sparkline, "consecutive failures: n" when > 0.
- "+ Track a product" opens the search modal.

**2 · Search modal**
- Debounced 300 ms input → `GET /api/store/search?q=`.
- Result rows: image, name, category, brand, rating → **Track** button → `POST /api/tracked`.
- Already-tracked items show a disabled "Tracking" state.

**3 · Product detail (`/p/:id`)**
- Metadata panel (image, category, brand, rating, description, store link) — satisfies "you may also
  display extra information about the product".
- **Price chart** (Recharts `LineChart`, `type="stepAfter"` is honest for discrete samples) with
  out-of-stock windows shaded via `ReferenceArea`. Range toggle 24h / 7d / 30d / all.
- **Table toggle** — same data as rows. Ship this first; the chart is the upgrade.
- **Scrape log table**: timestamp (IST), outcome badge (`success` green / `retried` amber /
  `failed` red), attempts, strategy, duration, error code, and an expandable row showing
  `attempt_trace` as `attempt 1 → 503 → waited 812ms → attempt 2 → 200`.
- Buttons: "Scrape now", interval selector (bonus), "Stop tracking".

**4 · Runs / health (`/health`, bonus)** — table of the last 20 runs with counts and duration.

### 10.2 Implementation notes

- `VITE_API_BASE` env var; no secrets in the frontend, ever. The Supabase service key lives only on Render.
- Poll `/api/health` every 60 s; poll the detail page every 60 s so a manual scrape appears without reload.
- Render timestamps in **Asia/Kolkata** with `Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })`
  while storing UTC.
- Empty states matter: a freshly tracked product has no history yet — show "First scrape scheduled"
  rather than an empty chart.
- Outcome badge colours must be unambiguous. Do not soften `failed`. The grader is looking for honesty.

---

## 11. Deployment

### 11.1 Supabase
1. New project → free tier → region closest to Render (Singapore / Frankfurt).
2. SQL editor → paste `backend/src/db/schema.sql` → run.
3. Settings → API → copy `Project URL` and **`service_role`** key (backend only — never in Vercel).
4. ⚠️ Free Supabase projects pause after ~7 days of inactivity. The 2-hourly cron keeps it alive. If you
   demo after a gap, un-pause it first.

### 11.2 Render (backend)
- New **Web Service** → connect repo → Root Directory `backend` → Build `npm ci` → Start `node src/index.js`.
- Free plan spins down after ~15 min idle; cold start is ~30–60 s. Handled by the warm-up cron (§11.4).
- **Do not install Playwright browsers in the production build** unless you must:
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and `BROWSER_FALLBACK_ENABLED=false`. Chromium does not fit
  comfortably in 512 MB alongside Node. If you genuinely need a browser tier in production, run it on
  **GitHub Actions** (§11.5) instead — free, and it gives you the CI/CD bonus at the same time.
- Render's own Cron Jobs are a paid feature — another reason the external cron is the correct call here.

### 11.3 Vercel (frontend)
- Import repo → Root Directory `frontend` → framework Vite → env `VITE_API_BASE=https://<svc>.onrender.com`.
- Set `CORS_ORIGINS` on Render to the Vercel domain (plus `http://localhost:5173` for dev).

### 11.4 cron-job.org — two jobs, not one

| Job | Schedule (UTC) | Request | Why |
|---|---|---|---|
| **Warm-up** | `55 1,3,5,7,9,11,13,15,17,19,21,23 * * *` | `GET https://<svc>.onrender.com/api/health` | Wakes the sleeping Render instance 5 min before each scrape, so the trigger below never hits a cold start and never times out. |
| **Scrape trigger** | `0 */2 * * *` | `POST https://<svc>.onrender.com/api/cron/scrape` with header `x-cron-secret: <CRON_SECRET>` | The actual 2-hourly scrape. |

Settings for the trigger job: **timeout 30 s**, **enable "retry on failure"**, **notify on failure**
(email). The endpoint answers `202` in milliseconds, so it will essentially never time out.

> Design-note line: "The naive approach — `node-cron` or `setInterval` inside the Express process — is
> broken on a free tier that sleeps after 15 minutes of inactivity. The timer dies with the process and
> the scraper silently stops, which is precisely the failure mode the brief calls out. An external
> trigger plus a stateless, lock-guarded endpoint is the only correct topology here."

### 11.5 Optional: browser tier on GitHub Actions (bonus, free)

```yaml
# .github/workflows/browser-scrape.yml
name: browser-tier-scrape
on:
  schedule: [{ cron: '30 */6 * * *' }]     # offset from the HTTP cadence
  workflow_dispatch:
jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: backend/package-lock.json }
      - run: npm ci
        working-directory: backend
      - run: npx playwright install --with-deps chromium
        working-directory: backend
      - run: node src/scripts/scrapeOnce.mjs --only-failed
        working-directory: backend
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          BROWSER_FALLBACK_ENABLED: 'true'
```

### 11.6 Environment variables

**backend (Render)**
```
PORT=10000
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...            # service_role — backend only
CRON_SECRET=<32-byte random hex>
CORS_ORIGINS=https://<app>.vercel.app,http://localhost:5173
STORE_BASE_URL=https://demo.inelabteamdev.com
BROWSER_FALLBACK_ENABLED=false
REQUEST_TIMEOUT_MS=15000
MAX_ATTEMPTS=4
SCRAPE_CONCURRENCY=2
RUN_BUDGET_MS=480000
ALERT_DROP_PCT=5
SENDGRID_API_KEY=            # optional
ALERT_FROM_EMAIL=            # optional
ALERT_TO_EMAIL=              # optional
LOG_LEVEL=info
```

**frontend (Vercel)**
```
VITE_API_BASE=https://<svc>.onrender.com
```

---

## 12. The observable (headed) run + the recording

### 12.1 CLI

```jsonc
// backend/package.json  (scripts)
{
  "scrape:once":    "node src/scripts/scrapeOnce.mjs",
  "scrape:headed":  "node src/scripts/headedRun.mjs",
  "recon":          "node src/scripts/recon.mjs",
  "capture":        "node src/scripts/captureFlow.mjs"
}
```

```js
// backend/src/scripts/headedRun.mjs
// npm run scrape:headed -- --product 12 --chaos flaky --slowmo 400
import { scrapeViaBrowser } from '../scraper/browserStrategy.js';

const a = Object.fromEntries(process.argv.slice(2).reduce((acc, v, i, arr) =>
  v.startsWith('--') ? [...acc, [v.slice(2), arr[i + 1]]] : acc, []));

console.log(`\n▶ HEADED RUN  product=${a.product}  chaos=${a.chaos ?? 'none'}\n`);
const t0 = Date.now();
try {
  const r = await scrapeViaBrowser(a.product, {
    headed: true, chaos: a.chaos ?? null, slowMo: Number(a.slowmo ?? 350), productName: a.name,
  });
  console.log('\n✅ SUCCESS', JSON.stringify(r.observation, null, 2));
  console.log('   trace:', JSON.stringify(r.meta.trace));
} catch (e) {
  console.log('\n❌ FAILED (recorded honestly, nothing written to price_history):', e.message);
}
console.log(`   ${Date.now() - t0} ms\n`);
```

### 12.2 Why chaos injection, and why it is not cheating

The brief requires the recording to show "how it handles a slow or failing response". The store's faults
are random — you cannot rely on one firing during a 3-minute take. `page.route()` intercepts the reveal
request and injects a 9 s delay then a 503, so the retry/backoff path is demonstrated **deterministically
against the real store** (the third attempt goes through to the live server and returns the real price).
Say this out loud in the recording: *"the first two responses are deliberately degraded by the test
harness so you can see the retry logic; the third is the real store response."* That reads as rigour,
not as faking it.

### 12.3 Recording script (2–4 minutes, rehearse once)

| Time | Show | Say |
|---|---|---|
| 0:00–0:20 | The live Vercel dashboard | "Tracked products, last run 41 minutes ago, 6 success / 1 retried / 0 failed." |
| 0:20–0:40 | Product detail: chart + log table, expand a `retried` row | "Every attempt is recorded, including the backoffs." |
| 0:40–1:10 | Terminal: `npm run scrape:headed -- --product X` (clean run), browser window visible | "Details → hover → Reveal. Note we wait on the *value*, not the element — the node shows a placeholder first." |
| 1:10–2:10 | `--chaos flaky`. Show attempt 1 hanging 9 s → timeout → backoff → attempt 2 → 503 → backoff → attempt 3 → real price | "Full-jitter exponential backoff, capped at 4 attempts." |
| 2:10–2:40 | Force a hard failure (`--chaos error` with all attempts blocked). Refresh the UI. | "The log shows `failed` with `HTTP_5XX`. **No row was written to price_history.** The chart has a gap, not a fake point." |
| 2:40–3:10 | Supabase table view: `price_history` vs `scrape_logs` side by side | "History has 214 rows, logs have 231 — the difference is the 17 honest failures." |
| 3:10–3:30 | cron-job.org dashboard showing the two jobs and green execution history | "Warm-up at :55, trigger on the hour, every two hours." |

Record at 1080p, keep the terminal font large, no music. Upload unlisted to YouTube or Drive with link
sharing on — and **test the link in an incognito window** before emailing.

---

## 13. Testing

### 13.1 Local chaos server (proves reliability without hammering the store)

```js
// backend/tests/chaosServer.mjs — express app that mimics the store's cruelty
import express from 'express';
const app = express(); app.use(express.json());
let n = 0;
const tokens = new Map();

app.get('/api/products/:id', (req, res) => {
  const token = `tk_${Math.random().toString(36).slice(2)}`;
  tokens.set(token, { at: Date.now(), used: false });
  res.json({ id: req.params.id, name: 'Chaos Widget', revealToken: token, stockStatus: 'In Stock' });
});

app.post('/api/products/:id/reveal', async (req, res) => {
  n++;
  const t = tokens.get(req.body?.token);
  if (!t) return res.status(409).json({ error: 'bad token' });
  if (t.used) return res.status(410).json({ error: 'token consumed' });
  if (Date.now() - t.at > 60_000) return res.status(410).json({ error: 'token expired' });
  if (n % 5 === 0) return res.status(503).end();                         // 20% hard failure
  if (n % 3 === 0) await new Promise(r => setTimeout(r, 9000));          // 33% very slow
  t.used = true;
  res.json({ price: 1299.5 + (n % 7), currency: 'INR', stockStatus: n % 11 ? 'In Stock' : 'Out of Stock' });
});

app.listen(4555, () => console.log('chaos store on :4555'));
```

Point `STORE_BASE_URL` at `http://localhost:4555` and run 100 iterations. **Acceptance: ≥95 % of
iterations end in `success` or `retried`, 0 iterations write a wrong or null price, 100 % of iterations
produce exactly one `scrape_logs` row.** Put that number in the design note — a measured reliability
figure is far more convincing than "I added retries".

### 13.2 Unit tests (vitest)

- `money.test.js` — `₹1,23,456.78` → 123456.78; `$1,234.56` → 1234.56; `"•••"` → throws; `""` → throws;
  `"Rs. 0"` → throws (price must be > 0).
- `stock.test.js` — every label in `stockMap`, plus `"Kinda available"` → throws.
- `extractors.test.js` — feed the real payloads from `docs/store-flow.har` as fixtures; assert the rung
  that wins; then mutate the payload (rename `price` → `amount`) and assert a lower rung rescues it.
- `errors.test.js` — 404 is not retryable, 503 is, 429 honours `Retry-After`.

### 13.3 CI

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npm run lint && npm test
        working-directory: backend
      - run: npm ci && npm run build
        working-directory: frontend
```

---

## 14. Repository layout

```
ine-price-tracker/
├─ README.md
├─ DESIGN_NOTE.md
├─ .github/workflows/{ci.yml,browser-scrape.yml}
├─ docs/
│  ├─ recon-report.json          # evidence from Phase 1
│  ├─ store-flow.har
│  ├─ reveal.curl.txt
│  └─ screenshots/
├─ backend/
│  ├─ package.json
│  ├─ src/
│  │  ├─ index.js
│  │  ├─ config.js
│  │  ├─ db/{supabase.js,schema.sql}
│  │  ├─ routes/{store.js,tracked.js,cron.js,runs.js,alerts.js}
│  │  ├─ services/{scrapeRunner.js,structureWatch.js,alerts.js}
│  │  ├─ scraper/{storeProfile.js,httpClient.js,httpStrategy.js,browserStrategy.js,extractors.js,validate.js,index.js}
│  │  ├─ lib/{errors.js,money.js,lock.js,logger.js}
│  │  └─ scripts/{recon.mjs,captureFlow.mjs,headedRun.mjs,scrapeOnce.mjs}
│  └─ tests/{chaosServer.mjs,*.test.js,fixtures/}
└─ frontend/
   ├─ package.json
   └─ src/
      ├─ main.tsx, App.tsx
      ├─ api/client.ts
      ├─ pages/{Dashboard.tsx,ProductDetail.tsx,Health.tsx}
      └─ components/{SearchModal.tsx,PriceChart.tsx,HistoryTable.tsx,ScrapeLogTable.tsx,OutcomeBadge.tsx,HealthBanner.tsx}
```

---

## 15. README template (deliverable — the brief names its required contents)

````markdown
# INE Product Price Tracker

Live app: https://<app>.vercel.app
API:      https://<svc>.onrender.com/api/health
Demo video: <link>

## What it does
Search INE's mock storefront by partial or full product name, track a product, and the app scrapes its
price and stock every 2 hours. Price/stock history is shown as a chart and a table; every scrape attempt
— success, retried, or failed — is listed in a per-product log.

## Scraping schedule
Every 2 hours on the hour (UTC), triggered by cron-job.org:
- `55 1-23/2 * * *` → `GET /api/health`  (wakes the sleeping Render free instance 5 minutes early)
- `0 */2 * * *`     → `POST /api/cron/scrape` with `x-cron-secret`
Per-product overrides are supported via `scrape_interval_min` (default 120).

## Architecture
Vercel (React) → Render (Express) → Supabase (Postgres). Scraping is HTTP-first; a Playwright tier
exists for the observable headed run and as an escalation path for parse failures.

## Local setup
```bash
git clone <repo> && cd ine-price-tracker
# database
psql "$SUPABASE_DB_URL" -f backend/src/db/schema.sql     # or paste into the Supabase SQL editor
# backend
cd backend && npm ci && cp .env.example .env             # fill in the values
npm run dev
# frontend
cd ../frontend && npm ci && cp .env.example .env
npm run dev
```

## Commands
| Command | Purpose |
|---|---|
| `npm run recon -- --product 12` | Re-run the store reconnaissance matrix; writes `docs/recon-report.json` |
| `npm run scrape:once` | One full scrape cycle for all due products |
| `npm run scrape:headed -- --product 12 --chaos flaky` | Visible browser run with injected slow/failing responses |
| `npm test` | Unit tests + chaos-server reliability suite |

## Environment variables
| Name | Where | Required | Purpose |
|---|---|---|---|
| `SUPABASE_URL` | backend | yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | backend | yes | service_role key — **backend only, never exposed to the browser** |
| `CRON_SECRET` | backend | yes | shared secret for `POST /api/cron/scrape` |
| `CORS_ORIGINS` | backend | yes | comma-separated allowed origins |
| `STORE_BASE_URL` | backend | yes | `https://demo.inelabteamdev.com` |
| `BROWSER_FALLBACK_ENABLED` | backend | no (`false`) | enable the Playwright tier; keep `false` on Render free |
| `REQUEST_TIMEOUT_MS` / `MAX_ATTEMPTS` / `SCRAPE_CONCURRENCY` / `RUN_BUDGET_MS` | backend | no | reliability tuning |
| `ALERT_DROP_PCT`, `SENDGRID_API_KEY`, `ALERT_FROM_EMAIL`, `ALERT_TO_EMAIL` | backend | no | price-drop / back-in-stock email alerts |
| `VITE_API_BASE` | frontend | yes | backend base URL |

## Data model
`tracked_products` · `price_history` (successes only, `price > 0` enforced by a CHECK constraint) ·
`scrape_logs` (every attempt, with a per-attempt trace) · `scrape_runs` · `run_locks` ·
`structure_signatures` · `alerts`.
````

---

## 16. DESIGN_NOTE template (deliverable)

The brief asks for three things specifically: **how you made scraping reliable**, **what trade-offs you
made**, and **what your AI tools got wrong first and how you corrected it**. Structure it exactly that way.

```markdown
# Design note

## 1. How I made the scraping reliable

**Full cold chain every run, never a cached token.** Recon showed the reveal endpoint requires a
<nonce / session cookie / nothing — fill from docs/recon-report.json>, with a TTL bracket of
<N seconds> and <single-use / replayable> semantics. Rather than manage expiry, every scrape replays
details → (hover) → reveal from a fresh state. Cost: two extra requests per product per two hours.
Benefit: token expiry can never be a cause of production failure.

**Classified retries.** 5xx/429/timeouts/connection resets retry with full-jitter exponential backoff
(700 ms base, 8 s cap, 4 attempts, `Retry-After` honoured). 400/404/422 never retry. 401/403/409/410
retry exactly once and only after rebuilding the session — replaying a consumed nonce is guaranteed to
fail twice.

**Extractor ladder.** Price extraction tries seven ordered strategies (typed JSON field → string field →
encoded field → deep key scan → JSON-LD → microdata → regex). The winning rung is persisted on every row.
If the store's payload shape moves, a lower rung keeps the scrape green *and* a `structure_drift` alert
fires. A single-selector scraper would either break or silently return the wrong thing.

**Two-source agreement.** When confidence is low or the price moved more than 70 %, a second independent
fetch must agree within 2 % before anything is written. The store deliberately changes prices often, so
rejecting large deltas outright would discard real data — requiring corroboration instead of guessing is
the correct response.

**Nothing is written unless it is valid.** `price_history.price` is `NOT NULL CHECK (price > 0)`;
unknown stock labels throw rather than defaulting to "in stock". A failed scrape produces exactly one
`scrape_logs` row with an error code and the full per-attempt trace, and zero history rows.

**Run hygiene.** A Postgres-backed lease lock prevents overlapping runs when cron retries; a circuit
breaker stops after 5 consecutive failures instead of burning the run budget; an 8-minute wall-clock
budget marks unreached products `BUDGET_EXCEEDED` rather than leaving them ambiguous; `/api/health`
exposes `overdue` and the UI shows a red banner when no run has completed in 2.5 hours, so the system
cannot silently stop without it being visible.

**Measured, not asserted.** Against a local chaos server injecting 20 % 503s and 33 % nine-second
responses, 100 iterations produced <X>% success-or-retried, 0 incorrect prices, and exactly one log row
per iteration.

## 2. Trade-offs

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Fetch strategy | HTTP + JSON parsing | Playwright for every run | The SPA's data is JSON; JS rendering is not genuinely required. ~300 ms / 40 MB vs ~4 s / 400 MB, and Chromium does not fit Render's 512 MB free tier. |
| Browser tier | Kept as headed demo + escalation for parse failures only | Dropped entirely | The brief mandates an observable headed run, and a browser is the right escalation for structural (not network) failures. |
| Scheduling | External cron + stateless `202` endpoint | `node-cron` in-process | Render free sleeps after 15 min; an in-process timer dies with the process and the scraper stops silently. |
| Cron topology | Warm-up job 5 min before each trigger | Single trigger job | A cold start can exceed cron-job.org's 30 s timeout, producing spurious failures. |
| Storage on failure | Write nothing to history | Write `NULL`/last-known price | A gap in the chart is truthful; a repeated point is a lie. |
| History rows | Store every successful sample, changed or not | Store only on change | "Price over time" needs the sample cadence; a flat line is information. |
| Concurrency | 2, with jitter | All products in parallel | Avoids a thundering herd against an intentionally fragile store and keeps memory flat. |

## 3. What the AI tools got wrong first
<Replace with what actually happened to you — keep it specific and honest. These were mine:>

1. **In-process scheduler.** First suggestion was `node-cron` inside Express. That silently dies when
   Render's free instance sleeps. Corrected to an external trigger plus a lock-guarded stateless endpoint.
2. **`waitForSelector` on the price element.** It resolved immediately because the node exists showing a
   `•••` placeholder before the value arrives, so the parser saw `NaN`. Corrected to `waitForFunction`
   with a value predicate (`/\d/.test(t) && !/[•*]{2,}|loading/.test(t)`).
3. **Caching the reveal token in a module-level variable.** Worked locally, failed in production once the
   TTL elapsed between runs. Corrected by removing the cache entirely.
4. **Writing `price: null` on failure** so the chart "wouldn't have holes". That is exactly the behaviour
   the brief forbids. Corrected by splitting `price_history` from `scrape_logs` and adding a DB-level
   `CHECK (price > 0)`.
5. **Retrying every non-200.** It burned the retry budget on 404s. Corrected with the error taxonomy.
6. **`Promise.all` over all tracked products.** Thundering herd plus memory spikes. Corrected to
   `p-limit(2)` with start jitter.
7. **Defaulting an unrecognised stock label to `in_stock: true`.** Corrected to throw — an unknown label
   is a failure, not an availability claim.
```

---

## 17. Acceptance checklist (tick before you email)

**Functional**
- [ ] Partial-name search returns results from the live mock store
- [ ] Tracking a product persists it in Supabase and schedules an immediate first scrape
- [ ] Price + stock history renders as a chart **and** a table
- [ ] Per-product scrape log shows timestamp + outcome (`success` / `retried` / `failed`) for every attempt
- [ ] A forced failure produces a `failed` log row and **zero** new `price_history` rows
- [ ] `npm run scrape:headed -- --chaos flaky` visibly retries and then succeeds

**Reliability**
- [ ] 100-iteration chaos-server run: ≥95 % success-or-retried, 0 wrong prices, 1 log row per iteration
- [ ] Two simultaneous `POST /api/cron/scrape` calls → second returns `skipped: true`
- [ ] Killing the process mid-run → the lease expires and the next run proceeds
- [ ] `/api/health` reports `overdue: true` when the last run is stale, and the UI shows the banner

**Deployment**
- [ ] Vercel URL loads and talks to Render (no CORS errors in the console)
- [ ] cron-job.org shows ≥3 consecutive green executions of both jobs
- [ ] At least 3–4 real scrape cycles of history exist before you submit — **start the cron today, not
      an hour before the deadline.** A chart with two points is the weakest possible demo.
- [ ] Supabase service key does not appear anywhere in the frontend bundle (`grep -r "service_role" frontend/dist`)

**Deliverables**
- [ ] Live site link · [ ] public GitHub repo · [ ] 2–4 min headed recording (link tested in incognito)
- [ ] README with setup, schedule, env vars · [ ] DESIGN_NOTE · [ ] PDF resume
- [ ] `docs/recon-report.json` + `docs/store-flow.har` committed as evidence

**Submission email**
- To `sstephen@ine.com`, cc `ssingh@ine.com`
- Subject exactly: `First Round: Software Engineer Intern Assignment - <Your Name>`
- Deadline 2026-09-20 23:59 IST

---

## 18. Common failure modes to avoid (ranked by how often they sink this assignment)

1. **Caching the reveal token.** Works in dev, dies in prod two hours later. Don't.
2. **`node-cron` inside the web process.** Silently stops. The brief calls this out by name.
3. **Storing `0`, `null`, or the last-known price on failure.** Explicit disqualifier-grade behaviour.
4. **`waitForSelector` on a placeholder node.** Produces `NaN` prices that get coerced to 0.
5. **Submitting with 2 data points.** Deploy the cron on day one so the chart has a real shape.
6. **Playwright on Render free.** OOM, failed deploys, hours lost. Keep the prod path HTTP-only.
7. **Leaking the Supabase `service_role` key into the frontend.** Instant credibility loss.
8. **A scrape log that only records successes.** The grader will look for failures and not finding any
   reads as hidden, not as flawless.
9. **Hammering the store with an un-debounced search box.** One request per keystroke against a site
   you were asked to treat gently.
10. **No README env-var table.** It is an explicitly named deliverable; it takes ten minutes.
