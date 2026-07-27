import { findForbiddenLanguage } from '@merkwacht/domain';
import { AppError } from '@merkwacht/shared';
import { z } from 'zod';
import type { TrademarkAiAssessmentResult } from './types.js';

/**
 * Zod schema for {@link TrademarkAiAssessmentResult}. Every AI provider
 * response is parsed through this schema before it is trusted anywhere
 * downstream - a provider returning malformed/out-of-range JSON must never
 * silently corrupt a `TrademarkMatch`. See `docs/scoring/ai-layer.md`.
 */
export const trademarkAiAssessmentResultSchema = z.object({
  adjustment: z.number().min(-1, 'adjustment moet >= -1 zijn.').max(1, 'adjustment moet <= 1 zijn.'),
  rationaleNl: z
    .string()
    .trim()
    .min(1, 'rationaleNl mag niet leeg zijn.')
    .max(2000, 'rationaleNl is te lang.'),
  confidence: z.number().min(0, 'confidence moet >= 0 zijn.').max(1, 'confidence moet <= 1 zijn.'),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

/**
 * Validates a raw (parsed-JSON) AI provider response against
 * {@link trademarkAiAssessmentResultSchema} and additionally screens
 * `rationaleNl` against `@merkwacht/domain`'s forbidden-language guard rail
 * (see `docs/product/legal-language.md`) — a structurally valid but
 * legally-risky rationale is treated the same as an invalid one, since it
 * must never reach a customer either way.
 *
 * Throws `AppError` (code `AI_ASSESSMENT_INVALID`) rather than returning
 * `null`/a default value on failure, so callers (notably
 * {@link assessWithRetry}) can distinguish "provider returned something
 * unusable" from "no adjustment warranted".
 */
export function validateAssessment(raw: unknown): TrademarkAiAssessmentResult {
  const result = trademarkAiAssessmentResultSchema.safeParse(raw);
  if (!result.success) {
    throw new AppError({
      code: 'AI_ASSESSMENT_INVALID',
      messageNl: 'De AI-beoordeling voldeed niet aan het verwachte formaat.',
      category: 'EXTERNAL_SERVICE',
      details: { issues: result.error.issues },
    });
  }

  const forbidden = findForbiddenLanguage(result.data.rationaleNl);
  if (forbidden.length > 0) {
    throw new AppError({
      code: 'AI_ASSESSMENT_INVALID',
      messageNl: 'De AI-beoordeling bevatte niet-toegestane bewoordingen en is geweigerd.',
      category: 'EXTERNAL_SERVICE',
      details: { forbiddenPhrases: forbidden },
    });
  }

  return result.data;
}

/**
 * Calls `produce` for a raw AI response, validates it with
 * {@link validateAssessment}, and retries exactly once on failure (either a
 * provider error or a validation failure) before giving up. Mirrors the
 * "one retry then `ai_assessment_failed`" policy: a persistently
 * malformed/failing provider must surface as a clear, logged failure
 * (`AI_ASSESSMENT_FAILED`) rather than retry indefinitely or silently
 * fall back to a guessed value.
 */
export async function assessWithRetry(
  produce: () => Promise<unknown>,
): Promise<TrademarkAiAssessmentResult> {
  const attempts: unknown[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const raw = await produce();
      return validateAssessment(raw);
    } catch (error) {
      attempts.push(error instanceof AppError ? error.toJSON() : String(error));
      if (attempt === 2) {
        throw new AppError({
          code: 'ai_assessment_failed',
          messageNl:
            'De AI-beoordeling is na een herhaalde poging nog steeds mislukt of ongeldig. De score blijft volledig regelgebaseerd.',
          category: 'EXTERNAL_SERVICE',
          cause: error,
          details: { attempts },
        });
      }
    }
  }

  // Unreachable - the loop above always returns or throws - kept for exhaustiveness.
  throw new AppError({
    code: 'ai_assessment_failed',
    messageNl: 'De AI-beoordeling is onverwacht mislukt.',
    category: 'EXTERNAL_SERVICE',
  });
}
