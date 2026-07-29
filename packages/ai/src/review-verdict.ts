/**
 * AI explanation layer — verdict options only, no free 0-100 legal score invention.
 */

export type AiTrademarkReviewVerdict =
  | 'supports_result'
  | 'risk_should_be_slightly_higher'
  | 'risk_should_be_materially_higher'
  | 'risk_should_be_slightly_lower'
  | 'risk_should_be_materially_lower'
  | 'insufficient_information';

export interface AiTrademarkReview {
  readonly verdict: AiTrademarkReviewVerdict;
  readonly plainLanguageSummary: string;
  readonly signExplanation: readonly string[];
  readonly goodsServicesExplanation: readonly string[];
  readonly reasonsForConflict: readonly string[];
  readonly reasonsAgainstConflict: readonly string[];
  readonly uncertainties: readonly string[];
  readonly citedEvidenceIds: readonly string[];
  readonly confidence: number;
}

export const AI_EXPLANATION_PROMPT_VERSION = 'trademark-review-v2';

const VERDICT_SET = new Set<AiTrademarkReviewVerdict>([
  'supports_result',
  'risk_should_be_slightly_higher',
  'risk_should_be_materially_higher',
  'risk_should_be_slightly_lower',
  'risk_should_be_materially_lower',
  'insufficient_information',
]);

export function validateAiTrademarkReview(
  raw: unknown,
  allowedEvidenceIds: readonly string[],
): AiTrademarkReview | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.verdict !== 'string' || !VERDICT_SET.has(obj.verdict as AiTrademarkReviewVerdict)) {
    return null;
  }
  if (typeof obj.plainLanguageSummary !== 'string') return null;
  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) return null;

  const cited = Array.isArray(obj.citedEvidenceIds)
    ? obj.citedEvidenceIds.filter((id): id is string => typeof id === 'string')
    : [];
  const allowed = new Set(allowedEvidenceIds);
  if (cited.some((id) => !allowed.has(id))) return null;

  const asStringArray = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];

  return {
    verdict: obj.verdict as AiTrademarkReviewVerdict,
    plainLanguageSummary: obj.plainLanguageSummary,
    signExplanation: asStringArray(obj.signExplanation),
    goodsServicesExplanation: asStringArray(obj.goodsServicesExplanation),
    reasonsForConflict: asStringArray(obj.reasonsForConflict),
    reasonsAgainstConflict: asStringArray(obj.reasonsAgainstConflict),
    uncertainties: asStringArray(obj.uncertainties),
    citedEvidenceIds: cited,
    confidence: obj.confidence,
  };
}

/** Maps AI verdict to a small controlled legacy adjustment when explanation engine is on. */
export function verdictToLegacyAdjustment(verdict: AiTrademarkReviewVerdict): number {
  switch (verdict) {
    case 'risk_should_be_materially_higher':
      return 0.35;
    case 'risk_should_be_slightly_higher':
      return 0.15;
    case 'risk_should_be_slightly_lower':
      return -0.15;
    case 'risk_should_be_materially_lower':
      return -0.35;
    case 'insufficient_information':
      return 0;
    case 'supports_result':
    default:
      return 0;
  }
}
