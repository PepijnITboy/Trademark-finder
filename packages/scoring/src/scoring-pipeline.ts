import type { TrademarkMatchScores } from '@merkwacht/domain';
import type { AiEnrichmentPort } from './ai-enrichment-port.js';
import { DEFAULT_SCORE_COMPONENT_CALCULATORS } from './default-calculators.js';
import type { ScoreComponentCalculator } from './score-component-calculator.js';
import type { ScoringContext } from './scoring-context.js';
import { DEFAULT_WEIGHT_PROFILE, type ScoringWeightProfile } from './weight-profile.js';

export interface ScoreMatchOptions {
  readonly weightProfile?: ScoringWeightProfile;
  /** Override the rule-based calculators used (primarily for testing). Defaults to {@link DEFAULT_SCORE_COMPONENT_CALCULATORS}. */
  readonly calculators?: readonly ScoreComponentCalculator[];
  /** Optional AI enrichment implementation. Omitted entirely when `AI_PROVIDER=none` — see `docs/scoring/ai-layer.md`. */
  readonly ai?: AiEnrichmentPort;
}

export interface ScoreMatchResult {
  readonly scores: TrademarkMatchScores;
  /** Weighted sum of `scores`, 0-100. */
  readonly totalScore: number;
  readonly weightProfile: ScoringWeightProfile;
  /** Rationale from the AI layer, if it produced an adjustment. Must be screened via `findForbiddenLanguage` before customer display. */
  readonly aiRationale: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Runs the full scoring pipeline for a single `(watched, candidate)` pair:
 * rule-based component calculators, an optional bounded AI adjustment, and
 * weighting into a single `totalScore`. Deterministic and complete without
 * `options.ai` — see `docs/scoring/overview.md`.
 */
export async function scoreMatch(
  context: ScoringContext,
  options: ScoreMatchOptions = {},
): Promise<ScoreMatchResult> {
  const weightProfile = options.weightProfile ?? DEFAULT_WEIGHT_PROFILE;
  const calculators = options.calculators ?? DEFAULT_SCORE_COMPONENT_CALCULATORS;

  const ruleBasedScores = Object.fromEntries(
    calculators.map((calculator) => [calculator.component, clamp(calculator.calculate(context), 0, 1)]),
  ) as Omit<TrademarkMatchScores, 'aiPlausibilityAdjustment'>;

  let aiPlausibilityAdjustment = 0;
  let aiRationale: string | null = null;

  if (options.ai) {
    const result = await options.ai.adjust(context, ruleBasedScores);
    if (result) {
      aiPlausibilityAdjustment = clamp(result.adjustment, -1, 1);
      aiRationale = result.rationale;
    }
  }

  const scores: TrademarkMatchScores = { ...ruleBasedScores, aiPlausibilityAdjustment };

  const componentKeys = Object.keys(weightProfile.weights) as Array<keyof TrademarkMatchScores>;
  const rawTotal = componentKeys.reduce(
    (sum, component) => sum + scores[component] * weightProfile.weights[component],
    0,
  );

  return {
    scores,
    totalScore: Math.round(clamp(rawTotal, 0, 100) * 100) / 100,
    weightProfile,
    aiRationale,
  };
}
