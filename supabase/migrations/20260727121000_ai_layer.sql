-- Optional, budget-capped AI enrichment layer. See docs/scoring/ai-layer.md.
-- The product must work fully with AI_PROVIDER=none; every table here is
-- config/audit for the *optional* enrichment step, never a hard
-- dependency of the rule-based scoring pipeline.

create table public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  is_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ai_providers is 'Configured AI providers (e.g. "openai", "none"). is_enabled=false must never be silently bypassed - see docs/scoring/ai-layer.md.';

create trigger set_updated_at before update on public.ai_providers
  for each row execute function private.set_updated_at();

create table public.ai_model_configs (
  id uuid primary key default gen_random_uuid(),
  ai_provider_id uuid not null references public.ai_providers (id) on delete cascade,
  model_name text not null,
  purpose text not null default 'match_enrichment',
  max_tokens integer,
  temperature numeric(3, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.ai_model_configs is 'Model-level configuration for a given AI provider/purpose (e.g. which OpenAI model backs match enrichment).';
create index ai_model_configs_provider_id_idx on public.ai_model_configs (ai_provider_id);

create trigger set_updated_at before update on public.ai_model_configs
  for each row execute function private.set_updated_at();

create table public.ai_usage_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  ai_provider_id uuid references public.ai_providers (id),
  ai_model_config_id uuid references public.ai_model_configs (id),
  trademark_match_id uuid references public.trademark_matches (id) on delete set null,
  occurred_at timestamptz not null default now(),
  prompt_tokens integer,
  completion_tokens integer,
  estimated_cost_eur numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.ai_usage_records is 'Every AI enrichment call, for AI_MONTHLY_BUDGET_EUR enforcement. Cost is computed from actual reported token usage after the call, never a flat guess. See docs/scoring/ai-layer.md.';
create index ai_usage_records_occurred_at_idx on public.ai_usage_records (occurred_at);
create index ai_usage_records_workspace_id_idx on public.ai_usage_records (workspace_id);
create index ai_usage_records_trademark_match_id_idx on public.ai_usage_records (trademark_match_id);
create index ai_usage_records_ai_provider_id_idx on public.ai_usage_records (ai_provider_id);
create index ai_usage_records_ai_model_config_id_idx on public.ai_usage_records (ai_model_config_id);

create table public.ai_budget_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global' check (scope in ('global', 'workspace')),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  monthly_budget_eur numeric(10, 2) not null default 5,
  effective_from date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_budget_limits_workspace_scope_check check (
    (scope = 'global' and workspace_id is null) or (scope = 'workspace' and workspace_id is not null)
  )
);
comment on table public.ai_budget_limits is 'AI_MONTHLY_BUDGET_EUR and any per-workspace override. Budget exhaustion is an operational event (ai_budget_exhausted notification), never a silent no-op.';
create index ai_budget_limits_workspace_id_idx on public.ai_budget_limits (workspace_id);

create trigger set_updated_at before update on public.ai_budget_limits
  for each row execute function private.set_updated_at();

create table public.ai_response_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  request_hash text not null,
  response jsonb not null,
  provider text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
comment on table public.ai_response_cache is 'Optional cache of AI enrichment responses keyed by request hash, to avoid redundant spend on identical (watched, candidate) pairs.';
create index ai_response_cache_expires_at_idx on public.ai_response_cache (expires_at);

-- ---------------------------------------------------------------------
-- Row Level Security (global config/audit, not workspace-scoped)
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'ai_providers',
    'ai_model_configs',
    'ai_usage_records',
    'ai_budget_limits',
    'ai_response_cache'
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
