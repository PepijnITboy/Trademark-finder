import { describe, expect, it } from 'vitest';
import { conceptualSimilarity } from './lexicon.js';

describe('conceptualSimilarity', () => {
  it('matches LION / LÖWE', () => {
    const result = conceptualSimilarity('LION', 'LÖWE');
    expect(result.synonym).toBeGreaterThan(0.5);
  });

  it('matches FOX / VOS and RED FOX / RODE VOS', () => {
    expect(conceptualSimilarity('FOX', 'VOS').synonym).toBeGreaterThan(0.5);
    expect(conceptualSimilarity('RED FOX', 'RODE VOS').synonym).toBeGreaterThanOrEqual(0.5);
  });

  it('returns zero for unrelated fantasy names', () => {
    expect(conceptualSimilarity('ZENZO', 'KASTORIN').synonym).toBe(0);
  });
});
