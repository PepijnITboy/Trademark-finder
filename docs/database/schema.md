# Database Schema

Merkwacht uses Supabase (Postgres + Auth + Row Level Security). The schema
is defined entirely in `supabase/migrations` — 14 migration files creating
**70 tables** across 13 domain areas, plus a shared set of enum types and
RLS helper functions. Local/dev data is loaded from `supabase/seed/seed.sql`.

This document gives:

1. An entity-relationship diagram of the **core** entities (the subset most
   application code touches day-to-day).
2. A full table-by-table inventory, grouped by migration file.
3. A summary of the Row Level Security (RLS) posture.
4. A note on the seed data.

See also:

- [`docs/domain/trademark-model.md`](../domain/trademark-model.md) — the
  domain concepts (`watched_trademark` vs `candidate_application`, matches,
  eligibility) that the core tables implement.
- [`docs/domain/opposition-workflow.md`](../domain/opposition-workflow.md) —
  the opposition/deadline tables in context.
- [`docs/security/security-model.md`](../security/security-model.md) — RLS
  policy design, roles, and the `/app` vs `/platform` boundary.
- [`docs/operations/daily-jobs.md`](../operations/daily-jobs.md) — the
  worker audit-trail tables (`scan_runs`, `processing_jobs`, ...).
- [`docs/scoring/overview.md`](../scoring/overview.md) — the scoring
  configuration tables.

## Migration files

| Migration | Domain area | Tables |
| --- | --- | --- |
| `20260727120000_extensions_and_enums.sql` | Extensions (`pgcrypto`) and every shared `enum` type used below. Creates no tables. | 0 |
| `20260727120100_core_tenancy.sql` | Tenancy: organizations, workspaces, membership, platform operators, plus the `private.*` RLS helper functions used by every later migration. | 4 |
| `20260727120200_register_sources.sql` | Register connectors (BOIP et al.): config, credential metadata, health checks, checkpoints, raw import audit trail. | 7 |
| `20260727120300_watched_trademarks.sql` | The **watched** side of the domain model: a customer's own marks, their snapshots, classes, goods/services, eligibility decisions, and notification/class settings. | 8 |
| `20260727120400_candidate_applications.sql` | The **candidate** side of the domain model: register-wide published applications, their snapshots, classes, goods/services, and procedural status history. | 6 |
| `20260727120500_trademark_matches.sql` | The computed, customer-facing match between a watched trademark and a candidate application: scores, explanations, AI assessments, status history, review actions, notes. | 7 |
| `20260727120600_opposition.sql` | Opposition rule sets, calculated deadlines, and the deadline event log driving reminders. | 3 |
| `20260727120700_processing_jobs.sql` | Worker pipeline audit trail: scan runs → scan run steps → processing jobs → attempts, plus a dead-letter table. | 5 |
| `20260727120800_notifications.sql` | Customer-facing notifications and per-workspace delivery preferences. | 2 |
| `20260727120900_scoring_config.sql` | Versioned scoring configuration: model versions, weight profiles, threshold profiles, phonetic/normalization rule versions. | 5 |
| `20260727121000_ai_layer.sql` | Optional, budget-capped AI enrichment layer: providers, model configs, usage records, budget limits, response cache. | 5 |
| `20260727121100_exports_audit.sql` | Customer exports (PDF/CSV dossiers) and the system-wide audit log. | 2 |
| `20260727121200_billing.sql` | Subscription plans, per-workspace subscriptions, usage metering, and resolved feature entitlements. | 6 |
| `20260727121300_platform.sql` | Platform-operator-only tooling: global settings, feature flags, customer notes, incidents, scoring experiments, system health, time-boxed support access. | 9 |
| **Total** | | **70** |

## Entity-relationship diagram (core entities)

The full 70-table graph is large; the diagram below shows the entities
that the `/app` and `/platform` front ends interact with most directly. See
the table inventory below for the complete picture (snapshots, history
tables, and config/audit tables are omitted here for readability).

```
organizations
    │ 1
    │ *
workspaces ─────────────────────* workspace_members ──────* (auth.users)
    │ 1                                                          │
    │ *                                                          │ *
watched_trademarks                                     platform_users (independent identity,
    │ 1                                                           not tied to a workspace)
    │ *
watched_trademark_snapshots (append-only history;
watched_trademarks.current_snapshot_id → latest row)

watched_trademarks ──────────────* trademark_matches *──────────────── candidate_applications
                                        │ 1                                    │ 1
                                        │ *                                    │ *
                              match_score_components /              candidate_application_snapshots
                              match_score_explanations /                      │ 1
                              match_ai_assessments /                          │ 1 (unique)
                              match_status_history /                 opposition_deadlines
                              match_review_actions /                          │ 1
                              match_notes                                     │ *
                                                                       deadline_events

workspaces ──1:1── workspace_subscriptions ──*── usage_records
    │ 1
    │ *
feature_entitlements

workspaces ──* notifications
                  └─* watched_trademarks / trademark_matches (nullable FK, context)

register_sources ──* register_checkpoints / register_health_checks / source_imports
                        └─* raw_source_records

scan_runs ──* scan_run_steps ──* processing_jobs ──* processing_job_attempts
                                        └─* dead_letter_jobs (on exhausted retries)
```

Key structural notes:

- **Tenancy is two levels deep**: `organizations` → `workspaces` →
  `workspace_members`. Almost all customer data (watched trademarks,
  matches, notifications, billing, exports) hangs off `workspace_id`
  directly, not `organization_id`, per the convention documented in
  `20260727120100_core_tenancy.sql`.
- **Platform operators** (`platform_users`) are a distinct identity from
  `workspace_members` — a platform operator is not required to belong to
  any customer workspace.
- **Watched vs. candidate** is the central domain split: `watched_trademarks`
  (+ snapshots/classes/goods-services/eligibility/settings) represent a
  customer's own marks; `candidate_applications` (+ their own
  snapshots/classes/goods-services/status history) are register-wide data
  fetched once and shared across every workspace. `trademark_matches` is
  the workspace-scoped join between the two.
- **History is append-only** in several places (`watched_trademark_snapshots`,
  `candidate_application_snapshots`, `watch_eligibility_decisions`,
  `match_status_history`, `candidate_status_history`,
  `platform_setting_versions`): the "current" row is pointed to by a
  `current_*_id` FK or found via `order by ... desc limit 1`, rather than
  mutated in place.

## Full table inventory

### Tenancy — `20260727120100_core_tenancy.sql`

| Table | Purpose |
| --- | --- |
| `organizations` | Billing/tenant root; one row per customer company. |
| `workspaces` | Operating unit almost all customer data hangs off; an organization may have multiple workspaces. |
| `workspace_members` | Links a Supabase Auth user to a workspace with a role (`owner`/`admin`/`member`). |
| `platform_users` | Merkwacht's internal team; gates `/platform` access, independent of workspace membership. |

### Register sources — `20260727120200_register_sources.sql`

| Table | Purpose |
| --- | --- |
| `register_sources` | A trademark register Merkwacht can connect to (BOIP; EUIPO/WIPO/USPTO reserved). |
| `register_connector_configs` | Non-secret connector configuration (base URL, environment). |
| `register_connector_credentials_metadata` | Tracks *whether* a credential is configured/rotated — never the value itself. |
| `register_health_checks` | History of connector `healthCheck()` probes, surfaced on `/platform`. |
| `register_checkpoints` | Opaque, per-connector incremental fetch cursor. |
| `source_imports` | One row per `fetch_publications` run against a connector. |
| `raw_source_records` | Archived raw connector payload per record, for audit only. |

### Watched trademarks — `20260727120300_watched_trademarks.sql`

| Table | Purpose |
| --- | --- |
| `watched_trademarks` | A mark a customer workspace monitors. |
| `watched_trademark_snapshots` | Append-only history of register state for a watched trademark. |
| `watched_trademark_classes` | Nice classes on a watched-trademark snapshot. |
| `watched_trademark_goods_services` | Goods/services text per Nice class for a snapshot. |
| `watch_eligibility_decisions` | Append-only history of `WatchEligibilityDecision` evaluations. |
| `watch_settings` | Per-watch notification/triage preferences (score threshold, channels). |
| `watch_selected_classes` | Nice classes the customer explicitly opted to monitor. |
| `watch_related_class_suggestions` | System-suggested related Nice classes, pending accept/reject. |

### Candidate applications — `20260727120400_candidate_applications.sql`

| Table | Purpose |
| --- | --- |
| `candidate_applications` | Register-wide, every application published by a register. |
| `candidate_application_snapshots` | History of register state for a candidate application. |
| `candidate_application_classes` | Nice classes on a candidate-application snapshot. |
| `candidate_application_goods_services` | Goods/services text per Nice class for a snapshot. |
| `candidate_status_history` | History of procedural status transitions. |
| `candidate_procedural_statuses` | Reference table of known procedural status values per register. |

### Trademark matches — `20260727120500_trademark_matches.sql`

| Table | Purpose |
| --- | --- |
| `trademark_matches` | Computed match between one watched trademark and one candidate application. |
| `match_score_components` | Per-component score breakdown (textual, phonetic, goods/services, ...). |
| `match_score_explanations` | Human-readable explanation strings for a match's score. |
| `match_ai_assessments` | Optional AI-layer enrichment of a match (see AI layer tables). |
| `match_status_history` | History of match workflow status transitions. |
| `match_review_actions` | Audit trail of reviewer actions (dismiss, escalate, mark opposed, ...). |
| `match_notes` | Free-text notes a customer attaches to a match. |

### Opposition — `20260727120600_opposition.sql`

| Table | Purpose |
| --- | --- |
| `opposition_rule_sets` | Register-specific opposition-window rule definitions. |
| `opposition_deadlines` | Calculated deadline per candidate application. |
| `deadline_events` | Event log (reminders sent, deadline passed, ...) driving notifications. |

### Processing jobs — `20260727120700_processing_jobs.sql`

| Table | Purpose |
| --- | --- |
| `scan_runs` | One row per daily worker pipeline invocation. |
| `scan_run_steps` | One row per job-type stage within a scan run. |
| `processing_jobs` | `ProcessingJob` audit rows the worker actually writes. |
| `processing_job_attempts` | Retry history for a processing job. |
| `dead_letter_jobs` | Jobs whose retries were exhausted. |

### Notifications — `20260727120800_notifications.sql`

| Table | Purpose |
| --- | --- |
| `notifications` | Customer-facing notification (email/in-app) about a match or deadline. |
| `notification_preferences` | Per-workspace/user delivery preferences. |

### Scoring configuration — `20260727120900_scoring_config.sql`

| Table | Purpose |
| --- | --- |
| `scoring_model_versions` | Versioned identifier for a full scoring model release. |
| `scoring_weight_profiles` | Per-component weight sets used to compute `total_score`. |
| `scoring_threshold_profiles` | Triage thresholds (e.g. auto-dismiss, needs-review). |
| `phonetic_rule_versions` | Versioned phonetic substitution rule sets (see `packages/phonetics`). |
| `normalization_rule_versions` | Versioned mark-name normalization rule sets. |

### AI layer — `20260727121000_ai_layer.sql`

| Table | Purpose |
| --- | --- |
| `ai_providers` | Configured AI providers (OpenAI, ..., or none). |
| `ai_model_configs` | Model/version configuration per provider. |
| `ai_usage_records` | Per-call usage/cost record for budget enforcement. |
| `ai_budget_limits` | Monthly spend caps; exceeding one disables the AI layer for rule-based fallback. |
| `ai_response_cache` | Cache of AI responses to avoid redundant paid calls. |

### Exports & audit — `20260727121100_exports_audit.sql`

| Table | Purpose |
| --- | --- |
| `exports` | Customer PDF/CSV export requests and their status/file reference. |
| `audit_logs` | System-wide audit log of sensitive actions. |

### Billing — `20260727121200_billing.sql`

| Table | Purpose |
| --- | --- |
| `subscription_plans` | Plan catalog (`starter`/`pro`/`agency`), pricing, limits. |
| `subscription_plan_features` | Feature flags included per plan. |
| `workspace_subscriptions` | A workspace's active subscription. |
| `usage_records` | Metered usage (e.g. watched-trademark count) against plan limits. |
| `workspace_feature_overrides` | Manual per-workspace feature overrides on top of the plan. |
| `feature_entitlements` | Resolved, denormalized feature flags per workspace (plan + overrides). |

### Platform — `20260727121300_platform.sql`

| Table | Purpose |
| --- | --- |
| `platform_settings` | Global key/value platform configuration. |
| `platform_setting_versions` | Append-only history of `platform_settings` changes. |
| `platform_feature_flags` | Internal feature flags for staged rollouts. |
| `platform_customer_notes` | Internal notes on a customer organization/workspace. |
| `platform_incidents` | Incident tracking (severity, status). |
| `platform_incident_events` | Timeline of updates on an incident. |
| `scoring_experiments` | A/B or shadow experiments on scoring configuration. |
| `scoring_test_cases` | Curated test cases (e.g. LUMARO/LUMARA-style pairs) used to evaluate scoring changes. |
| `system_health_checks` | Aggregate platform health snapshots. |
| `support_access_sessions` | Time-boxed grants for a platform operator to access a specific customer's data for support. |

## Enum types

All defined in `20260727120000_extensions_and_enums.sql`: `mark_type`,
`watched_trademark_status`, `register_trademark_status`,
`procedural_status`, `match_workflow_status`, `job_status`, `job_type`,
`connector_health_status`, `notification_channel`, `notification_type`,
`workspace_role`, `feature_flag`, `subscription_plan_code`,
`subscription_status`, `opposition_rule_kind`, `opposition_starts_from`,
`deadline_event_type`, `score_component`, `export_type`, `export_status`,
`incident_severity`, `incident_status`, `scoring_experiment_status`,
`actor_type`.

## Row Level Security

**Row Level Security is enabled on every table in the `public` schema.**
Every migration ends with an RLS section following the same shape:

- A `service_role` policy (`for all ... using (true) with check (true)`),
  so `apps/api`/`apps/worker` server-side code (which authenticates as the
  service role) can always read/write, in addition to the service role's
  Supabase-managed `BYPASSRLS` attribute.
- One or more `authenticated` policies scoped by role:
  - **Workspace-scoped tables** (`watched_trademarks`, `trademark_matches`,
    `notifications`, `exports`, billing tables, etc.) use
    `private.is_workspace_member(workspace_id)` (or
    `private.is_workspace_admin(...)` for privileged writes).
  - **Organization-scoped tables** (`organizations`) use
    `private.is_org_member(id)`.
  - **Register-wide tables** (`candidate_applications`,
    `opposition_deadlines`, `register_checkpoints`, `processing_jobs`,
    `raw_source_records`, etc.) grant `authenticated` users **no** access at
    all except via a `private.is_platform_operator()` policy —
    `register_sources` is the one exception, additionally allowing a
    read-only policy for any authenticated user so the UI can show which
    registers are supported.
  - **Platform-only tables** (everything in `20260727121300_platform.sql`)
    are gated exclusively by `private.is_platform_operator()`.

The `private.is_workspace_member`, `private.is_workspace_admin`,
`private.is_org_member`, and `private.is_platform_operator()` helper
functions (defined in `20260727120100_core_tenancy.sql`, `security definer`)
are what every later policy calls into. See
[`docs/security/security-model.md`](../security/security-model.md) for the
full role/authorization narrative.

## Seed data

`supabase/seed/seed.sql` is **entirely fictitious local-development/demo
data** — it seeds one demo organization/workspace, a dev auth user, and two
made-up watched trademarks, **"LUMARO"** and **"VANTERO"**, matched against
fabricated candidate applications (e.g. "LUMARA", "VANTIRO", "ZANTORA") to
exercise the scoring pipeline at different similarity levels. None of it is
real BOIP register data, and — per
[`docs/connectors/connector-contract.md`](../connectors/connector-contract.md)
— it must never be used as a fallback when the BOIP connector is
unconfigured or unavailable; a misconfigured connector should surface as
`configuration_required`/`unavailable`, never be papered over with invented
trademarks. Every fictitious row is explicitly labeled as such in its
`applicant_name`/notes/body text.
