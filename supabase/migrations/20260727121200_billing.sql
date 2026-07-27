-- Subscription plans, per-workspace subscriptions, usage metering, and
-- resolved feature entitlements. See packages/domain/src/subscriptions.ts.

create table public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  code public.subscription_plan_code not null unique,
  name text not null,
  price_eur_cents integer not null default 0,
  max_watched_trademarks integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.subscription_plans is 'Billing plan catalog (starter/pro/agency). Public reference data - readable by any authenticated user for pricing display.';

create trigger set_updated_at before update on public.subscription_plans
  for each row execute function private.set_updated_at();

create table public.subscription_plan_features (
  id uuid primary key default gen_random_uuid(),
  subscription_plan_id uuid not null references public.subscription_plans (id) on delete cascade,
  feature_flag public.feature_flag not null,
  enabled boolean not null default true,
  limit_value integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_plan_id, feature_flag)
);
comment on table public.subscription_plan_features is 'Default feature_flag entitlements bundled with a subscription_plans row, before any per-workspace overrides.';

create trigger set_updated_at before update on public.subscription_plan_features
  for each row execute function private.set_updated_at();

create table public.workspace_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces (id) on delete cascade,
  subscription_plan_id uuid not null references public.subscription_plans (id),
  status public.subscription_status not null default 'trialing',
  renews_at timestamptz,
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.workspace_subscriptions is 'A workspace''s active subscription to a plan.';
create index workspace_subscriptions_plan_id_idx on public.workspace_subscriptions (subscription_plan_id);

create trigger set_updated_at before update on public.workspace_subscriptions
  for each row execute function private.set_updated_at();

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  metric text not null,
  value numeric not null default 0,
  period_start date not null,
  period_end date not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.usage_records is 'Metered usage per workspace/period (e.g. watched_trademarks_count, ai_calls), used to enforce plan limits and for billing reconciliation.';
create index usage_records_workspace_id_idx on public.usage_records (workspace_id, period_start desc);
create index usage_records_metric_idx on public.usage_records (metric);

create table public.workspace_feature_overrides (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  feature_flag public.feature_flag not null,
  enabled boolean,
  limit_value integer,
  reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, feature_flag)
);
comment on table public.workspace_feature_overrides is 'Manual per-workspace feature overrides layered on top of subscription_plan_features (e.g. a support-granted trial of ai_enrichment). Combined with the plan defaults to produce feature_entitlements.';
create index workspace_feature_overrides_created_by_idx on public.workspace_feature_overrides (created_by);

create trigger set_updated_at before update on public.workspace_feature_overrides
  for each row execute function private.set_updated_at();

create table public.feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  feature_flag public.feature_flag not null,
  enabled boolean not null default false,
  limit_value integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, feature_flag)
);
comment on table public.feature_entitlements is 'Resolved, effective per-workspace feature_flag entitlements (subscription_plan_features + workspace_feature_overrides). What application code should actually check - see SubscriptionEntitlements in packages/domain.';
create index feature_entitlements_workspace_id_idx on public.feature_entitlements (workspace_id);

create trigger set_updated_at before update on public.feature_entitlements
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.subscription_plans enable row level security;
create policy "service_role_all" on public.subscription_plans for all to service_role using (true) with check (true);
create policy "authenticated_read" on public.subscription_plans for select to authenticated using (true);
create policy "platform_operators_write" on public.subscription_plans for all to authenticated
  using (private.is_platform_operator()) with check (private.is_platform_operator());

alter table public.subscription_plan_features enable row level security;
create policy "service_role_all" on public.subscription_plan_features for all to service_role using (true) with check (true);
create policy "authenticated_read" on public.subscription_plan_features for select to authenticated using (true);
create policy "platform_operators_write" on public.subscription_plan_features for all to authenticated
  using (private.is_platform_operator()) with check (private.is_platform_operator());

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'workspace_subscriptions',
    'usage_records',
    'workspace_feature_overrides',
    'feature_entitlements'
  ])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "service_role_all" on public.%I for all to service_role using (true) with check (true);',
      t
    );
    execute format(
      'create policy "workspace_members_read" on public.%I for select to authenticated using (private.is_workspace_member(workspace_id));',
      t
    );
    execute format(
      'create policy "workspace_admins_write" on public.%I for all to authenticated using (private.is_workspace_admin(workspace_id)) with check (private.is_workspace_admin(workspace_id));',
      t
    );
  end loop;
end;
$$;
