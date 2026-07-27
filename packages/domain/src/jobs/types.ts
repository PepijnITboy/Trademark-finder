import type { JobStatus } from '../statuses.js';

export const JOB_TYPES = [
  'refresh_watched_snapshot',
  'fetch_publications',
  'match_candidates',
  'score_matches',
  'calculate_opposition_deadlines',
  'send_notifications',
  'ai_enrichment',
] as const;
/** Every job type in the daily worker pipeline. See `docs/operations/daily-jobs.md`. */
export type JobType = (typeof JOB_TYPES)[number];

/**
 * A single execution (attempt) of a worker job, persisted as an audit trail
 * row (`processing_job`, see `docs/database/schema.md`). Job runs are
 * expected to be idempotent so a `failed` job can always be safely retried
 * or re-triggered on demand from `/platform`.
 */
export interface ProcessingJob {
  readonly id: string;
  readonly type: JobType;
  readonly status: JobStatus;
  /** Register scope, when the job is register-specific (e.g. `fetch_publications`). */
  readonly registryCode: string | null;
  readonly attempt: number;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly error: string | null;
  /** Job-specific context: counts processed, checkpoints touched, etc. */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Input accepted when enqueueing/triggering a job run. */
export interface TriggerJobInput {
  readonly type: JobType;
  readonly registryCode?: string;
  /** Arbitrary parameters forwarded to the job runner (e.g. a specific `watchedTrademarkId` for a targeted re-score). */
  readonly params?: Readonly<Record<string, unknown>>;
}
