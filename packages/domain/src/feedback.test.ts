import { describe, expect, it } from 'vitest';
import { labelAgreementRate } from './feedback.js';

describe('labelAgreementRate', () => {
  it('measures simple agreement', () => {
    expect(labelAgreementRate(['strong', 'weak'], ['strong', 'irrelevant'])).toBe(0.5);
    expect(labelAgreementRate([], [])).toBe(1);
  });
});
