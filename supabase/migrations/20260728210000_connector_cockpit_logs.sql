-- Connector cockpit: operation logs + disable reason on register_sources.
-- Credential values remain env-only; this table stores operator-facing logs.

alter table public.register_sources
  add column if not exists disable_reason text,
  add column if not exists last_fetch_at timestamptz,
  add column if not exists last_fetched_count integer,
  add column if not exists connected_organization_count integer not null default 0;

create table if not exists public.register_connector_operation_logs (
  id uuid primary key default gen_random_uuid(),
  register_source_id uuid not null references public.register_sources (id) on delete cascade,
  level text not null check (level in ('info', 'warn', 'error')),
  message text not null,
  created_at timestamptz not null default now()
);

comment on table public.register_connector_operation_logs is 'Operator-facing connector probe/fetch/disable log lines for the platform catalog cockpit.';

create index if not exists register_connector_operation_logs_source_created_idx
  on public.register_connector_operation_logs (register_source_id, created_at desc);

alter table public.register_connector_operation_logs enable row level security;
