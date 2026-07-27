-- Platform-operator-only tooling: global settings, feature flags,
-- customer notes, incident tracking, scoring experimentation, system
-- health, and time-boxed support access grants. Everything here is
-- gated by private.is_platform_operator() - see
-- docs/security/security-model.md's `/platform` boundary.

create table public.platform_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
comment on table public.platform_settings is 'Global operational settings (e.g. default AI budget, notification cadence overrides) editable from /platform.';
create index platform_settings_updated_by_idx on public.platform_settings (updated_by);

create table public.platform_setting_versions (
  id uuid primary key default gen_random_uuid(),
  platform_setting_id uuid not null references public.platform_settings (id) on delete cascade,
  value jsonb not null,
  changed_by uuid references auth.users (id),
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.platform_setting_versions is 'Append-only history of platform_settings.value changes, for audit/rollback.';
create index platform_setting_versions_setting_id_idx on public.platform_setting_versions (platform_setting_id, changed_at desc);
create index platform_setting_versions_changed_by_idx on public.platform_setting_versions (changed_by);

create table public.platform_feature_flags (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text,
  is_enabled boolean not null default false,
  rollout_percentage integer not null default 100 check (rollout_percentage between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.platform_feature_flags is 'Internal/operational feature flags (rollout toggles), distinct from customer-facing feature_flag entitlements.';

create trigger set_updated_at before update on public.platform_feature_flags
  for each row execute function private.set_updated_at();

create table public.platform_customer_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_user_id uuid references auth.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.platform_customer_notes is 'Internal-only notes about a customer workspace, never exposed to the customer''s own /app views.';
create index platform_customer_notes_workspace_id_idx on public.platform_customer_notes (workspace_id, created_at desc);
create index platform_customer_notes_author_user_id_idx on public.platform_customer_notes (author_user_id);

create trigger set_updated_at before update on public.platform_customer_notes
  for each row execute function private.set_updated_at();

create table public.platform_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  severity public.incident_severity not null default 'medium',
  status public.incident_status not null default 'open',
  register_source_id uuid references public.register_sources (id),
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.platform_incidents is 'Operational incidents (e.g. connector outage, AI budget exhaustion escalation) tracked on /platform.';
create index platform_incidents_status_idx on public.platform_incidents (status);
create index platform_incidents_register_source_id_idx on public.platform_incidents (register_source_id);

create trigger set_updated_at before update on public.platform_incidents
  for each row execute function private.set_updated_at();

create table public.platform_incident_events (
  id uuid primary key default gen_random_uuid(),
  platform_incident_id uuid not null references public.platform_incidents (id) on delete cascade,
  event_type text not null,
  message text,
  occurred_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
comment on table public.platform_incident_events is 'Timeline of updates on a platform_incidents row.';
create index platform_incident_events_incident_id_idx on public.platform_incident_events (platform_incident_id, occurred_at desc);
create index platform_incident_events_created_by_idx on public.platform_incident_events (created_by);

create table public.scoring_experiments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  hypothesis text,
  weight_profile_id uuid references public.scoring_weight_profiles (id),
  status public.scoring_experiment_status not null default 'draft',
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.scoring_experiments is 'A candidate scoring change (e.g. trial weight profile) under evaluation before being shipped as a new scoring_weight_profiles row.';
create index scoring_experiments_weight_profile_id_idx on public.scoring_experiments (weight_profile_id);
create index scoring_experiments_created_by_idx on public.scoring_experiments (created_by);

create trigger set_updated_at before update on public.scoring_experiments
  for each row execute function private.set_updated_at();

create table public.scoring_test_cases (
  id uuid primary key default gen_random_uuid(),
  scoring_experiment_id uuid references public.scoring_experiments (id) on delete cascade,
  watched_mark_text text not null,
  candidate_mark_text text not null,
  expected_total_score numeric(5, 2),
  expected_status public.match_workflow_status,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.scoring_test_cases is 'Golden/regression test cases used to validate scoring changes before rollout - see docs/testing/testing-strategy.md.';
create index scoring_test_cases_experiment_id_idx on public.scoring_test_cases (scoring_experiment_id);

create trigger set_updated_at before update on public.scoring_test_cases
  for each row execute function private.set_updated_at();

create table public.system_health_checks (
  id uuid primary key default gen_random_uuid(),
  component text not null,
  status public.connector_health_status not null default 'ok',
  checked_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
comment on table public.system_health_checks is 'Health probes for non-register-connector system components (database, worker, AI provider, etc.), surfaced on /platform alongside register_health_checks.';
create index system_health_checks_component_idx on public.system_health_checks (component, checked_at desc);

create table public.support_access_sessions (
  id uuid primary key default gen_random_uuid(),
  platform_user_id uuid not null references public.platform_users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  reason text not null,
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.support_access_sessions is 'Time-boxed, audited grant allowing a platform operator to view a specific customer workspace''s data for support purposes.';
create index support_access_sessions_workspace_id_idx on public.support_access_sessions (workspace_id);
create index support_access_sessions_platform_user_id_idx on public.support_access_sessions (platform_user_id);

-- ---------------------------------------------------------------------
-- Row Level Security - platform_operator only (plus service_role)
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'platform_settings',
    'platform_setting_versions',
    'platform_feature_flags',
    'platform_customer_notes',
    'platform_incidents',
    'platform_incident_events',
    'scoring_experiments',
    'scoring_test_cases',
    'system_health_checks',
    'support_access_sessions'
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
