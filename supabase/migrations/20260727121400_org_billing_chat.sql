-- Org profile, roles (jurist), 5-plan catalog extensions, notification
-- recipients, billing invoices, and merkrechten chat.

-- ---------------------------------------------------------------------
-- Enum extensions
-- ---------------------------------------------------------------------

alter type public.workspace_role add value if not exists 'jurist';

alter type public.feature_flag add value if not exists 'merkrechten_chat';

alter type public.subscription_status add value if not exists 'pending_downgrade';

alter type public.subscription_plan_code add value if not exists 'basis';
alter type public.subscription_plan_code add value if not exists 'plus';
alter type public.subscription_plan_code add value if not exists 'enterprise';

create type public.support_tier as enum ('basis', 'standaard', 'prioriteit', 'dedicated');

create type public.invoice_status as enum ('draft', 'open', 'paid', 'void', 'uncollectible');

create type public.support_participant_type as enum (
  'customer_user',
  'platform_operator',
  'external_firm'
);

create type public.digest_frequency as enum ('DAILY', 'WEEKLY', 'IMMEDIATE');

-- ---------------------------------------------------------------------
-- Organization profile
-- ---------------------------------------------------------------------

create table public.organization_profiles (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  legal_name text not null default '',
  address_line text not null default '',
  postal_code text not null default '',
  city text not null default '',
  country text not null default 'NL',
  kvk_number text,
  billing_email text,
  phone text,
  parsed_address_json jsonb,
  address_lat double precision,
  address_lng double precision,
  locale text not null default 'nl-NL',
  timezone text not null default 'Europe/Amsterdam',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on public.organization_profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Member profiles (display info layered on workspace_members)
-- ---------------------------------------------------------------------

alter table public.workspace_members
  add column if not exists display_name text,
  add column if not exists job_title text,
  add column if not exists phone text,
  add column if not exists email text;

-- ---------------------------------------------------------------------
-- Plan catalog extras
-- ---------------------------------------------------------------------

alter table public.subscription_plans
  add column if not exists max_notification_emails integer not null default 5,
  add column if not exists support_tier public.support_tier not null default 'standaard',
  add column if not exists is_active boolean not null default true;

alter table public.workspace_subscriptions
  add column if not exists pending_plan_id uuid references public.subscription_plans (id),
  add column if not exists current_period_end timestamptz,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

-- ---------------------------------------------------------------------
-- Notification recipients (multi-email)
-- ---------------------------------------------------------------------

create table public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  digest_frequency public.digest_frequency not null default 'DAILY',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, email)
);

create index notification_recipients_workspace_id_idx
  on public.notification_recipients (workspace_id);

create trigger set_updated_at before update on public.notification_recipients
  for each row execute function private.set_updated_at();

create table public.notification_recipient_watches (
  recipient_id uuid not null references public.notification_recipients (id) on delete cascade,
  watched_trademark_id uuid not null references public.watched_trademarks (id) on delete cascade,
  enabled boolean not null default true,
  primary key (recipient_id, watched_trademark_id)
);

-- ---------------------------------------------------------------------
-- Invoices / billing events (Stripe-ready)
-- ---------------------------------------------------------------------

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  number text not null,
  status public.invoice_status not null default 'open',
  currency text not null default 'eur',
  amount_cents integer not null,
  description text not null default '',
  period_start date,
  period_end date,
  pdf_url text,
  stripe_invoice_id text,
  hosted_invoice_url text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, number)
);

create index invoices_workspace_id_idx on public.invoices (workspace_id, created_at desc);

create trigger set_updated_at before update on public.invoices
  for each row execute function private.set_updated_at();

create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  workspace_id uuid references public.workspaces (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  provider text not null default 'mock',
  created_at timestamptz not null default now()
);

create index billing_events_organization_id_idx on public.billing_events (organization_id, created_at desc);

-- ---------------------------------------------------------------------
-- Merkrechten chat
-- ---------------------------------------------------------------------

create table public.support_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  subject text not null,
  trademark_match_id uuid references public.trademark_matches (id) on delete set null,
  status text not null default 'open',
  created_by_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index support_threads_workspace_id_idx on public.support_threads (workspace_id, updated_at desc);

create trigger set_updated_at before update on public.support_threads
  for each row execute function private.set_updated_at();

create table public.support_participants (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  participant_type public.support_participant_type not null,
  display_name text not null,
  user_id uuid,
  external_firm_id uuid,
  created_at timestamptz not null default now()
);

create index support_participants_thread_id_idx on public.support_participants (thread_id);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads (id) on delete cascade,
  participant_id uuid not null references public.support_participants (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index support_messages_thread_id_idx on public.support_messages (thread_id, created_at);

-- ---------------------------------------------------------------------
-- RLS (service_role + workspace member patterns)
-- ---------------------------------------------------------------------

alter table public.organization_profiles enable row level security;
create policy "service_role_all" on public.organization_profiles for all to service_role using (true) with check (true);

alter table public.notification_recipients enable row level security;
create policy "service_role_all" on public.notification_recipients for all to service_role using (true) with check (true);

alter table public.notification_recipient_watches enable row level security;
create policy "service_role_all" on public.notification_recipient_watches for all to service_role using (true) with check (true);

alter table public.invoices enable row level security;
create policy "service_role_all" on public.invoices for all to service_role using (true) with check (true);

alter table public.billing_events enable row level security;
create policy "service_role_all" on public.billing_events for all to service_role using (true) with check (true);

alter table public.support_threads enable row level security;
create policy "service_role_all" on public.support_threads for all to service_role using (true) with check (true);

alter table public.support_participants enable row level security;
create policy "service_role_all" on public.support_participants for all to service_role using (true) with check (true);

alter table public.support_messages enable row level security;
create policy "service_role_all" on public.support_messages for all to service_role using (true) with check (true);
