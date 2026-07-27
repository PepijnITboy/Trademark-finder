import { AppError } from '@merkwacht/shared';
import type { AiAssessmentInput, AiAssessmentProvider, AiAssessmentResult } from './types';

/**
 * No-op provider used when AI assessment is turned off for an environment
 * or organization. Always fails gracefully with a clear Dutch message
 * instead of silently returning fake data.
 */
export class DisabledAssessmentProvider implements AiAssessmentProvider {
  readonly name = 'disabled';

  isConfigured(): boolean {
    return false;
  }

  async assess(_input: AiAssessmentInput): Promise<AiAssessmentResult> {
    throw new AppError({
      code: 'AI_DISABLED',
      messageNl: 'AI-beoordeling staat uit voor deze omgeving.',
      category: 'CONFIGURATION',
    });
  }
}
