import type { CandidateApplication, RegisteredTrademarkSnapshot, WatchedTrademark } from '@merkwacht/domain';
import { normalizeMarkName } from '@merkwacht/normalization';
import { generatePhoneticRepresentations } from '@merkwacht/phonetics';
import { describe, expect, it } from 'vitest';
import type { ScoringContext } from './scoring-context.js';
import { scoreMatch } from './scoring-pipeline.js';

/** Builds a minimal, valid {@link ScoringContext} comparing `watchedMark` against `candidateMark`. */
function buildContext(
  watchedMark: string,
  candidateMark: string,
  options: { niceClasses?: readonly number[]; candidateNiceClasses?: readonly number[] } = {},
): ScoringContext {
  const niceClasses = options.niceClasses ?? [9, 42];
  const candidateNiceClasses = options.candidateNiceClasses ?? niceClasses;

  const snapshot: RegisteredTrademarkSnapshot = {
    registryCode: 'BOIP',
    registrationNumber: 'BX-0000000001',
    markText: watchedMark,
    markType: 'word',
    niceClasses,
    applicantName: 'Test Houder B.V.',
    filingDate: '2022-01-01',
    registrationDate: '2022-06-01',
    registerStatus: 'registered',
    lastCheckedAt: '2026-01-01T00:00:00.000Z',
  };

  const watched: WatchedTrademark = {
    id: 'watched-1',
    organizationId: 'org-1',
    label: watchedMark,
    status: 'active',
    eligibility: {
      eligible: true,
      reasonCode: 'eligible',
      reasonLabelNl: 'Dit merk komt in aanmerking voor bewaking.',
      sourceStatus: 'registered',
      evaluatedAt: '2026-01-01T00:00:00.000Z',
      policyVersion: 'boip-v1',
      warnings: [],
    },
    snapshot,
    createdAt: '2022-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const candidate: CandidateApplication = {
    id: 'candidate-1',
    registryCode: 'BOIP',
    applicationNumber: 'BX-2026-0000001',
    markText: candidateMark,
    markType: 'word',
    niceClasses: candidateNiceClasses,
    applicantName: 'Andere Aanvrager B.V.',
    filingDate: '2026-01-01',
    publicationDate: '2026-01-15',
    proceduralStatus: 'published',
    oppositionDeadline: null,
    rawPayloadRef: null,
    fetchedAt: '2026-01-15T00:00:00.000Z',
  };

  const watchedNormalized = normalizeMarkName(watchedMark);
  const candidateNormalized = normalizeMarkName(candidateMark);

  return {
    watched,
    candidate,
    watchedNormalized,
    candidateNormalized,
    watchedPhonetic: generatePhoneticRepresentations(watchedNormalized.normalized),
    candidatePhonetic: generatePhoneticRepresentations(candidateNormalized.normalized),
  };
}

async function scorePair(watchedMark: string, candidateMark: string): Promise<number> {
  const result = await scoreMatch(buildContext(watchedMark, candidateMark));
  return result.totalScore;
}

describe('scoreMatch - close variants score notably higher than unrelated names', () => {
  const CLOSE_VARIANT_PAIRS: ReadonlyArray<readonly [string, string]> = [
    ['LUMARO', 'LUMAROO'],
    ['LUMARO', 'LUMERO'],
    ['NORTHVALE', 'NORTH VALE'],
    ['VANTERO', 'VANTER0'],
    ['BLUE HARBOR', 'HARBOR BLUE'],
  ];

  const UNRELATED_BASELINE_SCORE_PROMISE = scorePair('LUMARO', 'KASTORIN');

  it.each(CLOSE_VARIANT_PAIRS)('%s vs %s scores higher than an unrelated pair', async (watchedMark, candidateMark) => {
    const closeScore = await scorePair(watchedMark, candidateMark);
    const unrelatedScore = await UNRELATED_BASELINE_SCORE_PROMISE;

    expect(closeScore).toBeGreaterThan(unrelatedScore);
  });

  it('identical mark text scores at (or extremely near) the maximum achievable score', async () => {
    const score = await scorePair('LUMARO', 'LUMARO');
    // aiPlausibilityAdjustment/semanticSimilarity/goodsServicesOverlap all
    // default to 0 without AI/goods-services data, so 100 is not
    // achievable purely from rule-based components - see weight-profile.ts.
    expect(score).toBeGreaterThan(80);
  });

  it('a clearly distinct, unrelated mark name scores low', async () => {
    const result = await scoreMatch(
      buildContext('LUMARO', 'KASTORIN', { niceClasses: [9, 42], candidateNiceClasses: [29, 30] }),
    );
    expect(result.totalScore).toBeLessThan(30);
  });

  it('typo-squatted digit substitution (O -> 0) still scores as a meaningful match', async () => {
    const score = await scorePair('VANTERO', 'VANTER0');
    expect(score).toBeGreaterThan(50);
  });

  it('word-order swap still benefits from full token overlap', async () => {
    const swapped = await scorePair('BLUE HARBOR', 'HARBOR BLUE');
    const unrelated = await scorePair('BLUE HARBOR', 'ZENDRIA');
    expect(swapped).toBeGreaterThan(unrelated);
  });

  it('mismatched Nice classes reduce the total score relative to identical classes', async () => {
    const overlapping = await scoreMatch(buildContext('LUMARO', 'LUMAROO', { niceClasses: [9, 42] }));
    const nonOverlapping = await scoreMatch(
      buildContext('LUMARO', 'LUMAROO', { niceClasses: [9, 42], candidateNiceClasses: [25, 30] }),
    );
    expect(nonOverlapping.totalScore).toBeLessThan(overlapping.totalScore);
  });
});
