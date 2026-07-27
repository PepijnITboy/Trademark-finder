-- Customer-facing notifications and per-workspace/user delivery
-- preferences. See docs/domain/notifications (packages/domain/src/notifications.ts)
-- and docs/domain/opposition-workflow.md for the reminder cadence.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  watched_trademark_id uuid references public.watched_trademarks (id) on delete set null,
  trademark_match_id uuid references public.trademark_matches (id) on delete set null,
  type public.notification_type not null,
  channel public.notification_channel not null,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.notifications is 'A single NotificationPayload delivery on one channel. send_notifications checks sent_at plus (workspace_id, watched_trademark_id, type, payload key) before creating a duplicate.';
create index notifications_workspace_id_idx on public.notifications (workspace_id, created_at desc);
create index notifications_watched_trademark_id_idx on public.notifications (watched_trademark_id);
create index notifications_trademark_match_id_idx on public.notifications (trademark_match_id);
create index notifications_sent_at_idx on public.notifications (sent_at);

alter table public.deadline_events
  add constraint deadline_events_notification_id_fkey
  foreign key (notification_id) references public.notifications (id) on delete set null;
create index deadline_events_notification_id_idx on public.deadline_events (notification_id);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  channel public.notification_channel not null,
  notification_type public.notification_type,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, user_id, channel, notification_type)
);
comment on table public.notification_preferences is 'Per-workspace (and optionally per-user) opt-in/out of a notification channel/type. notification_type null means "all types" on that channel.';
create index notification_preferences_workspace_id_idx on public.notification_preferences (workspace_id);
create index notification_preferences_user_id_idx on public.notification_preferences (user_id);

create trigger set_updated_at before update on public.notification_preferences
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security (workspace-scoped)
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'notifications',
    'notification_preferences'
  ])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "service_role_all" on public.%I for all to service_role using (true) with check (true);',
      t
    );
    execute format(
      'create policy "workspace_members_all" on public.%I for all to authenticated using (private.is_workspace_member(workspace_id)) with check (private.is_workspace_member(workspace_id));',
      t
    );
  end loop;
end;
$$;
