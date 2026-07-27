import { AppError } from '@merkwacht/shared';
import { scoreAndUpsertMatch } from '../pipelines/match-and-score.js';
import type { JobContext } from './register-sync.js';

export interface AiAssessMatchPayload {
  readonly matchId: string;
}

/**
 * AI_ASSESS_MATCH: re-runs {@link scoreAndUpsertMatch} for a single match
 * that a customer escalated (`advisor_requested`) or that scored in an
 * ambiguous mid-range, so `@merkwacht/ai`'s `OpenAiAssessmentProvider`
 * (wired as `context.ai` in `apps/worker/src/context.ts`) gets a chance to
 * produce its bounded `aiPlausibilityAdjustment`. A no-op (logged, not an
 * error) when no AI provider is configured for this environment - see
 * `docs/scoring/ai-layer.md`'s "fully functional without AI" contract.
 */
export async function handleAiAssessMatch(payload: AiAssessMatchPayload, context: JobContext): Promise<void> {
  if (!context.ai) {
    context.logger.info('AI_ASSESS_MATCH overgeslagen: geen AI-provider geconfigureerd voor deze omgeving.', {
      matchId: payload.matchId,
    });
    return;
  }

  const match = context.jobStore.getTrademarkMatchById(payload.matchId);
  if (!match) {
    throw new AppError({
      code: 'MATCH_NOT_FOUND',
      messageNl: `Kan AI_ASSESS_MATCH niet uitvoeren: match "${payload.matchId}" bestaat niet.`,
      category: 'NOT_FOUND',
    });
  }

  const watched = context.jobStore.getWatchedTrademark(match.watchedTrademarkId);
  const candidate = context.jobStore.getCandidateApplication(match.candidateApplicationId);
  if (!watched || !candidate) {
    throw new AppError({
      code: 'MATCH_DEPENDENCY_MISSING',
      messageNl: `Kan AI_ASSESS_MATCH niet uitvoeren: bewaakt merk of kandidaat voor match "${payload.matchId}" ontbreekt.`,
      category: 'NOT_FOUND',
    });
  }

  const result = await scoreAndUpsertMatch(context, watched, candidate.application);
  context.logger.info('AI_ASSESS_MATCH taak afgerond.', {
    matchId: payload.matchId,
    aiPlausibilityAdjustment: result.match?.scores.aiPlausibilityAdjustment ?? null,
    totalScore: result.totalScore,
  });
}
