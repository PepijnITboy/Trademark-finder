-- Core tenancy: organizations, workspaces, workspace membership, and the
-- platform-operator identity table, plus the RLS helper functions every
-- later migration relies on.
--
-- Merkwacht's tenant hierarchy is organization -> workspace -> members.
-- `organizations` is the billing boundary (one row per customer company);
-- a customer can in principle operate more than one `workspace` under the
-- same organization (e.g. separate brands/departments), though the
-- product only exposes a single default workspace at launch. Almost all
-- customer data hangs off `workspace_id`, not `organization_id` directly,
-- per the "workspace_id on workspace-bound tables" convention used
-- throughout this schema.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.organizations is 'Billing/tenant root. Every workspace belongs to exactly one organization.';

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.workspaces is 'Operating unit that almost all customer-scoped data (watched_trademarks, matches, notifications, billing, ...) hangs off via workspace_id.';
create index workspaces_organization_id_idx on public.workspaces (organization_id);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.workspace_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);
comment on table public.workspace_members is 'Links a Supabase Auth user to a workspace with a role (owner/admin/member).';
create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- Platform operators are Merkwacht's own internal team, identified
-- independently of any customer workspace membership. This is deliberately
-- a separate table (rather than a `platform_operator` workspace_role, as
-- in an earlier schema draft) so platform access is never accidentally
-- tied to - or confused with - a specific customer's data.
create table public.platform_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.platform_users is 'Merkwacht internal team members with access to /platform. Not tied to any customer organization or workspace.';

-- ---------------------------------------------------------------------
-- Shared trigger: keep updated_at current on row modification.
-- ---------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.workspaces
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.platform_users
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- RLS helper functions
--
-- Declared `security definer` so they can read workspace_members /
-- platform_users on behalf of the calling role without those reads
-- themselves being re-filtered by the RLS policies defined below (which
-- would otherwise be recursive on workspace_members' own policies).
-- ---------------------------------------------------------------------

create function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;
comment on function private.is_workspace_member(uuid) is 'True if the current auth.uid() is a member (any role) of the given workspace.';

create function private.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;
comment on function private.is_workspace_admin(uuid) is 'True if the current auth.uid() is an owner/admin of the given workspace.';

create function private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where w.organization_id = target_organization_id
      and wm.user_id = auth.uid()
  );
$$;
comment on function private.is_org_member(uuid) is 'True if the current auth.uid() belongs to any workspace under the given organization.';

create function private.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_users pu
    where pu.user_id = auth.uid()
      and pu.is_active
  );
$$;
comment on function private.is_platform_operator() is 'True if the current auth.uid() is an active Merkwacht platform operator.';

grant execute on function private.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function private.is_workspace_admin(uuid) to authenticated, service_role;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;
grant execute on function private.is_platform_operator() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Row Level Security
--
-- Stub policy shape used throughout this schema: `service_role` always
-- has an explicit permissive policy (in addition to its Supabase-managed
-- BYPASSRLS attribute, for clarity/documentation), and `authenticated`
-- gets a single `for all` placeholder policy keyed on workspace
-- membership (or platform-operator status for global/platform tables).
-- Finer-grained per-command/per-role policies (e.g. only owners may
-- delete) are a follow-up once real product requirements settle.
-- ---------------------------------------------------------------------

alter table public.organizations enable row level security;

create policy "service_role_all" on public.organizations
  for all to service_role using (true) with check (true);

create policy "org_members_all" on public.organizations
  for all to authenticated
  using (private.is_org_member(id))
  with check (private.is_org_member(id));

alter table public.workspaces enable row level security;

create policy "service_role_all" on public.workspaces
  for all to service_role using (true) with check (true);

create policy "workspace_members_all" on public.workspaces
  for all to authenticated
  using (private.is_workspace_member(id))
  with check (private.is_workspace_member(id));

alter table public.workspace_members enable row level security;

create policy "service_role_all" on public.workspace_members
  for all to service_role using (true) with check (true);

create policy "workspace_members_all" on public.workspace_members
  for all to authenticated
  using (private.is_workspace_member(workspace_id))
  with check (private.is_workspace_member(workspace_id));

alter table public.platform_users enable row level security;

create policy "service_role_all" on public.platform_users
  for all to service_role using (true) with check (true);

create policy "platform_operators_all" on public.platform_users
  for all to authenticated
  using (private.is_platform_operator())
  with check (private.is_platform_operator());
