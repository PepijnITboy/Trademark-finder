import type { TrademarkMatchScores } from '@merkwacht/domain';
import type { ScoringContext } from './scoring-context.js';

/** Result of a successful AI adjustment call. */
export interface AiAdjustmentResult {
  /** Signed adjustment in `[-1, 1]`, clamped by the pipeline before weighting. */
  readonly adjustment: number;
  /** Human-readable rationale, stored alongside the match for transparency. Must be screened against `@merkwacht/domain`'s `findForbiddenLanguage` before ever being shown to a customer. */
  readonly rationale: string;
}

/**
 * Consumer-owned interface: `@merkwacht/scoring` defines this port,
 * `@merkwacht/ai` implements it, and `apps/worker` wires the concrete
 * implementation in at startup. This keeps `@merkwacht/scoring` free of any
 * dependency on a concrete AI provider so it remains fully functional and
 * deterministic with `AI_PROVIDER=none`. See `docs/scoring/ai-layer.md` and
 * `docs/architecture/module-boundaries.md`.
 */
export interface AiEnrichmentPort {
  /**
   * Returns `null` when no adjustment should be applied (budget exhausted,
   * provider error, or the provider judged no adjustment warranted) — the
   * pipeline then uses `aiPlausibilityAdjustment = 0` and proceeds
   * unaffected.
   */
  adjust(
    context: ScoringContext,
    ruleBasedScores: Omit<TrademarkMatchScores, 'aiPlausibilityAdjustment'>,
  ): Promise<AiAdjustmentResult | null>;
}
