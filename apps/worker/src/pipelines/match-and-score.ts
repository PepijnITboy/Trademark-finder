import type { CandidateApplication, TrademarkMatch, WatchedTrademark } from '@merkwacht/domain';
import { normalizeMarkName } from '@merkwacht/normalization';
import { generatePhoneticRepresentations, PHONETIC_LOCALES } from '@merkwacht/phonetics';
import { getActiveWeightProfile, scoreMatch, type ScoringContext } from '@merkwacht/scoring';
import { isWithinOppositionWindow } from './opposition-candidates.js';
import type { PipelineContext } from './types.js';

/**
 * Minimum `totalScore` (0-100) required for a scored pair to be persisted
 * as a `TrademarkMatch` at all. Deliberately conservative (low) so
 * borderline pairs remain visible — false negatives are worse than review noise.
 */
export const MATCH_CREATION_MIN_TOTAL_SCORE = 15;

function buildScoringContext(watched: WatchedTrademark, candidate: CandidateApplication): ScoringContext {
  const watchedNormalized = normalizeMarkName(watched.snapshot.markText);
  const candidateNormalized = normalizeMarkName(candidate.markText);
  const multilingual = contextEngineFlag(true);
  return {
    watched,
    candidate,
    watchedNormalized,
    candidateNormalized,
    watchedPhonetic: generatePhoneticRepresentations(
      watchedNormalized.normalized,
      multilingual ? PHONETIC_LOCALES : ['nl', 'en'],
    ),
    candidatePhonetic: generatePhoneticRepresentations(
      candidateNormalized.normalized,
      multilingual ? PHONETIC_LOCALES : ['nl', 'en'],
    ),
    engineFlags: {
      shared_comparison_engine: true,
      comparison_shadow_mode: true,
      goods_services_engine: true,
      multilingual_phonetics: multilingual,
    },
  };
}

function contextEngineFlag(_enabled: boolean): boolean {
  return true;
}

export interface ScoreAndUpsertResult {
  readonly match: TrademarkMatch | null;
  readonly isNew: boolean;
  readonly totalScore: number;
  readonly dropReason?: 'opposition_window' | 'below_threshold' | null;
}

export async function scoreAndUpsertMatch(
  context: PipelineContext,
  watched: WatchedTrademark,
  candidate: CandidateApplication,
  now: Date = new Date(),
): Promise<ScoreAndUpsertResult> {
  if (!isWithinOppositionWindow(candidate, now)) {
    return { match: null, isNew: false, totalScore: 0, dropReason: 'opposition_window' };
  }

  const scoringContext = buildScoringContext(watched, candidate);
  const result = await scoreMatch(scoringContext, {
    weightProfile: getActiveWeightProfile(),
    shadowMode: true,
    useRulesEngine: true,
    ...(context.ai ? { ai: context.ai } : {}),
  });

  if (result.totalScore < MATCH_CREATION_MIN_TOTAL_SCORE) {
    return { match: null, isNew: false, totalScore: result.totalScore, dropReason: 'below_threshold' };
  }

  const { record, isNew } = context.jobStore.upsertTrademarkMatch({
    watchedTrademarkId: watched.id,
    candidateApplicationId: candidate.id,
    scores: result.scores,
    totalScore: result.totalScore,
    weightProfileId: result.weightProfile.id,
  });

  return { match: record, isNew, totalScore: result.totalScore, dropReason: null };
}

export interface RunMatchJobsSummary {
  readonly processed: number;
  readonly matchesCreated: number;
  readonly matchesUpdated: number;
  readonly droppedBelowThreshold: number;
  readonly droppedOppositionWindow: number;
  readonly skippedMissing: number;
}

export async function runQueuedMatchJobs(context: PipelineContext): Promise<RunMatchJobsSummary> {
  const queued = context.jobStore.drainMatchJobQueue();
  let matchesCreated = 0;
  let matchesUpdated = 0;
  let droppedBelowThreshold = 0;
  let droppedOppositionWindow = 0;
  let skippedMissing = 0;

  for (const job of queued) {
    const watched = context.jobStore.getWatchedTrademark(job.watchedTrademarkId);
    const candidate = context.jobStore.getCandidateApplication(job.candidateApplicationId);
    if (!watched || !candidate) {
      skippedMissing += 1;
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
    } else if (result.dropReason === 'below_threshold') {
      droppedBelowThreshold += 1;
    } else if (result.dropReason === 'opposition_window') {
      droppedOppositionWindow += 1;
    }
  }

  return {
    processed: queued.length,
    matchesCreated,
    matchesUpdated,
    droppedBelowThreshold,
    droppedOppositionWindow,
    skippedMissing,
  };
}
