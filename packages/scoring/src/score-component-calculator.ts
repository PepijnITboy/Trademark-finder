import type { TrademarkMatchScores } from '@merkwacht/domain';
import type { ScoringContext } from './scoring-context.js';

/**
 * Computes a single, normalized `0..1` component of {@link TrademarkMatchScores}
 * (pre-weight). Kept as small, independently testable units — see
 * `docs/scoring/overview.md`.
 */
export interface ScoreComponentCalculator {
  readonly component: Exclude<keyof TrademarkMatchScores, 'aiPlausibilityAdjustment'>;
  calculate(context: ScoringContext): number;
}
