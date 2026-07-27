-- Customer exports (PDF/CSV dossiers, see packages/exports) and the
-- system-wide audit log.

create table public.exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  requested_by uuid references auth.users (id),
  export_type public.export_type not null,
  scope jsonb not null default '{}'::jsonb,
  status public.export_status not null default 'pending',
  file_ref text,
  generated_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.exports is 'A requested PDF/CSV export (e.g. a match dossier). Every export must carry LEGAL_DISCLAIMER_NL per docs/product/legal-language.md - enforced in @merkwacht/exports, not at the database layer.';
create index exports_workspace_id_idx on public.exports (workspace_id, created_at desc);
create index exports_requested_by_idx on public.exports (requested_by);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete set null,
  actor_user_id uuid references auth.users (id),
  actor_type public.actor_type not null default 'user',
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.audit_logs is 'System-wide audit trail of sensitive actions (role changes, credential rotation, raw payload access, etc.). workspace_id is null for platform-level actions.';
create index audit_logs_workspace_id_idx on public.audit_logs (workspace_id, occurred_at desc);
create index audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.exports enable row level security;
create policy "service_role_all" on public.exports for all to service_role using (true) with check (true);
create policy "workspace_members_all" on public.exports for all to authenticated
  using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));

alter table public.audit_logs enable row level security;
create policy "service_role_all" on public.audit_logs for all to service_role using (true) with check (true);
create policy "platform_operators_all" on public.audit_logs for all to authenticated
  using (private.is_platform_operator()) with check (private.is_platform_operator());
