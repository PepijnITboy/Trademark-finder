import { describe, expect, it } from 'vitest';
import {
  assertValidWeightProfile,
  createWeightProfile,
  DEFAULT_WEIGHT_PROFILE,
  getActiveWeightProfile,
  publishWeightProfile,
  setActiveWeightProfile,
} from './weight-profile.js';

describe('weight profiles', () => {
  it('default v1 sums to 100', () => {
    expect(() => assertValidWeightProfile(DEFAULT_WEIGHT_PROFILE)).not.toThrow();
  });

  it('rejects profiles that do not sum to 100', () => {
    expect(() =>
      createWeightProfile('bad', {
        ...DEFAULT_WEIGHT_PROFILE.weights,
        textualSimilarity: 99,
      }),
    ).toThrow(/expected 100/);
  });

  it('publish bumps version and sets active', () => {
    const published = publishWeightProfile({ ...DEFAULT_WEIGHT_PROFILE.weights });
    expect(published.id).toMatch(/^v\d+$/);
    expect(getActiveWeightProfile().id).toBe(published.id);
    setActiveWeightProfile(DEFAULT_WEIGHT_PROFILE);
    expect(getActiveWeightProfile().id).toBe('v1');
  });
});
