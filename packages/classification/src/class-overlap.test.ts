import { describe, expect, it } from 'vitest';
import { calculateClassOverlap } from './class-overlap.js';

describe('calculateClassOverlap', () => {
  it('returns full overlap for identical sets', () => {
    const result = calculateClassOverlap([9, 42], [42, 9]);
    expect(result.overlappingClasses).toEqual([9, 42]);
    expect(result.onlyInFirst).toEqual([]);
    expect(result.onlyInSecond).toEqual([]);
    expect(result.jaccard).toBe(1);
  });

  it('returns zero overlap for disjoint sets', () => {
    const result = calculateClassOverlap([9], [25]);
    expect(result.overlappingClasses).toEqual([]);
    expect(result.jaccard).toBe(0);
    expect(result.onlyInFirst).toEqual([9]);
    expect(result.onlyInSecond).toEqual([25]);
  });

  it('computes partial jaccard overlap', () => {
    const result = calculateClassOverlap([9, 35, 42], [9, 42, 45]);
    expect(result.overlappingClasses).toEqual([9, 42]);
    expect(result.unionSize).toBe(4);
    expect(result.intersectionSize).toBe(2);
    expect(result.jaccard).toBe(0.5);
  });

  it('handles empty inputs without dividing by zero', () => {
    const result = calculateClassOverlap([], []);
    expect(result.jaccard).toBe(0);
    expect(result.unionSize).toBe(0);
  });

  it('deduplicates repeated classes within a single input', () => {
    const result = calculateClassOverlap([9, 9, 9], [9]);
    expect(result.overlappingClasses).toEqual([9]);
    expect(result.jaccard).toBe(1);
  });
});
