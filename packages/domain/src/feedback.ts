/**
 * Human feedback / labeling for offline training — never online learning.
 */

export type UserRelevanceFeedback =
  | 'relevant'
  | 'possibly_relevant'
  | 'not_relevant'
  | 'monitor'
  | 'send_to_lawyer'
  | 'duplicate'
  | 'wrong_territory'
  | 'goods_unrelated'
  | 'names_not_similar'
  | 'shared_element_descriptive'
  | 'other';

export type SignSimilarityLabel = 'identical' | 'high' | 'medium' | 'low' | 'none' | 'unknown';
export type GoodsServicesSimilarityLabel = 'identical' | 'high' | 'medium' | 'low' | 'none' | 'unknown';
export type LegalOutcomeLabel =
  | 'conflict_found'
  | 'possible_conflict'
  | 'no_conflict'
  | 'insufficient_information'
  | 'not_applicable';

export interface TrademarkHumanLabel {
  readonly id: string;
  readonly comparisonKey: string;
  readonly productMode: 'monitoring' | 'name_research';
  readonly pairLabel?: import('./comparison.js').TrademarkPairLabel;
  readonly signSimilarity?: SignSimilarityLabel;
  readonly goodsServicesSimilarity?: GoodsServicesSimilarityLabel;
  readonly legalOutcome?: LegalOutcomeLabel;
  readonly userFeedback?: UserRelevanceFeedback;
  readonly notes?: string;
  readonly reviewerId: string;
  readonly createdAt: string;
  readonly confidence?: number;
}

/** Simple agreement helper for evaluation harness (Cohen's kappa later). */
export function labelAgreementRate(a: readonly string[], b: readonly string[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 1;
  let agree = 0;
  for (let i = 0; i < n; i += 1) {
    if (a[i] === b[i]) agree += 1;
  }
  return agree / n;
}
