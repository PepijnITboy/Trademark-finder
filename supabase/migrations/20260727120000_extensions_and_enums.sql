-- Merkwacht database schema: extensions and enum types.
--
-- See docs/database/schema.md for the narrative overview and
-- docs/security/security-model.md for the RLS design this schema
-- implements. This migration only sets up shared prerequisites (the
-- pgcrypto extension for gen_random_uuid(), a `private` schema for
-- RLS helper functions not exposed via PostgREST, and every enum type
-- used by later migrations).

create extension if not exists pgcrypto with schema extensions;

-- Helper functions that back RLS policies live in `private` rather than
-- `public` so they are never exposed as callable RPCs over PostgREST.
create schema if not exists private;

grant usage on schema private to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

create type public.mark_type as enum ('word', 'figurative', 'combined', 'other');
comment on type public.mark_type is 'How a mark is represented in a register filing.';

create type public.watched_trademark_status as enum ('active', 'paused', 'expired', 'archived');
comment on type public.watched_trademark_status is 'Lifecycle status of a watched_trademark within Merkwacht itself.';

create type public.register_trademark_status as enum (
  'pending',
  'registered',
  'opposed',
  'refused',
  'withdrawn',
  'expired',
  'unknown'
);
comment on type public.register_trademark_status is 'Status of a registration as reported by the register itself.';

create type public.procedural_status as enum (
  'filed',
  'published',
  'opposition_period',
  'registered',
  'opposed',
  'withdrawn',
  'refused',
  'expired'
);
comment on type public.procedural_status is 'Register-reported lifecycle status of a candidate_application.';

create type public.match_workflow_status as enum (
  'new',
  'under_review',
  'confirmed_conflict',
  'dismissed',
  'opposition_filed',
  'opposition_deadline_passed'
);
comment on type public.match_workflow_status is 'Customer/operator-facing lifecycle status of a trademark_match.';

create type public.job_status as enum ('pending', 'running', 'succeeded', 'failed', 'skipped');
comment on type public.job_status is 'Execution status of a scan run, scan run step, or processing job.';

create type public.job_type as enum (
  'refresh_watched_snapshot',
  'fetch_publications',
  'match_candidates',
  'score_matches',
  'calculate_opposition_deadlines',
  'send_notifications',
  'ai_enrichment'
);
comment on type public.job_type is 'Every job type in the daily worker pipeline. See docs/operations/daily-jobs.md.';

create type public.connector_health_status as enum ('ok', 'configuration_required', 'degraded', 'unavailable');
comment on type public.connector_health_status is 'Health of a register connector. configuration_required/unavailable must never be papered over with fabricated data.';

create type public.notification_channel as enum ('email', 'in_app');

create type public.notification_type as enum (
  'new_match',
  'opposition_deadline_reminder',
  'opposition_deadline_passed',
  'connector_down',
  'ai_budget_exhausted'
);

create type public.workspace_role as enum ('owner', 'admin', 'member');

create type public.feature_flag as enum (
  'ai_enrichment',
  'pdf_export',
  'csv_export',
  'email_notifications',
  'multi_register_watch',
  'platform_access'
);

create type public.subscription_plan_code as enum ('starter', 'pro', 'agency');

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'canceled');

create type public.opposition_rule_kind as enum ('calendar_days', 'months');

create type public.opposition_starts_from as enum ('publication_date', 'filing_date');

create type public.deadline_event_type as enum (
  'reminder_30d',
  'reminder_14d',
  'reminder_7d',
  'reminder_2d',
  'deadline_passed'
);

create type public.score_component as enum (
  'textual_similarity',
  'phonetic_similarity',
  'visual_similarity',
  'semantic_similarity',
  'nice_class_overlap',
  'goods_services_overlap',
  'geographic_overlap',
  'ai_plausibility_adjustment'
);

create type public.export_type as enum ('pdf', 'csv');

create type public.export_status as enum ('pending', 'processing', 'completed', 'failed');

create type public.incident_severity as enum ('low', 'medium', 'high', 'critical');

create type public.incident_status as enum ('open', 'monitoring', 'resolved');

create type public.scoring_experiment_status as enum ('draft', 'running', 'completed', 'archived');

create type public.actor_type as enum ('user', 'service', 'platform_operator', 'system');
