# Daily Jobs

`apps/worker` runs a fixed daily pipeline of `ProcessingJob`s (see
`packages/domain/src/jobs/types.ts`). This document describes the schedule,
each job's responsibility, and the retry/failure policy.

## Job types

| `ProcessingJob.type` | Responsibility |
| --- | --- |
| `refresh_watched_snapshot` | Re-fetch `RegisteredTrademarkSnapshot` for every active `WatchedTrademark` and re-evaluate `WatchEligibilityDecision`. |
| `fetch_publications` | Per register connector, fetch new/updated `CandidateApplication`s since the last `SourceCheckpoint`. |
| `match_candidates` | Pair eligible `WatchedTrademark`s against new/updated `CandidateApplication`s using pre-filters. |
| `score_matches` | Run the [scoring pipeline](../scoring/overview.md) on pairs produced by `match_candidates`, upserting `trademark_match` rows. |
| `calculate_opposition_deadlines` | Compute/refresh `OppositionDeadline`s for candidate applications that don't have one yet or whose procedural status changed. |
| `send_notifications` | Dispatch `NotificationPayload`s for new matches and upcoming/passed opposition deadlines. |
| `ai_enrichment` | (Invoked from within `score_matches`, but tracked separately for budget/audit purposes) Applies `AiEnrichmentPort.adjust()` where budget allows. |

## Schedule

```
00:00  refresh_watched_snapshot        (nightly, all active watches)
00:30  fetch_publications              (per register connector, staggered)
01:30  match_candidates
02:00  score_matches (incl. ai_enrichment)
02:30  calculate_opposition_deadlines
03:00  send_notifications
```

Times are indicative and configured per-environment; the important
invariant is the **ordering** — each stage depends on the previous stage's
output for that day's run. Jobs are also individually re-runnable/idempotent
so operators can re-trigger a single stage from `/platform` without
re-running the whole pipeline (e.g. re-running `send_notifications` alone
after fixing an email template bug).

## Idempotency

- `fetch_publications` upserts on `(registry_code, application_number)`.
- `match_candidates` + `score_matches` upsert on
  `(watched_trademark_id, candidate_application_id)`.
- `send_notifications` checks `notification.sent_at` and existing rows for
  the same `(organization_id, watched_trademark_id, type, payload-key)`
  before creating a duplicate, so re-runs never double-notify a customer.

## Failure and retry policy

Every job execution creates a `processing_job` row (`pending` → `running` →
`succeeded`/`failed`/`skipped`). On failure:

1. The job is retried with exponential backoff, up to a per-job-type max
   attempt count (default 3).
2. `ConnectorConfigurationError` and `ConnectorRateLimitError` (see
   [connector contract](../connectors/connector-contract.md#errors)) are
   **not** retried in a tight loop — configuration errors mark the job
   `skipped` (nothing to retry until an operator fixes config), and rate
   limit errors respect the connector's `retryAfterMs` hint.
3. After exhausting retries, the job is marked `failed` and surfaced on
   `/platform`'s operations dashboard. A failed `fetch_publications` for one
   register does not block `fetch_publications` for other registers, nor
   does it block `match_candidates`/`score_matches` from running against
   whatever data is already available — partial pipeline degradation is
   preferred over an all-or-nothing daily run.

## Observability

`/platform` surfaces, per day and per register:

- Connector health (`ok` / `configuration_required` / `degraded` /
  `unavailable`) at the time of the last `fetch_publications` run.
- Counts: candidate applications fetched, matches created/updated,
  notifications sent, AI calls made and their cost against
  `AI_MONTHLY_BUDGET_EUR`.
- Any `failed` or `skipped` jobs with their error detail.

## Manual/on-demand runs

Operators can trigger any job type on demand from `/platform` (protected by
`INTERNAL_JOB_SECRET` when invoked via the internal API rather than the UI).
This is primarily used for:

- Re-running `fetch_publications` for a single register after resolving a
  configuration issue.
- Re-running `score_matches` for a specific `watched_trademark_id` after a
  customer reports an unexpected result, to aid debugging without waiting
  for the next scheduled run.
