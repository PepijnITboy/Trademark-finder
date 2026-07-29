import { normalizeMarkName } from '@merkwacht/normalization';
import { generatePhoneticRepresentations } from '@merkwacht/phonetics';
import type { NameResearchHitScores } from '@merkwacht/domain';
import { adviceBandFromRisk } from '@merkwacht/domain';
import { extractTrademarkFeatures } from '../features/extract-features.js';
import { assessRiskFromFeatures } from '../rules/assess-risk.js';
import type { ScoringContext } from '../scoring-context.js';
import type { CandidateApplication, WatchedTrademark } from '@merkwacht/domain';

/**
 * Shared-engine adapter for name research.
 * Maps feature/rules output onto existing NameResearchHitScores shape.
 * When `useSharedEngine` is false, callers should keep using domain clearanceRiskScore.
 */
export function clearanceRiskScoreViaSharedEngine(
  proposed: string,
  prior: string,
  classOverlap: boolean,
): NameResearchHitScores & {
  totalRiskScore: number;
  adviceBand: ReturnType<typeof adviceBandFromRisk>;
  featureVersion: string;
} {
  const watchedNormalized = normalizeMarkName(proposed);
  const candidateNormalized = normalizeMarkName(prior);
  const nice = classOverlap ? [9] : [9];
  const candidateNice = classOverlap ? [9] : [25];

  const watched = {
    id: 'nr-watched',
    organizationId: 'nr',
    label: proposed,
    status: 'active',
    eligibility: {
      eligible: true,
      reasonCode: 'eligible',
      reasonLabelNl: '',
      sourceStatus: 'registered',
      evaluatedAt: new Date().toISOString(),
      policyVersion: 'nr',
      warnings: [],
    },
    snapshot: {
      registryCode: 'BOIP',
      registrationNumber: 'NR-1',
      markText: proposed,
      markType: 'word',
      niceClasses: nice,
      applicantName: 'Proposed',
      filingDate: '2020-01-01',
      registrationDate: '2020-06-01',
      registerStatus: 'registered',
      lastCheckedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as WatchedTrademark;

  const candidate = {
    id: 'nr-cand',
    registryCode: 'BOIP',
    applicationNumber: 'NR-C-1',
    markText: prior,
    markType: 'word',
    niceClasses: candidateNice,
    applicantName: 'Prior',
    filingDate: '2018-01-01',
    publicationDate: '2018-02-01',
    proceduralStatus: 'published',
    oppositionDeadline: null,
    rawPayloadRef: null,
    fetchedAt: new Date().toISOString(),
  } as CandidateApplication;

  const context: ScoringContext = {
    watched,
    candidate,
    watchedNormalized,
    candidateNormalized,
    watchedPhonetic: generatePhoneticRepresentations(watchedNormalized.normalized),
    candidatePhonetic: generatePhoneticRepresentations(candidateNormalized.normalized),
    engineFlags: { goods_services_engine: true, shared_comparison_engine: true },
  };

  const { features, versions } = extractTrademarkFeatures(context);
  const risk = assessRiskFromFeatures(features);

  const textualSimilarity = Math.round(
    Math.max(features.orthographic.weightedEdit, features.orthographic.jaroWinkler) * 100,
  );
  const phoneticSimilarity = Math.round(features.phonetic.bestCodeSimilarity * 100);
  const visualSimilarity = Math.round(
    Math.max(features.orthographic.prefix, features.orthographic.suffix) * 100,
  );
  const niceClassOverlap = classOverlap ? 80 : 15;
  const totalRiskScore = Math.round(
    risk.riskValue * 0.7 +
      textualSimilarity * 0.15 +
      phoneticSimilarity * 0.1 +
      niceClassOverlap * 0.05,
  );

  return {
    textualSimilarity,
    phoneticSimilarity,
    visualSimilarity,
    niceClassOverlap,
    totalRiskScore: Math.min(100, Math.max(0, totalRiskScore)),
    adviceBand: adviceBandFromRisk(Math.min(100, Math.max(0, totalRiskScore))),
    featureVersion: versions.featureVersion,
  };
}
