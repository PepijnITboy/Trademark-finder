-- Register connectors: the trademark registers Merkwacht can ingest from
-- (BOIP at launch; EUIPO/WIPO/USPTO reserved as future/disabled rows),
-- their configuration, credential *metadata* (never the credential
-- values themselves - those stay in server-only environment variables
-- per docs/security/security-model.md), health checks, checkpoints, and
-- the raw import/record audit trail.
--
-- None of these tables are workspace-scoped: candidate/register data is
-- fetched once and shared across every workspace, per
-- docs/domain/trademark-model.md.

create table public.register_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status public.connector_health_status not null default 'configuration_required',
  capabilities jsonb not null default '{}'::jsonb,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.register_sources is 'A trademark register Merkwacht can connect to (BOIP, EUIPO, WIPO, USPTO, ...). status/is_enabled reflect real connector state, never fabricated data - see docs/connectors/connector-contract.md.';

create trigger set_updated_at before update on public.register_sources
  for each row execute function private.set_updated_at();

create table public.register_connector_configs (
  id uuid primary key default gen_random_uuid(),
  register_source_id uuid not null unique references public.register_sources (id) on delete cascade,
  environment text not null default 'production',
  base_url text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.register_connector_configs is 'Non-secret connector configuration (base URL, page size, environment). Credential values are never stored here.';

create trigger set_updated_at before update on public.register_connector_configs
  for each row execute function private.set_updated_at();

create table public.register_connector_credentials_metadata (
  id uuid primary key default gen_random_uuid(),
  register_source_id uuid not null references public.register_sources (id) on delete cascade,
  credential_name text not null,
  is_set boolean not null default false,
  last_verified_at timestamptz,
  last_rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (register_source_id, credential_name)
);
comment on table public.register_connector_credentials_metadata is 'Tracks *whether* a connector credential (e.g. BOIP_API_KEY) is configured/rotated, never the credential value itself.';

create trigger set_updated_at before update on public.register_connector_credentials_metadata
  for each row execute function private.set_updated_at();

create table public.register_health_checks (
  id uuid primary key default gen_random_uuid(),
  register_source_id uuid not null references public.register_sources (id) on delete cascade,
  status public.connector_health_status not null,
  message text,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.register_health_checks is 'History of healthCheck() probes for a register connector, surfaced on /platform.';
create index register_health_checks_source_checked_idx on public.register_health_checks (register_source_id, checked_at desc);

create table public.register_checkpoints (
  id uuid primary key default gen_random_uuid(),
  register_source_id uuid not null unique references public.register_sources (id) on delete cascade,
  checkpoint jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.register_checkpoints is 'Opaque, per-connector incremental fetch cursor (SourceCheckpoint). Interpreted only by the owning connector.';

create trigger set_updated_at before update on public.register_checkpoints
  for each row execute function private.set_updated_at();

create table public.source_imports (
  id uuid primary key default gen_random_uuid(),
  register_source_id uuid not null references public.register_sources (id) on delete cascade,
  status public.job_status not null default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  records_fetched integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  checkpoint_before jsonb,
  checkpoint_after jsonb,
  error text,
  created_at timestamptz not null default now()
);
comment on table public.source_imports is 'One row per fetch_publications run against a register connector (see docs/operations/daily-jobs.md).';
create index source_imports_register_source_id_idx on public.source_imports (register_source_id, started_at desc);

create table public.raw_source_records (
  id uuid primary key default gen_random_uuid(),
  source_import_id uuid references public.source_imports (id) on delete set null,
  register_source_id uuid not null references public.register_sources (id) on delete cascade,
  external_reference text not null,
  raw_payload jsonb not null,
  fetched_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.raw_source_records is 'Archived raw connector payload for a single register record, for audit purposes only (raw_payload_ref target). Never exposed through customer-facing APIs - platform_operator/service_role only.';
create index raw_source_records_source_external_idx on public.raw_source_records (register_source_id, external_reference);
create index raw_source_records_source_import_id_idx on public.raw_source_records (source_import_id);

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Register-wide tables are not organization/workspace-scoped. Per
-- docs/security/security-model.md, `authenticated` gets no access except
-- through the dedicated platform_operator policy; register_sources is
-- the one exception that is also readable (not writable) by any
-- authenticated user, since the app needs to show which registers are
-- supported/enabled.
-- ---------------------------------------------------------------------

alter table public.register_sources enable row level security;
create policy "service_role_all" on public.register_sources for all to service_role using (true) with check (true);
create policy "authenticated_read" on public.register_sources for select to authenticated using (true);
create policy "platform_operators_write" on public.register_sources for all to authenticated
  using (private.is_platform_operator()) with check (private.is_platform_operator());

alter table public.register_connector_configs enable row level security;
create policy "service_role_all" on public.register_connector_configs for all to service_role using (true) with check (true);
create policy "platform_operators_all" on public.register_connector_configs for all to authenticated
  using (private.is_platform_operator()) with check (private.is_platform_operator());

alter table public.register_connector_credentials_metadata enable row level security;
create policy "service_role_all" on public.register_connector_credentials_metadata for all to service_role using (true) with check (true);
create policy "platform_operators_all" on public.register_connector_credentials_metadata for all to authenticated
  using (private.is_platform_operator()) with check (private.is_platform_operator());

alter table public.register_health_checks enable row level security;
create policy "service_role_all" on public.register_health_checks for all to service_role using (true) with check (true);
create policy "platform_operators_all" on public.register_health_checks for all to authenticated
  using (private.is_platform_operator()) with check (private.is_platform_operator());

alter table public.register_checkpoints enable row level security;
create policy "service_role_all" on public.register_checkpoints for all to service_role using (true) with check (true);
create policy "platform_operators_all" on public.register_checkpoints for all to authenticated
  using (private.is_platform_operator()) with check (private.is_platform_operator());

alter table public.source_imports enable row level security;
create policy "service_role_all" on public.source_imports for all to service_role using (true) with check (true);
create policy "platform_operators_all" on public.source_imports for all to authenticated
  using (private.is_platform_operator()) with check (private.is_platform_operator());

alter table public.raw_source_records enable row level security;
create policy "service_role_all" on public.raw_source_records for all to service_role using (true) with check (true);
create policy "platform_operators_all" on public.raw_source_records for all to authenticated
  using (private.is_platform_operator()) with check (private.is_platform_operator());
