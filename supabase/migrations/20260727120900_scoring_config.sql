-- Versioned scoring configuration: model versions, weight profiles,
-- triage threshold profiles, and the phonetic/normalization rule
-- versions that feed the scoring pipeline. See docs/scoring/overview.md,
-- docs/scoring/weights.md, docs/scoring/phonetics.md, and
-- docs/scoring/normalization.md.
--
-- Global reference/config data, not workspace-scoped. Weight profiles
-- are readable by any authenticated user (the UI shows which profile
-- produced a match's score) but only writable by platform operators,
-- since changing weights is a deliberate, auditable product decision -
-- never mutate an existing profile in place, always add a new one.

create table public.scoring_model_versions (
  id uuid primary key default gen_random_uuid(),
  version_id text not null unique,
  description text,
  released_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.scoring_model_versions is 'Top-level scoring pipeline version identifier, grouping a weight profile + threshold profile + rule versions released together.';

create table public.scoring_weight_profiles (
  id uuid primary key default gen_random_uuid(),
  scoring_model_version_id uuid references public.scoring_model_versions (id),
  profile_id text not null unique,
  textual_similarity numeric(5, 2) not null,
  phonetic_similarity numeric(5, 2) not null,
  visual_similarity numeric(5, 2) not null,
  semantic_similarity numeric(5, 2) not null,
  nice_class_overlap numeric(5, 2) not null,
  goods_services_overlap numeric(5, 2) not null,
  geographic_overlap numeric(5, 2) not null,
  ai_plausibility_adjustment numeric(5, 2) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scoring_weight_profiles_sum_100_check check (
    textual_similarity + phonetic_similarity + visual_similarity + semantic_similarity
      + nice_class_overlap + goods_services_overlap + geographic_overlap + ai_plausibility_adjustment
    = 100
  )
);
comment on table public.scoring_weight_profiles is 'ScoringWeightProfile: weights (summing to 100) combining TrademarkMatchScores components into total_score. Immutable once shipped - see docs/scoring/weights.md. Default v1: 25/22/13/8/17/8/4/3.';
create unique index scoring_weight_profiles_single_default_idx on public.scoring_weight_profiles (is_default) where is_default;
create index scoring_weight_profiles_model_version_id_idx on public.scoring_weight_profiles (scoring_model_version_id);

create trigger set_updated_at before update on public.scoring_weight_profiles
  for each row execute function private.set_updated_at();

alter table public.trademark_matches
  add constraint trademark_matches_weight_profile_id_fkey
  foreign key (weight_profile_id) references public.scoring_weight_profiles (profile_id);

create table public.scoring_threshold_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null unique,
  high_confidence_min numeric(5, 2) not null default 80,
  moderate_min numeric(5, 2) not null default 50,
  low_min numeric(5, 2) not null default 25,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.scoring_threshold_profiles is 'Product/UX triage bands layered on top of total_score (high/moderate/low), per docs/scoring/weights.md. Not part of the scoring algorithm itself.';

create trigger set_updated_at before update on public.scoring_threshold_profiles
  for each row execute function private.set_updated_at();

create table public.phonetic_rule_versions (
  id uuid primary key default gen_random_uuid(),
  version_id text not null unique,
  algorithm text not null,
  description text,
  released_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.phonetic_rule_versions is 'Versioned phonetic representation algorithm used by generatePhoneticRepresentations(), see docs/scoring/phonetics.md.';

create table public.normalization_rule_versions (
  id uuid primary key default gen_random_uuid(),
  version_id text not null unique,
  description text,
  released_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
comment on table public.normalization_rule_versions is 'Versioned mark-name normalization rules used by normalizeMarkName(), see docs/scoring/normalization.md.';

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'scoring_model_versions',
    'scoring_weight_profiles',
    'scoring_threshold_profiles',
    'phonetic_rule_versions',
    'normalization_rule_versions'
  ])
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format(
      'create policy "service_role_all" on public.%I for all to service_role using (true) with check (true);',
      t
    );
    execute format(
      'create policy "authenticated_read" on public.%I for select to authenticated using (true);',
      t
    );
    execute format(
      'create policy "platform_operators_write" on public.%I for all to authenticated using (private.is_platform_operator()) with check (private.is_platform_operator());',
      t
    );
  end loop;
end;
$$;
