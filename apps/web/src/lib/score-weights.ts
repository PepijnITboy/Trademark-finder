import type { TrademarkMatchScores } from '@merkwacht/domain';

/**
 * Display metadata for each {@link TrademarkMatchScores} component: a Dutch
 * label plus its weight (0-100) in the default (`v1`) scoring profile — see
 * `packages/scoring/src/weight-profile.ts`. Kept as static display data
 * rather than importing `@merkwacht/scoring` at runtime, since the UI only
 * needs to render the already-persisted `scores`/`totalScore`, never
 * recompute them.
 */
export interface ScoreComponentMeta {
  readonly key: keyof TrademarkMatchScores;
  readonly labelNl: string;
  readonly weight: number;
}

export const SCORE_COMPONENTS: readonly ScoreComponentMeta[] = [
  { key: 'textualSimilarity', labelNl: 'Tekstuele gelijkenis', weight: 25 },
  { key: 'phoneticSimilarity', labelNl: 'Fonetische gelijkenis', weight: 22 },
  { key: 'niceClassOverlap', labelNl: 'Overlap Nice-klassen', weight: 17 },
  { key: 'visualSimilarity', labelNl: 'Visuele gelijkenis', weight: 13 },
  { key: 'goodsServicesOverlap', labelNl: 'Overlap waren en diensten', weight: 8 },
  { key: 'semanticSimilarity', labelNl: 'Semantische gelijkenis', weight: 8 },
  { key: 'geographicOverlap', labelNl: 'Geografische overlap', weight: 4 },
  { key: 'aiPlausibilityAdjustment', labelNl: 'AI-plausibiliteitscorrectie', weight: 3 },
];

export const SCORE_WEIGHT_PROFILE_ID = 'v1';
