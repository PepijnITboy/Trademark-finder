-- Shadow comparison / feature snapshots + human labels (engine mega-update).
-- Non-breaking: nullable columns and new tables; legacy total_score untouched.

create table if not exists public.trademark_feature_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_mode text not null check (product_mode in ('monitoring', 'name_research')),
  earlier_ref text not null,
  later_ref text not null,
  feature_version text not null,
  normalization_version text not null,
  phonetics_version text not null,
  goods_services_version text not null,
  legal_rules_version text not null,
  features jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  risk jsonb not null default '{}'::jsonb,
  legacy_total_score numeric(6, 2),
  created_at timestamptz not null default now()
);
comment on table public.trademark_feature_snapshots is 'Shadow feature vectors + rules risk alongside legacy scores; never overwrites total_score history.';
create index if not exists trademark_feature_snapshots_created_at_idx
  on public.trademark_feature_snapshots (created_at desc);

create table if not exists public.trademark_human_labels (
  id uuid primary key default gen_random_uuid(),
  comparison_key text not null,
  product_mode text not null check (product_mode in ('monitoring', 'name_research')),
  pair_label text,
  sign_similarity text,
  goods_services_similarity text,
  legal_outcome text,
  user_feedback text,
  notes text,
  reviewer_id text not null,
  confidence numeric(4, 3),
  created_at timestamptz not null default now()
);
comment on table public.trademark_human_labels is 'Offline labeling / feedback for training — not used for online learning.';
create index if not exists trademark_human_labels_comparison_key_idx
  on public.trademark_human_labels (comparison_key);

alter table public.trademark_matches
  add column if not exists feature_version text,
  add column if not exists risk_band text,
  add column if not exists risk_confidence numeric(4, 3),
  add column if not exists actionability text;

-- Platform-only read of funnel lives in scan_runs.metadata already.
