-- Watched trademarks: marks a customer workspace has asked Merkwacht to
-- monitor. See docs/domain/trademark-model.md.
--
-- These are the "our own mark" side of the domain model, as opposed to
-- candidate_applications (register-wide, see the next migration). Every
-- table here carries workspace_id directly (denormalized from
-- watched_trademarks) so RLS policies never need a join.

create table public.watched_trademarks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  label text not null,
  status public.watched_trademark_status not null default 'active',
  register_source_id uuid not null references public.register_sources (id),
  registration_number text not null,
  -- Backfilled by an alter below once watched_trademark_snapshots exists.
  current_snapshot_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, register_source_id, registration_number)
);
comment on table public.watched_trademarks is 'WATCHED side of the domain model: a mark a customer workspace monitors. Produces trademark_matches only while its latest watch_eligibility_decision is eligible.';
create index watched_trademarks_workspace_id_idx on public.watched_trademarks (workspace_id);
create index watched_trademarks_register_source_id_idx on public.watched_trademarks (register_source_id);
create index watched_trademarks_status_idx on public.watched_trademarks (status);

create trigger set_updated_at before update on public.watched_trademarks
  for each row execute function private.set_updated_at();

create table public.watched_trademark_snapshots (
  id uuid primary key default gen_random_uuid(),
  watched_trademark_id uuid not null references public.watched_trademarks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  register_source_id uuid not null references public.register_sources (id),
  registration_number text not null,
  mark_text text not null,
  mark_type public.mark_type not null,
  applicant_name text,
  filing_date date,
  registration_date date,
  register_status public.register_trademark_status not null default 'unknown',
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.watched_trademark_snapshots is 'Append-only history of RegisteredTrademarkSnapshot for a watched_trademark, refreshed by the refresh_watched_snapshot job. watched_trademarks.current_snapshot_id points at the latest row.';
create index watched_trademark_snapshots_watched_trademark_id_idx on public.watched_trademark_snapshots (watched_trademark_id, created_at desc);
create index watched_trademark_snapshots_workspace_id_idx on public.watched_trademark_snapshots (workspace_id);
create index watched_trademark_snapshots_register_source_id_idx on public.watched_trademark_snapshots (register_source_id);

alter table public.watched_trademarks
  add constraint watched_trademarks_current_snapshot_id_fkey
  foreign key (current_snapshot_id) references public.watched_trademark_snapshots (id) on delete set null;
create index watched_trademarks_current_snapshot_id_idx on public.watched_trademarks (current_snapshot_id);

create table public.watched_trademark_classes (
  id uuid primary key default gen_random_uuid(),
  watched_trademark_snapshot_id uuid not null references public.watched_trademark_snapshots (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  nice_class smallint not null check (nice_class between 1 and 45),
  created_at timestamptz not null default now(),
  unique (watched_trademark_snapshot_id, nice_class)
);
comment on table public.watched_trademark_classes is 'Nice classification classes covered by a watched_trademark_snapshot (normalized form of RegisteredTrademarkSnapshot.niceClasses).';
create index watched_trademark_classes_snapshot_id_idx on public.watched_trademark_classes (watched_trademark_snapshot_id);
create index watched_trademark_classes_workspace_id_idx on public.watched_trademark_classes (workspace_id);
create index watched_trademark_classes_nice_class_idx on public.watched_trademark_classes (nice_class);

create table public.watched_trademark_goods_services (
  id uuid primary key default gen_random_uuid(),
  watched_trademark_snapshot_id uuid not null references public.watched_trademark_snapshots (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  nice_class smallint not null check (nice_class between 1 and 45),
  description text not null,
  created_at timestamptz not null default now()
);
comment on table public.watched_trademark_goods_services is 'Goods/services text per Nice class for a watched_trademark_snapshot, used by the goodsServicesOverlap scoring component.';
create index watched_trademark_goods_services_snapshot_id_idx on public.watched_trademark_goods_services (watched_trademark_snapshot_id);
create index watched_trademark_goods_services_workspace_id_idx on public.watched_trademark_goods_services (workspace_id);

create table public.watch_eligibility_decisions (
  id uuid primary key default gen_random_uuid(),
  watched_trademark_id uuid not null references public.watched_trademarks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  eligible boolean not null,
  reasons text[] not null default '{}',
  policy_id text not null,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.watch_eligibility_decisions is 'Append-only history of WatchEligibilityDecision evaluations. The most recent row (by evaluated_at) per watched_trademark_id is the current decision.';
create index watch_eligibility_decisions_watched_trademark_id_idx on public.watch_eligibility_decisions (watched_trademark_id, evaluated_at desc);
create index watch_eligibility_decisions_workspace_id_idx on public.watch_eligibility_decisions (workspace_id);

create table public.watch_settings (
  id uuid primary key default gen_random_uuid(),
  watched_trademark_id uuid not null unique references public.watched_trademarks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  notify_email boolean not null default true,
  notify_in_app boolean not null default true,
  min_score_threshold numeric(5, 2) not null default 25 check (min_score_threshold between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.watch_settings is 'Per-watch notification/triage preferences.';
create index watch_settings_workspace_id_idx on public.watch_settings (workspace_id);

create trigger set_updated_at before update on public.watch_settings
  for each row execute function private.set_updated_at();

create table public.watch_selected_classes (
  id uuid primary key default gen_random_uuid(),
  watched_trademark_id uuid not null references public.watched_trademarks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  nice_class smallint not null check (nice_class between 1 and 45),
  created_at timestamptz not null default now(),
  unique (watched_trademark_id, nice_class)
);
comment on table public.watch_selected_classes is 'Nice classes the customer has explicitly opted to monitor for conflicts, which may extend beyond the registration''s own classes.';
create index watch_selected_classes_workspace_id_idx on public.watch_selected_classes (workspace_id);

create table public.watch_related_class_suggestions (
  id uuid primary key default gen_random_uuid(),
  watched_trademark_id uuid not null references public.watched_trademarks (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  nice_class smallint not null check (nice_class between 1 and 45),
  reason text,
  accepted boolean,
  suggested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (watched_trademark_id, nice_class)
);
comment on table public.watch_related_class_suggestions is 'System-suggested Nice classes related to a watch, pending customer accept/reject (accepted is null while undecided).';
create index watch_related_class_suggestions_workspace_id_idx on public.watch_related_class_suggestions (workspace_id);

-- ---------------------------------------------------------------------
-- Row Level Security (workspace-scoped tables)
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'watched_trademarks',
    'watched_trademark_snapshots',
    'watched_trademark_classes',
    'watched_trademark_goods_services',
    'watch_eligibility_decisions',
    'watch_settings',
    'watch_selected_classes',
    'watch_related_class_suggestions'
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
