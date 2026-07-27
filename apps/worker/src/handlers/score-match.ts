import { AppError } from '@merkwacht/shared';
import { scoreAndUpsertMatch } from '../pipelines/match-and-score.js';
import type { JobContext } from './register-sync.js';

export interface ScoreMatchPayload {
  readonly matchId: string;
}

/**
 * SCORE_MATCH: re-runs the scoring pipeline for one existing
 * `TrademarkMatch` on demand (see `docs/operations/daily-jobs.md`'s
 * "Manual/on-demand runs" - typically used to debug an unexpected result
 * for a specific match without waiting for the next scheduled run).
 */
export async function handleScoreMatch(payload: ScoreMatchPayload, context: JobContext): Promise<void> {
  const match = context.jobStore.getTrademarkMatchById(payload.matchId);
  if (!match) {
    throw new AppError({
      code: 'MATCH_NOT_FOUND',
      messageNl: `Kan SCORE_MATCH niet uitvoeren: match "${payload.matchId}" bestaat niet.`,
      category: 'NOT_FOUND',
    });
  }

  const watched = context.jobStore.getWatchedTrademark(match.watchedTrademarkId);
  const candidate = context.jobStore.getCandidateApplication(match.candidateApplicationId);
  if (!watched || !candidate) {
    throw new AppError({
      code: 'MATCH_DEPENDENCY_MISSING',
      messageNl: `Kan SCORE_MATCH niet uitvoeren: bewaakt merk of kandidaat voor match "${payload.matchId}" ontbreekt.`,
      category: 'NOT_FOUND',
    });
  }

  const result = await scoreAndUpsertMatch(context, watched, candidate.application);
  context.logger.info('SCORE_MATCH taak afgerond.', {
    matchId: payload.matchId,
    totalScore: result.totalScore,
    persisted: result.match !== null,
  });
}
