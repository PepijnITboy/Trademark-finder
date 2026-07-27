-- Trademark matches: the computed, customer-facing relationship between
-- one watched_trademark and one candidate_application. See
-- docs/domain/trademark-model.md and docs/scoring/overview.md.
--
-- Workspace-scoped (denormalized from the watched_trademark side) so
-- customers only ever see their own matches, even though
-- candidate_applications themselves are register-wide.

create table public.trademark_matches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  watched_trademark_id uuid not null references public.watched_trademarks (id) on delete cascade,
  candidate_application_id uuid not null references public.candidate_applications (id) on delete cascade,
  status public.match_workflow_status not null default 'new',
  total_score numeric(5, 2) not null default 0 check (total_score between 0 and 100),
  weight_profile_id text not null default 'v1',
  opposition_deadline_id uuid,
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watched_trademark_id, candidate_application_id)
);
comment on table public.trademark_matches is 'The computed, customer-facing relationship between a WATCHED trademark and a CANDIDATE application. Unique per (watched_trademark_id, candidate_application_id) - matching/scoring jobs must upsert, never insert blindly.';
create index trademark_matches_workspace_id_idx on public.trademark_matches (workspace_id);
create index trademark_matches_watched_trademark_id_idx on public.trademark_matches (watched_trademark_id);
create index trademark_matches_candidate_application_id_idx on public.trademark_matches (candidate_application_id);
create index trademark_matches_status_idx on public.trademark_matches (status);
create index trademark_matches_total_score_idx on public.trademark_matches (total_score desc);
create index trademark_matches_reviewed_by_idx on public.trademark_matches (reviewed_by);
create index trademark_matches_weight_profile_id_idx on public.trademark_matches (weight_profile_id);

create trigger set_updated_at before update on public.trademark_matches
  for each row execute function private.set_updated_at();

create table public.match_score_components (
  id uuid primary key default gen_random_uuid(),
  trademark_match_id uuid not null references public.trademark_matches (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  component public.score_component not null,
  raw_value numeric(6, 4) not null,
  weight numeric(5, 2) not null,
  weighted_value numeric(6, 2) not null,
  created_at timestamptz not null default now(),
  unique (trademark_match_id, component)
);
comment on table public.match_score_components is 'Per-component breakdown of TrademarkMatchScores (one row per score_component), persisted verbatim so the UI can render a full breakdown without recomputation. See docs/scoring/overview.md.';
create index match_score_components_trademark_match_id_idx on public.match_score_components (trademark_match_id);
create index match_score_components_workspace_id_idx on public.match_score_components (workspace_id);

create table public.match_score_explanations (
  id uuid primary key default gen_random_uuid(),
  trademark_match_id uuid not null references public.trademark_matches (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  component public.score_component not null,
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (trademark_match_id, component)
);
comment on table public.match_score_explanations is 'Human-readable explanation text per score component, shown alongside match_score_components in the UI.';
create index match_score_explanations_trademark_match_id_idx on public.match_score_explanations (trademark_match_id);
create index match_score_explanations_workspace_id_idx on public.match_score_explanations (workspace_id);

create table public.match_ai_assessments (
  id uuid primary key default gen_random_uuid(),
  trademark_match_id uuid not null references public.trademark_matches (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null,
  adjustment numeric(4, 3) not null check (adjustment between -1 and 1),
  rationale text,
  created_at timestamptz not null default now()
);
comment on table public.match_ai_assessments is 'Audit record of AiEnrichmentPort.adjust() output for a match (the aiPlausibilityAdjustment score component''s provenance). See docs/scoring/ai-layer.md.';
create index match_ai_assessments_trademark_match_id_idx on public.match_ai_assessments (trademark_match_id);
create index match_ai_assessments_workspace_id_idx on public.match_ai_assessments (workspace_id);

create table public.match_status_history (
  id uuid primary key default gen_random_uuid(),
  trademark_match_id uuid not null references public.trademark_matches (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  from_status public.match_workflow_status,
  to_status public.match_workflow_status not null,
  changed_by uuid references auth.users (id),
  note text,
  changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
comment on table public.match_status_history is 'Append-only audit trail of every match_workflow_status transition, per docs/domain/opposition-workflow.md.';
create index match_status_history_trademark_match_id_idx on public.match_status_history (trademark_match_id, changed_at desc);
create index match_status_history_workspace_id_idx on public.match_status_history (workspace_id);
create index match_status_history_changed_by_idx on public.match_status_history (changed_by);

create table public.match_review_actions (
  id uuid primary key default gen_random_uuid(),
  trademark_match_id uuid not null references public.trademark_matches (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_user_id uuid references auth.users (id),
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);
comment on table public.match_review_actions is 'Free-form log of reviewer actions on a match (opened, flagged, exported, etc.), distinct from formal status transitions in match_status_history.';
create index match_review_actions_trademark_match_id_idx on public.match_review_actions (trademark_match_id, created_at desc);
create index match_review_actions_workspace_id_idx on public.match_review_actions (workspace_id);
create index match_review_actions_actor_user_id_idx on public.match_review_actions (actor_user_id);

create table public.match_notes (
  id uuid primary key default gen_random_uuid(),
  trademark_match_id uuid not null references public.trademark_matches (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_user_id uuid references auth.users (id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.match_notes is 'Free-form customer/operator notes attached to a match. Must never contain AI-generated text that bypasses the legal-language rules in docs/product/legal-language.md.';
create index match_notes_trademark_match_id_idx on public.match_notes (trademark_match_id, created_at desc);
create index match_notes_workspace_id_idx on public.match_notes (workspace_id);
create index match_notes_author_user_id_idx on public.match_notes (author_user_id);

create trigger set_updated_at before update on public.match_notes
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security (workspace-scoped tables)
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'trademark_matches',
    'match_score_components',
    'match_score_explanations',
    'match_ai_assessments',
    'match_status_history',
    'match_review_actions',
    'match_notes'
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
