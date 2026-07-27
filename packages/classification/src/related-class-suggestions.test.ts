import { describe, expect, it } from 'vitest';
import {
  RELATED_CLASS_SUGGESTIONS_ENABLED_DEFAULT,
  suggestRelatedClasses,
} from './related-class-suggestions.js';

describe('suggestRelatedClasses', () => {
  it('is disabled by default', () => {
    expect(RELATED_CLASS_SUGGESTIONS_ENABLED_DEFAULT).toBe(false);
    expect(suggestRelatedClasses([9, 42])).toEqual([]);
  });

  it('returns an empty array when options.enabled is not explicitly true', () => {
    expect(suggestRelatedClasses([9], { enabled: false })).toEqual([]);
  });

  it('suggests related classes when explicitly enabled', () => {
    const suggestions = suggestRelatedClasses([9], { enabled: true });
    const classes = suggestions.map((s) => s.niceClass);
    expect(classes).toContain(42);
    expect(classes).toContain(38);
  });

  it('never suggests a class that is already selected', () => {
    const suggestions = suggestRelatedClasses([9, 42], { enabled: true });
    expect(suggestions.some((s) => s.niceClass === 42)).toBe(false);
  });

  it('every suggestion carries a non-empty Dutch reason', () => {
    const suggestions = suggestRelatedClasses([25], { enabled: true });
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      expect(suggestion.reasonNl.length).toBeGreaterThan(0);
      expect(suggestion.triggeredByClass).toBe(25);
    }
  });

  it('deduplicates suggestions triggered by multiple selected classes', () => {
    const suggestions = suggestRelatedClasses([9, 35], { enabled: true });
    const class42Count = suggestions.filter((s) => s.niceClass === 42).length;
    expect(class42Count).toBe(1);
  });
});
