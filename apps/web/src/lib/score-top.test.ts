import { describe, expect, it } from 'vitest';
import { highestScoreComponentLabel } from './score-top';

describe('highestScoreComponentLabel', () => {
  it('picks the strongest non-AI component', () => {
    expect(
      highestScoreComponentLabel({
        textualSimilarity: 40,
        phoneticSimilarity: 90,
        visualSimilarity: 10,
        niceClassOverlap: 20,
        goodsServicesOverlap: 5,
        semanticSimilarity: 0,
        geographicOverlap: 0,
        aiPlausibilityAdjustment: 99,
      }),
    ).toBe('Fonetische gelijkenis');
  });
});
