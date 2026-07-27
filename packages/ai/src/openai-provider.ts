import { LEGAL_DISCLAIMER_NL, type TrademarkMatchScores } from '@merkwacht/domain';
import type { AiAdjustmentResult, AiEnrichmentPort, ScoringContext } from '@merkwacht/scoring';
import { AppError } from '@merkwacht/shared';
import { checkMonthlyBudget, DEFAULT_AI_MONTHLY_BUDGET_EUR } from './budget.js';
import { buildAiCacheKey, InMemoryAiResponseCache } from './cache.js';
import { AI_ASSESSMENT_SYSTEM_PROMPT_NL, AI_PROMPT_VERSION, AI_RATIONALE_DISCLAIMER_SUFFIX_NL, buildTrademarkMatchPrompt } from './prompt.js';
import type {
  AiAssessmentInput,
  AiAssessmentProvider,
  AiAssessmentResult,
  AiBudget,
  TrademarkAiAssessmentResult,
} from './types.js';
import { assessWithRetry } from './validate-assessment.js';

export interface OpenAiProviderOptions {
  apiKey?: string;
  model?: string;
  budget?: AiBudget;
  /** Monthly EUR spending cap checked via `checkMonthlyBudget` before every call. Defaults to `AI_MONTHLY_BUDGET_EUR`/5. */
  monthlyBudgetEur?: number;
  /**
   * Supplies the current calendar month's AI spend (in EUR) for a given
   * scope (workspace/organization id, or `'global'`). Defaults to always
   * reporting `0` spent - callers with real budget tracking (backed by
   * `ai_usage_records`) should inject this.
   */
  getMonthlyUsageEur?: (scope: string) => number | Promise<number>;
  /** Called after a successful API call with the estimated cost, so the caller can append it to `ai_usage_records`. */
  onUsageRecorded?: (usage: UsageRecordedEvent) => void;
  /** Injected response cache; defaults to a private, per-instance `InMemoryAiResponseCache`. */
  cache?: InMemoryAiResponseCache<TrademarkAiAssessmentResult>;
  fetchImpl?: typeof fetch;
}

export interface UsageRecordedEvent {
  readonly scope: string;
  readonly estimatedCostEur: number;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly model: string;
}

const DEFAULT_BUDGET: AiBudget = { maxTokensPerRequest: 800, maxRequestsPerDay: 200 };

/**
 * Approximate published per-token pricing (EUR, roughly converted from USD
 * list pricing) for supported models, used only to produce an
 * `estimated_cost_eur` for the usage ledger - see
 * `docs/scoring/ai-layer.md`'s "Cost estimation" section. Not billing-grade
 * precision; revisit once real invoices are available.
 */
const MODEL_PRICING_EUR_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.00013, output: 0.00052 },
  'gpt-4o': { input: 0.0046, output: 0.0138 },
};
const FALLBACK_PRICING = { input: 0.0005, output: 0.0015 };

interface OpenAiChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

function estimateCostEur(usage: OpenAiChatCompletionResponse['usage'], model: string): number {
  const pricing = MODEL_PRICING_EUR_PER_1K_TOKENS[model] ?? FALLBACK_PRICING;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  return (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
}

/**
 * Thin OpenAI adapter built on the global `fetch` API (no SDK dependency,
 * keeping this package lightweight). Implements both the generic
 * free-text {@link AiAssessmentProvider} contract and
 * `@merkwacht/scoring`'s {@link AiEnrichmentPort} (via
 * {@link OpenAiAssessmentProvider.adjust}), so `apps/worker` can wire a
 * single instance into `scoreMatch({ ai: provider })`.
 *
 * Every call to {@link assessTrademarkMatch} (and therefore `adjust`)
 * respects the monthly budget (`checkMonthlyBudget`), consults/populates a
 * response cache (`buildAiCacheKey`), validates the model's structured
 * output (`assessWithRetry`/`validateAssessment`), and never throws back
 * out of `adjust` - any failure degrades to `null` (no adjustment), per
 * `docs/scoring/ai-layer.md`'s failure-mode table.
 */
export class OpenAiAssessmentProvider implements AiAssessmentProvider, AiEnrichmentPort {
  readonly name = 'openai';
  readonly budget: AiBudget;
  private readonly apiKey: string | undefined;
  private readonly model: string;
  private readonly monthlyBudgetEur: number;
  private readonly getMonthlyUsageEur: (scope: string) => number | Promise<number>;
  private readonly onUsageRecorded: OpenAiProviderOptions['onUsageRecorded'];
  private readonly cache: InMemoryAiResponseCache<TrademarkAiAssessmentResult>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAiProviderOptions = {}) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'gpt-4o-mini';
    this.budget = options.budget ?? DEFAULT_BUDGET;
    this.monthlyBudgetEur = options.monthlyBudgetEur ?? DEFAULT_AI_MONTHLY_BUDGET_EUR;
    this.getMonthlyUsageEur = options.getMonthlyUsageEur ?? (() => 0);
    this.onUsageRecorded = options.onUsageRecorded;
    this.cache = options.cache ?? new InMemoryAiResponseCache<TrademarkAiAssessmentResult>();
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Generic free-text assessment, kept for callers that only need a short narrative rather than a structured scoring adjustment. */
  async assess(input: AiAssessmentInput): Promise<AiAssessmentResult> {
    if (!this.apiKey) {
      throw new AppError({
        code: 'AI_NOT_CONFIGURED',
        messageNl: 'AI-beoordeling is niet beschikbaar omdat er geen OpenAI API-sleutel is ingesteld.',
        category: 'CONFIGURATION',
      });
    }

    try {
      const response = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: this.budget.maxTokensPerRequest,
          messages: [
            {
              role: 'system',
              content: 'Je beoordeelt het risico van merkconflicten in het Nederlands, beknopt en zakelijk.',
            },
            {
              role: 'user',
              content: `Bewaakt merk: ${input.watchedTrademarkName}\nKandidaat: ${input.candidateTrademarkName}\nNice-klassen: ${input.niceClasses.join(', ')}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new AppError({
          code: 'AI_REQUEST_FAILED',
          messageNl: 'De AI-beoordeling kon niet worden opgehaald bij de externe dienst.',
          category: 'EXTERNAL_SERVICE',
          details: { status: response.status },
        });
      }

      const payload = (await response.json()) as OpenAiChatCompletionResponse;
      const summaryNl = payload.choices?.[0]?.message?.content?.trim() ?? 'Geen samenvatting beschikbaar.';

      return {
        summaryNl: `${summaryNl}\n\n${LEGAL_DISCLAIMER_NL}`,
        riskLevel: 'MEDIUM',
        confidence: 0.5,
        tokensUsed: payload.usage?.total_tokens,
      };
    } catch (error) {
      throw AppError.fromUnknown(error, {
        code: 'AI_REQUEST_FAILED',
        messageNl: 'De AI-beoordeling kon niet worden uitgevoerd.',
        category: 'EXTERNAL_SERVICE',
      });
    }
  }

  /**
   * Structured, budget- and cache-aware assessment of a single
   * `(watched, candidate)` pair, scoped by `scope` (typically the watched
   * trademark's `organizationId`) for budget accounting. Returns `null`
   * (never throws) when: the provider isn't configured, the monthly budget
   * is exhausted, or the provider/validation ultimately fails after one
   * retry - see `docs/scoring/ai-layer.md`'s failure-mode table. Never
   * mutates or overrides `ruleBasedScores`; it only ever produces an
   * additional, separately-weighted `adjustment`.
   */
  async assessTrademarkMatch(
    context: ScoringContext,
    ruleBasedScores: Omit<TrademarkMatchScores, 'aiPlausibilityAdjustment'>,
    scope: string,
  ): Promise<TrademarkAiAssessmentResult | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const usedEur = await this.getMonthlyUsageEur(scope);
    const budgetStatus = checkMonthlyBudget(scope, usedEur, this.monthlyBudgetEur);
    if (!budgetStatus.canProceed) {
      return null;
    }

    const cacheKey = buildAiCacheKey({
      watchedMarkText: context.watched.snapshot.markText,
      candidateMarkText: context.candidate.markText,
      niceClasses: context.candidate.niceClasses,
      promptVersion: AI_PROMPT_VERSION,
      model: this.model,
    });
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const result = await assessWithRetry(() => this.requestStructuredAssessment(context, ruleBasedScores, scope));
      this.cache.set(cacheKey, result);
      return result;
    } catch {
      // Every failure mode (config, request, validation, retry-exhausted)
      // degrades to "no adjustment" here - the caller must never fail the
      // surrounding scoring job because of the AI layer.
      return null;
    }
  }

  /** `AiEnrichmentPort` implementation, wiring `assessTrademarkMatch` into `@merkwacht/scoring`'s pipeline. */
  async adjust(
    context: ScoringContext,
    ruleBasedScores: Omit<TrademarkMatchScores, 'aiPlausibilityAdjustment'>,
  ): Promise<AiAdjustmentResult | null> {
    const result = await this.assessTrademarkMatch(context, ruleBasedScores, context.watched.organizationId);
    if (!result) return null;
    return { adjustment: result.adjustment, rationale: result.rationaleNl };
  }

  private async requestStructuredAssessment(
    context: ScoringContext,
    ruleBasedScores: Omit<TrademarkMatchScores, 'aiPlausibilityAdjustment'>,
    scope: string,
  ): Promise<unknown> {
    if (!this.apiKey) {
      throw new AppError({
        code: 'AI_NOT_CONFIGURED',
        messageNl: 'AI-beoordeling is niet beschikbaar omdat er geen OpenAI API-sleutel is ingesteld.',
        category: 'CONFIGURATION',
      });
    }

    const response = await this.fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.budget.maxTokensPerRequest,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: AI_ASSESSMENT_SYSTEM_PROMPT_NL },
          { role: 'user', content: buildTrademarkMatchPrompt(context, ruleBasedScores) },
        ],
      }),
    });

    if (!response.ok) {
      throw new AppError({
        code: 'AI_REQUEST_FAILED',
        messageNl: 'De AI-beoordeling kon niet worden opgehaald bij de externe dienst.',
        category: 'EXTERNAL_SERVICE',
        details: { status: response.status },
      });
    }

    const payload = (await response.json()) as OpenAiChatCompletionResponse;
    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new AppError({
        code: 'AI_REQUEST_FAILED',
        messageNl: 'De AI-provider gaf een leeg antwoord terug.',
        category: 'EXTERNAL_SERVICE',
      });
    }

    this.onUsageRecorded?.({
      scope,
      estimatedCostEur: estimateCostEur(payload.usage, this.model),
      promptTokens: payload.usage?.prompt_tokens ?? 0,
      completionTokens: payload.usage?.completion_tokens ?? 0,
      model: this.model,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new AppError({
        code: 'AI_ASSESSMENT_INVALID',
        messageNl: 'Het antwoord van de AI-provider was geen geldige JSON.',
        category: 'EXTERNAL_SERVICE',
        cause: error,
      });
    }

    return appendDisclaimer(parsed);
  }
}

/**
 * Guarantees {@link AI_RATIONALE_DISCLAIMER_SUFFIX_NL} is present in
 * `rationaleNl` regardless of the model's compliance, before the response
 * is validated. Leaves non-object/malformed payloads untouched - they will
 * simply fail `validateAssessment` as expected.
 */
function appendDisclaimer(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw;
  }
  const record = raw as Record<string, unknown>;
  if (typeof record['rationaleNl'] !== 'string') {
    return raw;
  }
  const trimmed = record['rationaleNl'].trim();
  const alreadyPresent = trimmed.includes(AI_RATIONALE_DISCLAIMER_SUFFIX_NL);
  return {
    ...record,
    rationaleNl: alreadyPresent ? trimmed : `${trimmed} ${AI_RATIONALE_DISCLAIMER_SUFFIX_NL}`,
  };
}
