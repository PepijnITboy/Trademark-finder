export interface AiAssessmentInput {
  watchedTrademarkName: string;
  candidateTrademarkName: string;
  niceClasses: number[];
  locale?: string;
}

export type AiRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AiAssessmentResult {
  summaryNl: string;
  riskLevel: AiRiskLevel;
  /** 0-1 confidence estimate. */
  confidence: number;
  tokensUsed?: number | undefined;
}

/** Per-organization or per-provider budget guardrails for AI usage. */
export interface AiBudget {
  maxTokensPerRequest: number;
  maxRequestsPerDay: number;
}

export interface AiUsage {
  requestsToday: number;
  tokensToday: number;
}

export interface AiAssessmentProvider {
  readonly name: string;
  isConfigured(): boolean;
  assess(input: AiAssessmentInput): Promise<AiAssessmentResult>;
}

/**
 * Structured result of a single trademark-pair AI assessment, as returned
 * by `OpenAiAssessmentProvider.assessTrademarkMatch` and validated by
 * `validate-assessment.ts` before it is trusted. This is the shape stored
 * (after validation) as the AI contribution to a `TrademarkMatch` — never
 * a replacement for any rule-based `TrademarkMatchScores` component. See
 * `docs/scoring/ai-layer.md`.
 */
export interface TrademarkAiAssessmentResult {
  /** Signed adjustment in `[-1, 1]`; the pipeline clamps this again before weighting, this is belt-and-suspenders validation at the AI boundary. */
  readonly adjustment: number;
  /** Dutch rationale, screened against `@merkwacht/domain`'s `findForbiddenLanguage` and required to carry a short disclaimer note before being trusted for customer display. */
  readonly rationaleNl: string;
  /** 0-1 confidence estimate self-reported by the model. */
  readonly confidence: number;
  readonly riskLevel: AiRiskLevel;
}
