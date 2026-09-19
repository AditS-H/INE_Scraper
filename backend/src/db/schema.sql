-- INE Product Price Tracker: persistence invariants
create extension if not exists pgcrypto;

do $$ begin create type scrape_outcome as enum ('success', 'retried', 'failed');
exception when duplicate_object then null; end $$;
do $$ begin create type scrape_strategy as enum ('browser', 'none');
exception when duplicate_object then null; end $$;

create table if not exists tracked_products (
  id uuid primary key default gen_random_uuid(),
  store_product_id text not null unique,
  name text not null,
  url text,
  category text,
  brand text,
  description text,
  is_active boolean not null default true,
  scrape_interval_min integer not null default 120 check (scrape_interval_min > 0),
  next_due_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  last_scrape_at timestamptz,
  last_outcome scrape_outcome,
  last_price numeric(12,2),
  last_currency text,
  last_in_stock boolean,
  consecutive_failures integer not null default 0
);

-- Success observations only. A failed run must never create a row here.
create table if not exists price_history (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid not null references tracked_products(id) on delete cascade,
  run_id uuid,
  price numeric(12,2) not null check (price > 0),
  currency text not null check (char_length(currency) = 3),
  in_stock boolean not null,
  stock_status text not null,
  stock_qty integer check (stock_qty is null or stock_qty >= 0),
  strategy scrape_strategy not null,
  extractor text not null,
  confidence text not null check (confidence in ('high', 'verified', 'low')),
  scraped_at timestamptz not null default now()
);
create index if not exists ph_product_time on price_history (tracked_product_id, scraped_at desc);

-- Every attempt, including all terminal failures, gets one record here.
create table if not exists scrape_logs (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid references tracked_products(id) on delete cascade,
  run_id uuid,
  outcome scrape_outcome not null,
  attempts integer not null check (attempts >= 0),
  strategy scrape_strategy not null default 'browser',
  http_status integer,
  error_code text,
  error_message text,
  price_found numeric(12,2),
  duration_ms integer not null check (duration_ms >= 0),
  attempt_trace jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists sl_product_time on scrape_logs (tracked_product_id, started_at desc);

create table if not exists scrape_runs (
  id uuid primary key,
  trigger text not null check (trigger in ('cron', 'manual', 'ci')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  total integer not null default 0,
  success integer not null default 0,
  retried integer not null default 0,
  failed integer not null default 0,
  notes text
);

create table if not exists run_locks (
  key text primary key,
  run_id uuid,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  tracked_product_id uuid references tracked_products(id) on delete cascade,
  kind text not null check (kind in ('price_drop', 'back_in_stock', 'structure_drift', 'stale')),
  message text not null,
  old_value numeric(12,2),
  new_value numeric(12,2),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists alerts_created_at on alerts (created_at desc);

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

alter table tracked_products enable row level security;
alter table price_history enable row level security;
alter table scrape_logs enable row level security;
alter table scrape_runs enable row level security;
alter table alerts enable row level security;
-- No anon/authenticated policies: the backend service role is the only data writer.
