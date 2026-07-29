import { describe, expect, it } from 'vitest';
import { retrieveCandidates } from './candidate-retrieval.js';

describe('retrieveCandidates', () => {
  const corpus = [
    { item: 1, markText: 'ZENZO' },
    { item: 2, markText: 'SENZO' },
    { item: 3, markText: 'ZENZO DRINKS' },
    { item: 4, markText: 'KASTORIN' },
    { item: 5, markText: 'PHLOX' },
  ];

  it('unions exact, edit, phonetic and token channels', () => {
    const hits = retrieveCandidates('ZENZO', corpus);
    const marks = hits.map((h) => h.markText);
    expect(marks).toContain('ZENZO');
    expect(marks).toContain('SENZO');
    expect(marks).toContain('ZENZO DRINKS');
    const senzo = hits.find((h) => h.markText === 'SENZO');
    expect(senzo?.evidence.some((e) => e.strategy === 'edit_distance' || e.strategy === 'phonetic')).toBe(
      true,
    );
  });

  it('does not silently return empty when close variants exist', () => {
    const hits = retrieveCandidates('ZENZO', corpus);
    expect(hits.length).toBeGreaterThan(0);
  });
});
