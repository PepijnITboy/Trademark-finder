import { describe, expect, it } from 'vitest';
import { validateAiTrademarkReview, verdictToLegacyAdjustment } from './review-verdict.js';

describe('AI trademark review verdict', () => {
  it('accepts a valid evidence-bound review', () => {
    const review = validateAiTrademarkReview(
      {
        verdict: 'supports_result',
        plainLanguageSummary: 'De namen lijken sterk op elkaar.',
        signExplanation: ['Zelfde lengte'],
        goodsServicesExplanation: [],
        reasonsForConflict: ['fonetiek'],
        reasonsAgainstConflict: [],
        uncertainties: [],
        citedEvidenceIds: ['E-PHONETIC-001'],
        confidence: 0.8,
      },
      ['E-PHONETIC-001'],
    );
    expect(review?.verdict).toBe('supports_result');
  });

  it('rejects cited evidence that was not provided', () => {
    const review = validateAiTrademarkReview(
      {
        verdict: 'supports_result',
        plainLanguageSummary: 'x',
        citedEvidenceIds: ['E-FAKE'],
        confidence: 0.5,
      },
      ['E-PHONETIC-001'],
    );
    expect(review).toBeNull();
  });

  it('maps verdicts to bounded adjustments', () => {
    expect(verdictToLegacyAdjustment('risk_should_be_materially_higher')).toBe(0.35);
    expect(Math.abs(verdictToLegacyAdjustment('supports_result'))).toBe(0);
  });
});
