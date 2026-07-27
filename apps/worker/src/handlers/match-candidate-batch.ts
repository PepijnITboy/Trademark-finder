import { buildMatchJobIdempotencyKey } from '../pipelines/idempotency.js';
import { runQueuedMatchJobs } from '../pipelines/match-and-score.js';
import type { JobContext } from './register-sync.js';

export interface MatchCandidateBatchPayload {
  readonly registryCode: string;
}

/**
 * MATCH_CANDIDATE_BATCH: an on-demand full re-match sweep for one register
 * (see `docs/operations/daily-jobs.md`'s "Manual/on-demand runs" section) -
 * enqueues every `(active eligible watched trademark, candidate
 * application)` pair in `payload.registryCode` (deduped via the same
 * `sourceHash`-based idempotency key the ingestion pipelines use, so
 * re-running this doesn't re-score unchanged pairs already queued/handled
 * this run), then drains the queue via `runQueuedMatchJobs`. In normal
 * operation the ingestion pipelines (`daily-sync-pipeline.ts` /
 * `initial-opposition-scan-pipeline.ts`) already enqueue+drain matches
 * inline; this handler exists for the standalone re-trigger case.
 */
export async function handleMatchCandidateBatch(
  payload: MatchCandidateBatchPayload,
  context: JobContext,
): Promise<void> {
  const watchedTrademarks = context.jobStore
    .listActiveEligibleWatchedTrademarks()
    .filter((watched) => watched.snapshot.registryCode === payload.registryCode);
  const candidates = context.jobStore
    .listCandidateApplications()
    .filter((stored) => stored.application.registryCode === payload.registryCode);

  let enqueuedCount = 0;
  for (const watched of watchedTrademarks) {
    for (const stored of candidates) {
      const idempotencyKey = buildMatchJobIdempotencyKey(watched.id, stored.application.id, stored.sourceHash);
      if (context.jobStore.enqueueMatchJob(watched.id, stored.application.id, idempotencyKey)) {
        enqueuedCount += 1;
      }
    }
  }

  const summary = await runQueuedMatchJobs(context);
  context.logger.info('MATCH_CANDIDATE_BATCH taak afgerond.', {
    registryCode: payload.registryCode,
    watchedCount: watchedTrademarks.length,
    candidateCount: candidates.length,
    enqueuedCount,
    ...summary,
  });
}
