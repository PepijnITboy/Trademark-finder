import { describe, expect, it } from 'vitest';
import { meanAveragePrecision, recallAtK } from './metrics.js';

describe('evaluation metrics', () => {
  it('computes recall@K', () => {
    expect(recallAtK(['a', 'b'], ['x', 'a', 'b'], 2)).toBe(0.5);
    expect(recallAtK(['a', 'b'], ['a', 'b', 'c'], 2)).toBe(1);
  });

  it('computes MAP', () => {
    expect(meanAveragePrecision(['a'], ['a', 'b'])).toBe(1);
    expect(meanAveragePrecision(['a', 'b'], ['x', 'a', 'b'])).toBeGreaterThan(0.5);
  });
});
