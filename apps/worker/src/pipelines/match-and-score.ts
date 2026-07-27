import type { CandidateApplication, TrademarkMatch, WatchedTrademark } from '@merkwacht/domain';
import { normalizeMarkName } from '@merkwacht/normalization';
import { generatePhoneticRepresentations } from '@merkwacht/phonetics';
import { scoreMatch, type ScoringContext } from '@merkwacht/scoring';
import type { PipelineContext } from './types.js';

/**
 * Minimum `totalScore` (0-100) required for a scored pair to be persisted
 * as a `TrademarkMatch` at all. This is the "pre-filter" referenced by
 * `docs/operations/daily-jobs.md`'s `match_candidates` step, applied after
 * scoring (rather than before) since `@merkwacht/scoring` is already cheap
 * and deterministic without AI. Deliberately conservative (low) so
 * borderline pairs remain visible to the customer for manual review rather
 * than silently disappearing - false negatives are worse than review-queue
 * noise for a monitoring product. Revisit once real usage data exists.
 */
export const MATCH_CREATION_MIN_TOTAL_SCORE = 15;

function buildScoringContext(watched: WatchedTrademark, candidate: CandidateApplication): ScoringContext {
  const watchedNormalized = normalizeMarkName(watched.snapshot.markText);
  const candidateNormalized = normalizeMarkName(candidate.markText);
  return {
    watched,
    candidate,
    watchedNormalized,
    candidateNormalized,
    watchedPhonetic: generatePhoneticRepresentations(watchedNormalized.normalized),
    candidatePhonetic: generatePhoneticRepresentations(candidateNormalized.normalized),
  };
}

export interface ScoreAndUpsertResult {
  readonly match: TrademarkMatch | null;
  readonly isNew: boolean;
  readonly totalScore: number;
}

/**
 * Runs the full `@merkwacht/scoring` pipeline for a single `(watched,
 * candidate)` pair and, when `totalScore` clears
 * {@link MATCH_CREATION_MIN_TOTAL_SCORE}, upserts the resulting
 * `TrademarkMatch`. When an AI adjustment was produced, its estimated cost
 * has already been recorded onto `context.jobStore`'s usage ledger by the
 * `onUsageRecorded` callback wired in `apps/worker/src/context.ts` - this
 * function only needs to run the pipeline and persist the outcome.
 */
export async function scoreAndUpsertMatch(
  context: PipelineContext,
  watched: WatchedTrademark,
  candidate: CandidateApplication,
): Promise<ScoreAndUpsertResult> {
  const scoringContext = buildScoringContext(watched, candidate);
  const result = await scoreMatch(scoringContext, context.ai ? { ai: context.ai } : {});

  if (result.totalScore < MATCH_CREATION_MIN_TOTAL_SCORE) {
    return { match: null, isNew: false, totalScore: result.totalScore };
  }

  const { record, isNew } = context.jobStore.upsertTrademarkMatch({
    watchedTrademarkId: watched.id,
    candidateApplicationId: candidate.id,
    scores: result.scores,
    totalScore: result.totalScore,
    weightProfileId: result.weightProfile.id,
  });

  return { match: record, isNew, totalScore: result.totalScore };
}

export interface RunMatchJobsSummary {
  readonly processed: number;
  readonly matchesCreated: number;
  readonly matchesUpdated: number;
}

/**
 * Drains `context.jobStore`'s match job queue (populated by
 * `enqueueMatchJob` in `daily-sync-pipeline.ts` /
 * `initial-opposition-scan-pipeline.ts`) and scores every queued pair. This
 * stands in for a real `MATCH_CANDIDATE_BATCH`/`SCORE_MATCH` queue consumer
 * (see `docs/operations/daily-jobs.md`) - since `apps/worker`'s poller has
 * no real broker yet, the ingestion pipelines call this inline so a single
 * `REGISTER_SYNC` run is end-to-end visible. The standalone
 * `MATCH_CANDIDATE_BATCH`/`SCORE_MATCH` job handlers call this same
 * function so they remain independently triggerable from `/platform`, per
 * that doc's "Manual/on-demand runs" section.
 */
export async function runQueuedMatchJobs(context: PipelineContext): Promise<RunMatchJobsSummary> {
  const queued = context.jobStore.drainMatchJobQueue();
  let matchesCreated = 0;
  let matchesUpdated = 0;

  for (const job of queued) {
    const watched = context.jobStore.getWatchedTrademark(job.watchedTrademarkId);
    const candidate = context.jobStore.getCandidateApplication(job.candidateApplicationId);
    if (!watched || !candidate) {
      context.logger.warn('Match-taak overgeslagen: bewaakt merk of kandidaat niet gevonden.', {
        watchedTrademarkId: job.watchedTrademarkId,
        candidateApplicationId: job.candidateApplicationId,
      });
      continue;
    }

    const result = await scoreAndUpsertMatch(context, watched, candidate.application);
    if (result.match) {
      if (result.isNew) matchesCreated += 1;
      else matchesUpdated += 1;
    }
  }

  return { processed: queued.length, matchesCreated, matchesUpdated };
}
