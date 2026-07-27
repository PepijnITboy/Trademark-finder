-- Candidate applications: the CANDIDATE side of the domain model - every
-- application published by a register, independent of any customer
-- workspace, fetched once and matched against every relevant
-- watched_trademark. See docs/domain/trademark-model.md.
--
-- Not workspace-scoped: shared register-wide data, readable only by
-- service_role/platform_operator directly (customers only ever see
-- candidate data indirectly through their own trademark_matches, per
-- docs/security/security-model.md).

create table public.candidate_applications (
  id uuid primary key default gen_random_uuid(),
  register_source_id uuid not null references public.register_sources (id),
  application_number text not null,
  mark_text text not null,
  mark_type public.mark_type not null,
  applicant_name text,
  filing_date date,
  publication_date date,
  procedural_status public.procedural_status not null default 'filed',
  raw_source_record_id uuid references public.raw_source_records (id) on delete set null,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (register_source_id, application_number)
);
comment on table public.candidate_applications is 'CANDIDATE side of the domain model: a single application as published by a register, shared across all workspaces. One row per (register_source_id, application_number).';
create index candidate_applications_register_source_id_idx on public.candidate_applications (register_source_id);
create index candidate_applications_procedural_status_idx on public.candidate_applications (procedural_status);
create index candidate_applications_publication_date_idx on public.candidate_applications (publication_date);
create index candidate_applications_raw_source_record_id_idx on public.candidate_applications (raw_source_record_id);

create trigger set_updated_at before update on public.candidate_applications
  for each row execute function private.set_updated_at();

create table public.candidate_application_snapshots (
  id uuid primary key default gen_random_uuid(),
  candidate_application_id uuid not null references public.candidate_applications (id) on delete cascade,
  procedural_status public.procedural_status not null,
  mark_text text,
  applicant_name text,
  snapshot jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.candidate_application_snapshots is 'Append-only history of observed changes to a candidate_application (e.g. procedural status transitions, applicant amendments).';
create index candidate_application_snapshots_candidate_id_idx on public.candidate_application_snapshots (candidate_application_id, observed_at desc);

create table public.candidate_application_classes (
  id uuid primary key default gen_random_uuid(),
  candidate_application_id uuid not null references public.candidate_applications (id) on delete cascade,
  nice_class smallint not null check (nice_class between 1 and 45),
  created_at timestamptz not null default now(),
  unique (candidate_application_id, nice_class)
);
comment on table public.candidate_application_classes is 'Nice classification classes claimed by a candidate_application (normalized form of CandidateApplication.niceClasses).';
create index candidate_application_classes_candidate_id_idx on public.candidate_application_classes (candidate_application_id);
create index candidate_application_classes_nice_class_idx on public.candidate_application_classes (nice_class);

create table public.candidate_application_goods_services (
  id uuid primary key default gen_random_uuid(),
  candidate_application_id uuid not null references public.candidate_applications (id) on delete cascade,
  nice_class smallint not null check (nice_class between 1 and 45),
  description text not null,
  created_at timestamptz not null default now()
);
comment on table public.candidate_application_goods_services is 'Goods/services text per Nice class for a candidate_application, used by the goodsServicesOverlap scoring component.';
create index candidate_application_goods_services_candidate_id_idx on public.candidate_application_goods_services (candidate_application_id);

create table public.candidate_status_history (
  id uuid primary key default gen_random_uuid(),
  candidate_application_id uuid not null references public.candidate_applications (id) on delete cascade,
  status public.procedural_status not null,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.candidate_status_history is 'Append-only log of every observed procedural_status for a candidate_application (ProceduralStatusResult history).';
create index candidate_status_history_candidate_id_idx on public.candidate_status_history (candidate_application_id, observed_at desc);

create table public.candidate_procedural_statuses (
  id uuid primary key default gen_random_uuid(),
  candidate_application_id uuid not null unique references public.candidate_applications (id) on delete cascade,
  status public.procedural_status not null,
  observed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.candidate_procedural_statuses is 'Current ProceduralStatusResult pointer for a candidate_application (1:1) - the latest entry of candidate_status_history, kept denormalized for fast joins.';

create trigger set_updated_at before update on public.candidate_procedural_statuses
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security (register-wide, not workspace-scoped)
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'candidate_applications',
    'candidate_application_snapshots',
    'candidate_application_classes',
    'candidate_application_goods_services',
    'candidate_status_history',
    'candidate_procedural_statuses'
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
