import type { TrademarkMatchScores } from '@merkwacht/domain';
import { SCORE_COMPONENTS } from './score-weights';

/** Returns the Dutch label of the highest-scoring weighted component (excl. AI footnote). */
export function highestScoreComponentLabel(scores: TrademarkMatchScores): string {
  let bestKey: keyof TrademarkMatchScores | null = null;
  let best = -1;
  for (const meta of SCORE_COMPONENTS) {
    if (meta.key === 'aiPlausibilityAdjustment') continue;
    const value = scores[meta.key] ?? 0;
    if (value > best) {
      best = value;
      bestKey = meta.key;
    }
  }
  return SCORE_COMPONENTS.find((c) => c.key === bestKey)?.labelNl ?? '—';
}
