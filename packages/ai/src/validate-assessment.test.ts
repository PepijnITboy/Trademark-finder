import { AppError } from '@merkwacht/shared';
import { describe, expect, it, vi } from 'vitest';
import { assessWithRetry, validateAssessment } from './validate-assessment.js';

const VALID_ASSESSMENT = {
  adjustment: 0.4,
  rationaleNl: 'De merken delen een ongebruikelijke woordstructuur ondanks lage tekstuele overlap.',
  confidence: 0.7,
  riskLevel: 'MEDIUM' as const,
};

describe('validateAssessment', () => {
  it('accepts a well-formed assessment', () => {
    const result = validateAssessment(VALID_ASSESSMENT);
    expect(result).toEqual(VALID_ASSESSMENT);
  });

  it('rejects an adjustment outside [-1, 1]', () => {
    expect(() => validateAssessment({ ...VALID_ASSESSMENT, adjustment: 1.5 })).toThrow(AppError);
  });

  it('rejects a confidence outside [0, 1]', () => {
    expect(() => validateAssessment({ ...VALID_ASSESSMENT, confidence: -0.1 })).toThrow(AppError);
  });

  it('rejects an invalid riskLevel', () => {
    expect(() => validateAssessment({ ...VALID_ASSESSMENT, riskLevel: 'CRITICAL' })).toThrow(AppError);
  });

  it('rejects an empty rationaleNl', () => {
    expect(() => validateAssessment({ ...VALID_ASSESSMENT, rationaleNl: '' })).toThrow(AppError);
  });

  it('rejects a completely malformed payload', () => {
    expect(() => validateAssessment('not an object')).toThrow(AppError);
    expect(() => validateAssessment(null)).toThrow(AppError);
    expect(() => validateAssessment(undefined)).toThrow(AppError);
  });

  it('throws with code AI_ASSESSMENT_INVALID for schema failures', () => {
    try {
      validateAssessment({ ...VALID_ASSESSMENT, adjustment: 'nope' });
      throw new Error('expected validateAssessment to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('AI_ASSESSMENT_INVALID');
    }
  });

  it('rejects rationale text containing forbidden legal-language phrases', () => {
    expect(() =>
      validateAssessment({ ...VALID_ASSESSMENT, rationaleNl: 'Dit is een inbreuk op uw merk.' }),
    ).toThrow(AppError);
  });
});

describe('assessWithRetry', () => {
  it('returns the validated result on the first successful attempt', async () => {
    const produce = vi.fn().mockResolvedValue(VALID_ASSESSMENT);
    const result = await assessWithRetry(produce);
    expect(result).toEqual(VALID_ASSESSMENT);
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('retries exactly once after a failed first attempt, then succeeds', async () => {
    const produce = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(VALID_ASSESSMENT);

    const result = await assessWithRetry(produce);
    expect(result).toEqual(VALID_ASSESSMENT);
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it('retries once after an invalid first response, then succeeds with a valid one', async () => {
    const produce = vi
      .fn()
      .mockResolvedValueOnce({ ...VALID_ASSESSMENT, adjustment: 99 })
      .mockResolvedValueOnce(VALID_ASSESSMENT);

    const result = await assessWithRetry(produce);
    expect(result).toEqual(VALID_ASSESSMENT);
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it('throws ai_assessment_failed after exhausting the single retry', async () => {
    const produce = vi.fn().mockRejectedValue(new Error('persistent failure'));

    await expect(assessWithRetry(produce)).rejects.toMatchObject({ code: 'ai_assessment_failed' });
    expect(produce).toHaveBeenCalledTimes(2);
  });

  it('throws ai_assessment_failed when every attempt returns invalid JSON shape', async () => {
    const produce = vi.fn().mockResolvedValue({ unexpected: 'shape' });

    await expect(assessWithRetry(produce)).rejects.toMatchObject({ code: 'ai_assessment_failed' });
    expect(produce).toHaveBeenCalledTimes(2);
  });
});
