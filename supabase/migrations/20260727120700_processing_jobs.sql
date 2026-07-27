-- Worker pipeline audit trail: scan_runs (one per daily pipeline
-- invocation) break down into scan_run_steps (one per job_type stage),
-- each of which may create one or more processing_jobs (the
-- ProcessingJob audit rows worker code actually writes), which may in
-- turn have multiple processing_job_attempts (retry history) and,
-- if retries are exhausted, a dead_letter_jobs row. See
-- docs/operations/daily-jobs.md.
--
-- Not workspace-scoped: these describe register-wide/global worker
-- execution, not any one customer's data.

create table public.scan_runs (
  id uuid primary key default gen_random_uuid(),
  job_type public.job_type not null,
  status public.job_status not null default 'pending',
  register_source_id uuid references public.register_sources (id),
  started_at timestamptz,
  finished_at timestamptz,
  triggered_by text not null default 'schedule',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.scan_runs is 'Top-level pipeline run (e.g. one full daily fetch_publications sweep across registers). triggered_by is ''schedule'', ''manual'', or a user id for on-demand /platform runs.';
create index scan_runs_job_type_idx on public.scan_runs (job_type, started_at desc);
create index scan_runs_register_source_id_idx on public.scan_runs (register_source_id);

create trigger set_updated_at before update on public.scan_runs
  for each row execute function private.set_updated_at();

create table public.scan_run_steps (
  id uuid primary key default gen_random_uuid(),
  scan_run_id uuid not null references public.scan_runs (id) on delete cascade,
  step public.job_type not null,
  status public.job_status not null default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  attempt integer not null default 1,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.scan_run_steps is 'Per-stage granular status within a scan_run, allowing operators to re-trigger a single stage (see docs/operations/daily-jobs.md).';
create index scan_run_steps_scan_run_id_idx on public.scan_run_steps (scan_run_id);

create trigger set_updated_at before update on public.scan_run_steps
  for each row execute function private.set_updated_at();

create table public.processing_jobs (
  id uuid primary key default gen_random_uuid(),
  scan_run_step_id uuid references public.scan_run_steps (id) on delete set null,
  type public.job_type not null,
  status public.job_status not null default 'pending',
  register_source_id uuid references public.register_sources (id),
  attempt integer not null default 1,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.processing_jobs is 'ProcessingJob audit trail: one row per job execution/retry attempt. Idempotent per docs/operations/daily-jobs.md - upserts keyed on the job''s natural key are the worker''s responsibility, not enforced here.';
create index processing_jobs_scan_run_step_id_idx on public.processing_jobs (scan_run_step_id);
create index processing_jobs_type_status_idx on public.processing_jobs (type, status);
create index processing_jobs_register_source_id_idx on public.processing_jobs (register_source_id);

create trigger set_updated_at before update on public.processing_jobs
  for each row execute function private.set_updated_at();

create table public.processing_job_attempts (
  id uuid primary key default gen_random_uuid(),
  processing_job_id uuid not null references public.processing_jobs (id) on delete cascade,
  attempt_number integer not null,
  status public.job_status not null,
  started_at timestamptz,
  finished_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (processing_job_id, attempt_number)
);
comment on table public.processing_job_attempts is 'Per-attempt history for a processing_job''s exponential-backoff retries (default max 3 attempts, see docs/operations/daily-jobs.md).';
create index processing_job_attempts_processing_job_id_idx on public.processing_job_attempts (processing_job_id);

create table public.dead_letter_jobs (
  id uuid primary key default gen_random_uuid(),
  processing_job_id uuid not null references public.processing_jobs (id) on delete cascade,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  failed_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
comment on table public.dead_letter_jobs is 'Jobs that exhausted all retry attempts and require operator intervention, surfaced on /platform''s operations dashboard.';
create index dead_letter_jobs_processing_job_id_idx on public.dead_letter_jobs (processing_job_id);
create index dead_letter_jobs_resolved_idx on public.dead_letter_jobs (resolved);
create index dead_letter_jobs_resolved_by_idx on public.dead_letter_jobs (resolved_by);

-- ---------------------------------------------------------------------
-- Row Level Security (register-wide, not workspace-scoped)
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'scan_runs',
    'scan_run_steps',
    'processing_jobs',
    'processing_job_attempts',
    'dead_letter_jobs'
  ])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "service_role_all" on public.%I for all to service_role using (true) with check (true);',
      t
    );
    execute format(
      'create policy "platform_operators_all" on public.%I for all to authenticated using (private.is_platform_operator()) with check (private.is_platform_operator());',
      t
    );
  end loop;
end;
$$;
