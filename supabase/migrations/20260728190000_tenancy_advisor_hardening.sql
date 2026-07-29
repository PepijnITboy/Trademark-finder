-- Harden private RLS helpers + add missing FK indexes (advisor remediation).
--
-- 1) Lock search_path on private.set_updated_at (Function Search Path Mutable).
-- 2) Reaffirm search_path on membership helpers (defense in depth).
-- 3) Cover unindexed foreign keys flagged by performance advisors.

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function private.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.role in ('owner', 'admin')
  );
$$;

create or replace function private.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    join public.workspaces w on w.id = wm.workspace_id
    where w.organization_id = target_organization_id
      and wm.user_id = auth.uid()
  );
$$;

create or replace function private.is_platform_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_users pu
    where pu.user_id = auth.uid()
      and pu.is_active
  );
$$;

create index if not exists billing_events_workspace_id_idx
  on public.billing_events (workspace_id);

create index if not exists notification_recipient_watches_watched_trademark_id_idx
  on public.notification_recipient_watches (watched_trademark_id);

create index if not exists support_messages_participant_id_idx
  on public.support_messages (participant_id);

create index if not exists support_threads_organization_id_idx
  on public.support_threads (organization_id);

create index if not exists support_threads_trademark_match_id_idx
  on public.support_threads (trademark_match_id);

create index if not exists workspace_subscriptions_pending_plan_id_idx
  on public.workspace_subscriptions (pending_plan_id);
