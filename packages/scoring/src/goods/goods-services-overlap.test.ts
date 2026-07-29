import { describe, expect, it } from 'vitest';
import { calculateGoodsServicesOverlap } from './goods-services-overlap.js';

describe('calculateGoodsServicesOverlap', () => {
  it('identical goods text scores identity', () => {
    const result = calculateGoodsServicesOverlap({
      leftEntries: [{ niceClass: 33, description: 'alcoholic ginger-based cocktails' }],
      rightEntries: [{ niceClass: 33, description: 'alcoholic ginger-based cocktails' }],
      leftNiceClasses: [33],
      rightNiceClasses: [33],
    });
    expect(result.identity).toBe(1);
    expect(result.overallSimilarity).toBe(1);
    expect(result.hasText).toBe(true);
  });

  it('missing text uses Nice fallback and marks missing — not silent zero coverage', () => {
    const result = calculateGoodsServicesOverlap({
      leftEntries: [],
      rightEntries: [],
      leftNiceClasses: [9, 42],
      rightNiceClasses: [9],
    });
    expect(result.hasText).toBe(false);
    expect(result.niceOnlyFallback).toBe(true);
    expect(result.coverage).toBeGreaterThan(0);
    expect(result.reasonCodes).toContain('missing_goods_text');
  });

  it('cross-class 33↔32 yields non-zero relation feature', () => {
    const result = calculateGoodsServicesOverlap({
      leftEntries: [{ niceClass: 33, description: 'beer' }],
      rightEntries: [{ niceClass: 32, description: 'soft drinks' }],
      leftNiceClasses: [33],
      rightNiceClasses: [32],
    });
    expect(result.reasonCodes).toContain('cross_class_relation');
    expect(result.overallSimilarity).toBeGreaterThan(0.3);
  });
});
