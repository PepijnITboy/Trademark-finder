import type { CandidateApplication, RegisteredTrademarkSnapshot, WatchedTrademark } from '@merkwacht/domain';
import { normalizeMarkName } from '@merkwacht/normalization';
import { generatePhoneticRepresentations } from '@merkwacht/phonetics';
import { describe, expect, it } from 'vitest';
import { extractTrademarkFeatures } from './features/extract-features.js';
import type { ScoringContext } from './scoring-context.js';
import { scoreMatch } from './scoring-pipeline.js';

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

/** Locked baselines — do not change without explicit approval (legacy scoreMatch contract). */
describe('scoreMatch baseline lock', () => {
  const CASES: ReadonlyArray<{ left: string; right: string; min?: number; max?: number; exact?: number }> =
    [
      { left: 'LUMARO', right: 'LUMARO', min: 80 },
      { left: 'LUMARO', right: 'LUMAROO', min: 40 },
      { left: 'LUMARO', right: 'KASTORIN', max: 35 },
      { left: 'VANTERO', right: 'VANTER0', min: 50 },
    ];

  it.each(CASES)('$left vs $right stays within baseline band', async ({ left, right, min, max }) => {
    const result = await scoreMatch(buildContext(left, right));
    if (min !== undefined) expect(result.totalScore).toBeGreaterThanOrEqual(min);
    if (max !== undefined) expect(result.totalScore).toBeLessThanOrEqual(max);
  });

  it('shadow mode does not change legacy totalScore', async () => {
    const ctx = buildContext('ZENZO', 'SENZO');
    const legacy = await scoreMatch(ctx);
    const shadow = await scoreMatch(ctx, { shadowMode: true });
    expect(shadow.totalScore).toBe(legacy.totalScore);
    expect(shadow.shadow).toBeDefined();
    expect(shadow.shadow!.features.orthographic.levenshtein).toBeGreaterThan(0.7);
    expect(shadow.shadow!.risk.riskBand).toBeDefined();
  });
});

describe('golden feature activation §24', () => {
  it('ZENZO / ZENZO activates exact normalized', () => {
    const { features, evidence } = extractTrademarkFeatures(buildContext('ZENZO', 'ZENZO'));
    expect(features.exact.normalized).toBe(1);
    expect(evidence.some((e) => e.type === 'normalized_exact_match')).toBe(true);
  });

  it('ZENZO / SENZO activates high weighted edit / phonetic path', () => {
    const { features } = extractTrademarkFeatures(buildContext('ZENZO', 'SENZO'));
    expect(features.orthographic.weightedEdit).toBeGreaterThan(0.8);
    expect(features.orthographic.levenshtein).toBeGreaterThan(0.75);
  });

  it('ZENZO / ZEN-ZO and ZEN SO compact toward same form', () => {
    const hyphen = extractTrademarkFeatures(buildContext('ZENZO', 'ZEN-ZO'));
    const spaced = extractTrademarkFeatures(buildContext('ZENZO', 'ZEN SO'));
    expect(hyphen.features.exact.compact).toBe(1);
    expect(spaced.features.orthographic.prefix).toBeGreaterThan(0.4);
    expect(spaced.features.orthographic.trigram).toBeGreaterThan(0);
  });

  it('CAFÉ / CAFE folds diacritics for exact normalized', () => {
    const { features } = extractTrademarkFeatures(buildContext('CAFÉ', 'CAFE'));
    expect(features.exact.normalized).toBe(1);
  });

  it('PHLOX / FLOKS activates weighted multi-char path', () => {
    const { features } = extractTrademarkFeatures(buildContext('PHLOX', 'FLOKS'));
    expect(features.orthographic.weightedEdit).toBeGreaterThan(0.65);
  });
});
