-- Opposition deadlines: register-specific rule sets and the calculated
-- filing windows they produce per candidate_application, plus the event
-- log driving reminder notifications. See
-- docs/domain/opposition-workflow.md.
--
-- Not workspace-scoped: an opposition deadline belongs to the
-- (register-wide) candidate_application, not to any one customer's
-- watch of it. Customer-facing reminders are delivered through the
-- workspace-scoped `notifications` table (see the next migration).

create table public.opposition_rule_sets (
  id uuid primary key default gen_random_uuid(),
  register_source_id uuid not null references public.register_sources (id) on delete cascade,
  kind public.opposition_rule_kind not null,
  days integer,
  months integer,
  starts_from public.opposition_starts_from not null,
  effective_from date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opposition_rule_sets_kind_value_check check (
    (kind = 'calendar_days' and days is not null and months is null)
    or (kind = 'months' and months is not null and days is null)
  )
);
comment on table public.opposition_rule_sets is 'OppositionRuleSet per register (e.g. BOIP: 2 months from publication_date). See docs/connectors/boip.md and @merkwacht/opposition-rules.';
create index opposition_rule_sets_register_source_id_idx on public.opposition_rule_sets (register_source_id, effective_from desc);

create trigger set_updated_at before update on public.opposition_rule_sets
  for each row execute function private.set_updated_at();

create table public.opposition_deadlines (
  id uuid primary key default gen_random_uuid(),
  candidate_application_id uuid not null unique references public.candidate_applications (id) on delete cascade,
  opposition_rule_set_id uuid not null references public.opposition_rule_sets (id),
  start_date date not null,
  deadline_date date not null,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.opposition_deadlines is 'Calculated OppositionDeadline for a candidate_application, computed by calculateOppositionDeadline() in @merkwacht/opposition-rules. One per candidate_application.';
create index opposition_deadlines_deadline_date_idx on public.opposition_deadlines (deadline_date);
create index opposition_deadlines_opposition_rule_set_id_idx on public.opposition_deadlines (opposition_rule_set_id);

create trigger set_updated_at before update on public.opposition_deadlines
  for each row execute function private.set_updated_at();

alter table public.trademark_matches
  add constraint trademark_matches_opposition_deadline_id_fkey
  foreign key (opposition_deadline_id) references public.opposition_deadlines (id) on delete set null;
create index trademark_matches_opposition_deadline_id_idx on public.trademark_matches (opposition_deadline_id);

create table public.deadline_events (
  id uuid primary key default gen_random_uuid(),
  opposition_deadline_id uuid not null references public.opposition_deadlines (id) on delete cascade,
  trademark_match_id uuid references public.trademark_matches (id) on delete set null,
  event_type public.deadline_event_type not null,
  occurred_at timestamptz not null default now(),
  -- Soft reference (no FK) to public.notifications, created in a later
  -- migration - avoids a forward dependency between these two files.
  notification_id uuid,
  created_at timestamptz not null default now()
);
comment on table public.deadline_events is 'Internal event log (reminder_30d/14d/7d/2d, deadline_passed) driving the send_notifications job''s reminder cadence. See docs/domain/opposition-workflow.md.';
create index deadline_events_opposition_deadline_id_idx on public.deadline_events (opposition_deadline_id, occurred_at desc);
create index deadline_events_trademark_match_id_idx on public.deadline_events (trademark_match_id);

-- ---------------------------------------------------------------------
-- Row Level Security (register-wide, not workspace-scoped)
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'opposition_rule_sets',
    'opposition_deadlines',
    'deadline_events'
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
