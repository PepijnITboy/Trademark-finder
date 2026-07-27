-- Merkwacht local development seed data.
--
-- =====================================================================
-- EVERYTHING in this file is FICTITIOUS demo/test data. None of it is
-- real BOIP register data, and it must never be used as a production
-- fallback if the BOIP connector is unconfigured or unavailable - per
-- docs/connectors/connector-contract.md, a misconfigured/unreachable
-- connector must surface as configuration_required/unavailable, never
-- be papered over with invented trademarks. Every fictitious row below
-- is explicitly labeled as such in its applicant_name/notes/body text.
-- =====================================================================
--
-- Seed IDs for the organization/workspace/user are the exact UUIDs from
-- packages/database/src/dev-identity.ts (DEV_SEED_IDS) so
-- DevIdentityProvider resolves to real, seeded rows in local dev.

begin;

-- ---------------------------------------------------------------------
-- Dev auth user (normally managed by Supabase Auth; inserted here only
-- so local FKs against auth.users resolve without a real signup flow).
-- ---------------------------------------------------------------------

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'dev@merkwacht.local',
  -- Local dev fixture only; this is not a valid password hash. Use
  -- Supabase Auth (magic link / password reset) to set a real password
  -- for this user before relying on password sign-in locally.
  '$2a$10$devseedonlynotarealbcrypthashxxxxxxxxxxxxxxxxxxxxxxxxxx',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"name":"Dev Gebruiker"}'::jsonb,
  '', '', '', '',
  now(),
  now()
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Organization / workspace / membership / platform operator
-- ---------------------------------------------------------------------

insert into public.organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Demo Organisatie BV');

insert into public.workspaces (id, organization_id, name)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Standaard workspace'
);

insert into public.workspace_members (workspace_id, user_id, role)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  'owner'
);

-- The dev user doubles as a platform operator locally so a single login
-- can exercise both /app and /platform during development.
insert into public.platform_users (id, user_id, display_name, is_active)
values (
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000003',
  'Dev Platform Operator',
  true
);

-- ---------------------------------------------------------------------
-- Billing: five-plan catalog (seed starter for demo workspace)
-- ---------------------------------------------------------------------

insert into public.subscription_plans (id, code, name, price_eur_cents, max_watched_trademarks, max_notification_emails, support_tier)
values
  ('00000000-0000-4000-8000-000000000110', 'starter', 'Starter', 4900, 3, 5, 'standaard'),
  ('00000000-0000-4000-8000-000000000111', 'basis', 'Basis', 2900, 1, 2, 'basis'),
  ('00000000-0000-4000-8000-000000000112', 'plus', 'Plus', 9900, 10, 15, 'standaard'),
  ('00000000-0000-4000-8000-000000000113', 'pro', 'Pro', 19900, 30, 40, 'prioriteit'),
  ('00000000-0000-4000-8000-000000000114', 'enterprise', 'Enterprise', 39900, 100, 100, 'dedicated');

insert into public.subscription_plan_features (subscription_plan_id, feature_flag, enabled, limit_value)
values
  ('00000000-0000-4000-8000-000000000110', 'email_notifications', true, null),
  ('00000000-0000-4000-8000-000000000110', 'csv_export', true, null),
  ('00000000-0000-4000-8000-000000000110', 'pdf_export', false, null),
  ('00000000-0000-4000-8000-000000000110', 'ai_enrichment', true, null),
  ('00000000-0000-4000-8000-000000000110', 'multi_register_watch', false, null),
  ('00000000-0000-4000-8000-000000000110', 'platform_access', false, null),
  ('00000000-0000-4000-8000-000000000110', 'merkrechten_chat', false, null),
  ('00000000-0000-4000-8000-000000000113', 'merkrechten_chat', true, null),
  ('00000000-0000-4000-8000-000000000113', 'pdf_export', true, null),
  ('00000000-0000-4000-8000-000000000114', 'merkrechten_chat', true, null),
  ('00000000-0000-4000-8000-000000000114', 'pdf_export', true, null);

insert into public.workspace_subscriptions (workspace_id, subscription_plan_id, status, started_at)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000110',
  'active',
  now()
);

-- Resolved entitlements = plan defaults, unmodified by any override.
insert into public.feature_entitlements (workspace_id, feature_flag, enabled, limit_value)
select '00000000-0000-4000-8000-000000000002', feature_flag, enabled, limit_value
from public.subscription_plan_features
where subscription_plan_id = '00000000-0000-4000-8000-000000000110';

-- ---------------------------------------------------------------------
-- Register sources: BOIP (real, unconfigured locally) + disabled
-- placeholders for future registers. No live credentials are ever
-- seeded here - status stays configuration_required until real
-- BOIP_API_KEY / BOIP_API_BASE_URL env vars are set, per
-- docs/connectors/boip.md.
-- ---------------------------------------------------------------------

insert into public.register_sources (id, code, name, status, capabilities, is_enabled)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'BOIP',
    'Benelux-Bureau voor de Intellectuele Eigendom (Datolite)',
    'configuration_required',
    '{"supportsIncrementalFetch": true, "supportsFigurativeMarks": false, "supportsTrademarkLookup": true, "supportsOppositionStatusTracking": false}'::jsonb,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'EUIPO',
    'European Union Intellectual Property Office (placeholder, not yet implemented)',
    'configuration_required',
    '{"supportsIncrementalFetch": false, "supportsFigurativeMarks": false, "supportsTrademarkLookup": false, "supportsOppositionStatusTracking": false}'::jsonb,
    false
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    'WIPO',
    'World Intellectual Property Organization / Madrid System (placeholder, not yet implemented)',
    'configuration_required',
    '{"supportsIncrementalFetch": false, "supportsFigurativeMarks": false, "supportsTrademarkLookup": false, "supportsOppositionStatusTracking": false}'::jsonb,
    false
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    'USPTO',
    'United States Patent and Trademark Office (placeholder, not yet implemented)',
    'configuration_required',
    '{"supportsIncrementalFetch": false, "supportsFigurativeMarks": false, "supportsTrademarkLookup": false, "supportsOppositionStatusTracking": false}'::jsonb,
    false
  );

insert into public.register_connector_configs (register_source_id, environment, base_url, config)
values (
  '00000000-0000-4000-8000-000000000101',
  'local',
  null,
  '{"pageSize": 100}'::jsonb
);

insert into public.register_connector_credentials_metadata (register_source_id, credential_name, is_set)
values
  ('00000000-0000-4000-8000-000000000101', 'BOIP_API_KEY', false),
  ('00000000-0000-4000-8000-000000000101', 'BOIP_API_BASE_URL', false);

insert into public.register_health_checks (register_source_id, status, message)
values (
  '00000000-0000-4000-8000-000000000101',
  'configuration_required',
  'BOIP_API_KEY / BOIP_API_BASE_URL not set in this environment - no live calls made.'
);

-- BOIP opposition rule: 2 calendar months from publication date.
insert into public.opposition_rule_sets (id, register_source_id, kind, months, starts_from)
values (
  '00000000-0000-4000-8000-000000000130',
  '00000000-0000-4000-8000-000000000101',
  'months',
  2,
  'publication_date'
);

-- ---------------------------------------------------------------------
-- AI layer: disabled by default, matching AI_PROVIDER=none.
-- ---------------------------------------------------------------------

insert into public.ai_providers (id, code, display_name, is_enabled)
values
  ('00000000-0000-4000-8000-000000000140', 'none', 'AI enrichment disabled', true),
  ('00000000-0000-4000-8000-000000000141', 'openai', 'OpenAI', false);

insert into public.ai_budget_limits (scope, workspace_id, monthly_budget_eur)
values ('global', null, 5.00);

-- ---------------------------------------------------------------------
-- Scoring configuration: v1 model / weight profile / threshold profile.
-- Weights sum to 100: 25/22/13/8/17/8/4/3, matching
-- packages/scoring/src/weight-profile.ts DEFAULT_WEIGHT_PROFILE.
-- ---------------------------------------------------------------------

insert into public.scoring_model_versions (id, version_id, description, is_active)
values (
  '00000000-0000-4000-8000-000000000120',
  'v1',
  'Launch scoring pipeline: deterministic rule-based components plus optional, budget-capped AI adjustment.',
  true
);

insert into public.scoring_weight_profiles (
  id, scoring_model_version_id, profile_id,
  textual_similarity, phonetic_similarity, visual_similarity, semantic_similarity,
  nice_class_overlap, goods_services_overlap, geographic_overlap, ai_plausibility_adjustment,
  is_default
) values (
  '00000000-0000-4000-8000-000000000121',
  '00000000-0000-4000-8000-000000000120',
  'v1',
  25, 22, 13, 8,
  17, 8, 4, 3,
  true
);

insert into public.scoring_threshold_profiles (id, profile_id, high_confidence_min, moderate_min, low_min)
values (
  '00000000-0000-4000-8000-000000000122',
  'v1',
  80,
  50,
  25
);

-- ---------------------------------------------------------------------
-- FICTITIOUS watched trademarks: "LUMARO" and "VANTERO".
--
-- These are invented word marks for local development/demo purposes
-- only. They do not correspond to any real BOIP registration.
-- ---------------------------------------------------------------------

insert into public.watched_trademarks (id, workspace_id, label, status, register_source_id, registration_number)
values
  (
    '00000000-0000-4000-8000-000000000150',
    '00000000-0000-4000-8000-000000000002',
    'LUMARO',
    'active',
    '00000000-0000-4000-8000-000000000101',
    'FICTIEF-0001234'
  ),
  (
    '00000000-0000-4000-8000-000000000151',
    '00000000-0000-4000-8000-000000000002',
    'VANTERO',
    'active',
    '00000000-0000-4000-8000-000000000101',
    'FICTIEF-0005678'
  );

insert into public.watched_trademark_snapshots (
  id, watched_trademark_id, workspace_id, register_source_id, registration_number,
  mark_text, mark_type, applicant_name, filing_date, registration_date, register_status
) values
  (
    '00000000-0000-4000-8000-000000000160',
    '00000000-0000-4000-8000-000000000150',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000101',
    'FICTIEF-0001234',
    'LUMARO',
    'word',
    'Demo Organisatie BV (FICTIEF - geen echte BOIP-registratie)',
    '2023-03-01',
    '2023-07-15',
    'registered'
  ),
  (
    '00000000-0000-4000-8000-000000000161',
    '00000000-0000-4000-8000-000000000151',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000101',
    'FICTIEF-0005678',
    'VANTERO',
    'word',
    'Demo Organisatie BV (FICTIEF - geen echte BOIP-registratie)',
    '2022-11-10',
    '2023-02-20',
    'registered'
  );

update public.watched_trademarks set current_snapshot_id = '00000000-0000-4000-8000-000000000160'
  where id = '00000000-0000-4000-8000-000000000150';
update public.watched_trademarks set current_snapshot_id = '00000000-0000-4000-8000-000000000161'
  where id = '00000000-0000-4000-8000-000000000151';

insert into public.watched_trademark_classes (watched_trademark_snapshot_id, workspace_id, nice_class)
values
  ('00000000-0000-4000-8000-000000000160', '00000000-0000-4000-8000-000000000002', 9),
  ('00000000-0000-4000-8000-000000000160', '00000000-0000-4000-8000-000000000002', 42),
  ('00000000-0000-4000-8000-000000000161', '00000000-0000-4000-8000-000000000002', 25),
  ('00000000-0000-4000-8000-000000000161', '00000000-0000-4000-8000-000000000002', 35);

insert into public.watched_trademark_goods_services (watched_trademark_snapshot_id, workspace_id, nice_class, description)
values
  ('00000000-0000-4000-8000-000000000160', '00000000-0000-4000-8000-000000000002', 9, 'Software voor gegevensverwerking (FICTIEF).'),
  ('00000000-0000-4000-8000-000000000160', '00000000-0000-4000-8000-000000000002', 42, 'Ontwikkeling van software; SaaS-diensten (FICTIEF).'),
  ('00000000-0000-4000-8000-000000000161', '00000000-0000-4000-8000-000000000002', 25, 'Kleding, schoeisel (FICTIEF).'),
  ('00000000-0000-4000-8000-000000000161', '00000000-0000-4000-8000-000000000002', 35, 'Detailhandelsdiensten in kleding (FICTIEF).');

insert into public.watch_eligibility_decisions (watched_trademark_id, workspace_id, eligible, reasons, policy_id)
values
  ('00000000-0000-4000-8000-000000000150', '00000000-0000-4000-8000-000000000002', true, array['eligible'], 'boip-v1'),
  ('00000000-0000-4000-8000-000000000151', '00000000-0000-4000-8000-000000000002', true, array['eligible'], 'boip-v1');

insert into public.watch_settings (watched_trademark_id, workspace_id, notify_email, notify_in_app, min_score_threshold)
values
  ('00000000-0000-4000-8000-000000000150', '00000000-0000-4000-8000-000000000002', true, true, 25),
  ('00000000-0000-4000-8000-000000000151', '00000000-0000-4000-8000-000000000002', true, true, 25);

insert into public.watch_selected_classes (watched_trademark_id, workspace_id, nice_class)
values
  ('00000000-0000-4000-8000-000000000150', '00000000-0000-4000-8000-000000000002', 9),
  ('00000000-0000-4000-8000-000000000150', '00000000-0000-4000-8000-000000000002', 42),
  ('00000000-0000-4000-8000-000000000151', '00000000-0000-4000-8000-000000000002', 25),
  ('00000000-0000-4000-8000-000000000151', '00000000-0000-4000-8000-000000000002', 35);

insert into public.watch_related_class_suggestions (watched_trademark_id, workspace_id, nice_class, reason, accepted)
values (
  '00000000-0000-4000-8000-000000000150',
  '00000000-0000-4000-8000-000000000002',
  38,
  'FICTIEF voorbeeld: gerelateerde klasse (telecommunicatie) vaak gecombineerd met software-diensten.',
  null
);

-- ---------------------------------------------------------------------
-- FICTITIOUS candidate applications, opposition deadlines, and
-- trademark_matches with example scores.
-- ---------------------------------------------------------------------

insert into public.candidate_applications (
  id, register_source_id, application_number, mark_text, mark_type,
  applicant_name, filing_date, publication_date, procedural_status
) values
  (
    '00000000-0000-4000-8000-000000000170',
    '00000000-0000-4000-8000-000000000101',
    'FICTIEF-APP-0009001',
    'LUMARA',
    'word',
    'Voorbeeld Derde Partij BV (FICTIEF)',
    '2026-05-01',
    '2026-06-01',
    'opposition_period'
  ),
  (
    '00000000-0000-4000-8000-000000000171',
    '00000000-0000-4000-8000-000000000101',
    'FICTIEF-APP-0009002',
    'VANTIRO',
    'word',
    'Voorbeeld Concurrent NV (FICTIEF)',
    '2026-04-10',
    '2026-05-20',
    'opposition_period'
  ),
  (
    '00000000-0000-4000-8000-000000000172',
    '00000000-0000-4000-8000-000000000101',
    'FICTIEF-APP-0009003',
    'ZANTORA',
    'word',
    'Voorbeeld Onbekende BV (FICTIEF)',
    '2026-03-15',
    '2026-04-25',
    'published'
  );

insert into public.candidate_application_classes (candidate_application_id, nice_class)
values
  ('00000000-0000-4000-8000-000000000170', 9),
  ('00000000-0000-4000-8000-000000000170', 42),
  ('00000000-0000-4000-8000-000000000171', 25),
  ('00000000-0000-4000-8000-000000000171', 35),
  ('00000000-0000-4000-8000-000000000172', 9);

insert into public.candidate_application_goods_services (candidate_application_id, nice_class, description)
values
  ('00000000-0000-4000-8000-000000000170', 9, 'Downloadbare software (FICTIEF).'),
  ('00000000-0000-4000-8000-000000000170', 42, 'Cloud computing-diensten (FICTIEF).'),
  ('00000000-0000-4000-8000-000000000171', 25, 'Herenkleding (FICTIEF).'),
  ('00000000-0000-4000-8000-000000000171', 35, 'Online winkeldiensten (FICTIEF).'),
  ('00000000-0000-4000-8000-000000000172', 9, 'Mobiele applicaties (FICTIEF).');

insert into public.candidate_status_history (candidate_application_id, status, observed_at)
values
  ('00000000-0000-4000-8000-000000000170', 'published', '2026-06-01'::timestamptz),
  ('00000000-0000-4000-8000-000000000170', 'opposition_period', '2026-06-02'::timestamptz),
  ('00000000-0000-4000-8000-000000000171', 'published', '2026-05-20'::timestamptz),
  ('00000000-0000-4000-8000-000000000171', 'opposition_period', '2026-05-21'::timestamptz),
  ('00000000-0000-4000-8000-000000000172', 'published', '2026-04-25'::timestamptz);

insert into public.candidate_procedural_statuses (candidate_application_id, status, observed_at)
values
  ('00000000-0000-4000-8000-000000000170', 'opposition_period', '2026-06-02'::timestamptz),
  ('00000000-0000-4000-8000-000000000171', 'opposition_period', '2026-05-21'::timestamptz),
  ('00000000-0000-4000-8000-000000000172', 'published', '2026-04-25'::timestamptz);

insert into public.opposition_deadlines (candidate_application_id, opposition_rule_set_id, start_date, deadline_date)
values
  ('00000000-0000-4000-8000-000000000170', '00000000-0000-4000-8000-000000000130', '2026-06-01', '2026-08-01'),
  ('00000000-0000-4000-8000-000000000171', '00000000-0000-4000-8000-000000000130', '2026-05-20', '2026-07-20');

-- LUMARO (watched) vs LUMARA (candidate): high textual/phonetic overlap, shared classes.
insert into public.trademark_matches (
  id, workspace_id, watched_trademark_id, candidate_application_id,
  status, total_score, weight_profile_id, opposition_deadline_id
)
select
  '00000000-0000-4000-8000-000000000180',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000150',
  '00000000-0000-4000-8000-000000000170',
  'new',
  84.50,
  'v1',
  od.id
from public.opposition_deadlines od
where od.candidate_application_id = '00000000-0000-4000-8000-000000000170';

-- VANTERO (watched) vs VANTIRO (candidate): moderate overlap.
insert into public.trademark_matches (
  id, workspace_id, watched_trademark_id, candidate_application_id,
  status, total_score, weight_profile_id, opposition_deadline_id
)
select
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000151',
  '00000000-0000-4000-8000-000000000171',
  'under_review',
  68.25,
  'v1',
  od.id
from public.opposition_deadlines od
where od.candidate_application_id = '00000000-0000-4000-8000-000000000171';

-- LUMARO (watched) vs ZANTORA (candidate): low overlap, no opposition deadline yet.
insert into public.trademark_matches (
  id, workspace_id, watched_trademark_id, candidate_application_id,
  status, total_score, weight_profile_id
) values (
  '00000000-0000-4000-8000-000000000182',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000150',
  '00000000-0000-4000-8000-000000000172',
  'dismissed',
  22.00,
  'v1'
);

insert into public.match_score_components (trademark_match_id, workspace_id, component, raw_value, weight, weighted_value)
values
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'textual_similarity', 0.92, 25, 23.00),
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'phonetic_similarity', 0.95, 22, 20.90),
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'visual_similarity', 0.88, 13, 11.44),
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'semantic_similarity', 0.40, 8, 3.20),
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'nice_class_overlap', 1.00, 17, 17.00),
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'goods_services_overlap', 0.80, 8, 6.40),
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'geographic_overlap', 1.00, 4, 4.00),
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'ai_plausibility_adjustment', -0.45, 3, -1.35),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'textual_similarity', 0.70, 25, 17.50),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'phonetic_similarity', 0.78, 22, 17.16),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'visual_similarity', 0.65, 13, 8.45),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'semantic_similarity', 0.30, 8, 2.40),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'nice_class_overlap', 1.00, 17, 17.00),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'goods_services_overlap', 0.50, 8, 4.00),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'geographic_overlap', 1.00, 4, 4.00),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'ai_plausibility_adjustment', -0.75, 3, -2.25),
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000002', 'textual_similarity', 0.25, 25, 6.25),
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000002', 'phonetic_similarity', 0.30, 22, 6.60),
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000002', 'visual_similarity', 0.20, 13, 2.60),
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000002', 'semantic_similarity', 0.10, 8, 0.80),
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000002', 'nice_class_overlap', 1.00, 17, 17.00),
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000002', 'goods_services_overlap', 0.00, 8, 0.00),
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000002', 'geographic_overlap', 1.00, 4, 4.00),
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000002', 'ai_plausibility_adjustment', 0.00, 3, 0.00);

insert into public.match_score_explanations (trademark_match_id, workspace_id, component, explanation)
values
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'textual_similarity', 'FICTIEF voorbeeld: "LUMARO" en "LUMARA" verschillen slechts in de laatste klinker.'),
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'nice_class_overlap', 'FICTIEF voorbeeld: volledige overlap in klassen 9 en 42.'),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'textual_similarity', 'FICTIEF voorbeeld: "VANTERO" en "VANTIRO" delen voor- en achtervoegsel.');

insert into public.match_ai_assessments (trademark_match_id, workspace_id, provider, adjustment, rationale)
values
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', 'none', -0.45, 'FICTIEF voorbeeld - AI-laag stond uit (AI_PROVIDER=none) toen dit voorbeeld werd aangemaakt; waarde is illustratief.'),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'none', -0.75, 'FICTIEF voorbeeld - AI-laag stond uit (AI_PROVIDER=none) toen dit voorbeeld werd aangemaakt; waarde is illustratief.');

insert into public.match_status_history (trademark_match_id, workspace_id, from_status, to_status, note)
values
  ('00000000-0000-4000-8000-000000000180', '00000000-0000-4000-8000-000000000002', null, 'new', 'FICTIEF voorbeeld: aangemaakt door de score_matches job.'),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', null, 'new', 'FICTIEF voorbeeld: aangemaakt door de score_matches job.'),
  ('00000000-0000-4000-8000-000000000181', '00000000-0000-4000-8000-000000000002', 'new', 'under_review', 'FICTIEF voorbeeld: geopend door demo-gebruiker.'),
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000002', null, 'new', 'FICTIEF voorbeeld: aangemaakt door de score_matches job.'),
  ('00000000-0000-4000-8000-000000000182', '00000000-0000-4000-8000-000000000002', 'new', 'dismissed', 'FICTIEF voorbeeld: als niet-relevant afgewezen (te lage score).');

insert into public.match_notes (trademark_match_id, workspace_id, author_user_id, body)
values (
  '00000000-0000-4000-8000-000000000181',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  'FICTIEF/DEMO: dit is voorbeelddata voor lokale ontwikkeling, geen echte registerdata en geen juridisch advies. Niet gebruiken als signaal richting klanten.'
);

commit;
