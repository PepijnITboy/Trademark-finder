import type { MatchStatus } from './statuses.js';

/**
 * Explainable, per-component breakdown of a match's similarity/relevance.
 * Every component is a normalized `0..1` value (pre-weight), except
 * `aiPlausibilityAdjustment` which is a signed `-1..1` adjustment — see
 * `docs/scoring/weights.md` and `docs/scoring/ai-layer.md`. Persisted
 * verbatim so the UI can render a full breakdown without recomputation.
 */
export interface TrademarkMatchScores {
  readonly textualSimilarity: number;
  readonly phoneticSimilarity: number;
  readonly visualSimilarity: number;
  readonly semanticSimilarity: number;
  readonly niceClassOverlap: number;
  readonly goodsServicesOverlap: number;
  readonly geographicOverlap: number;
  readonly aiPlausibilityAdjustment: number;
}

/**
 * The computed, customer-facing relationship between one `WatchedTrademark`
 * and one `CandidateApplication`. Unique per
 * `(watchedTrademarkId, candidateApplicationId)` pair. See
 * `docs/domain/trademark-model.md` and `docs/domain/opposition-workflow.md`.
 */
export interface TrademarkMatch {
  readonly id: string;
  readonly watchedTrademarkId: string;
  readonly candidateApplicationId: string;
  readonly status: MatchStatus;
  readonly scores: TrademarkMatchScores;
  /** Weighted sum of `scores`, 0-100. See `docs/scoring/weights.md`. */
  readonly totalScore: number;
  /** Identifier of the `ScoringWeightProfile` that produced `totalScore`. */
  readonly weightProfileId: string;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
