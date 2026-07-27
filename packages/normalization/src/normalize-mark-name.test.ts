import { describe, expect, it } from 'vitest';
import { normalizeMarkName } from './normalize-mark-name.js';

describe('normalizeMarkName', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    const result = normalizeMarkName('LUMARO®');
    expect(result.normalized).toBe('lumaro');
    expect(result.original).toBe('LUMARO®');
  });

  it('splits hyphens between letters into separate tokens', () => {
    const result = normalizeMarkName('Coca-Cola');
    expect(result.tokens).toEqual(['coca', 'cola']);
  });

  it('folds diacritics to their closest ASCII equivalent', () => {
    const result = normalizeMarkName('Zoë Ünïqué');
    expect(result.foldedAscii).toBe('zoe unique');
  });

  it('handles the extra transliteration table for ligatures/special Latin characters', () => {
    expect(normalizeMarkName('Ærøskøbing').foldedAscii).toBe('aeroskobing');
    expect(normalizeMarkName('Straße').foldedAscii).toBe('strasse');
  });

  it('drops common Benelux/international legal-entity suffixes from significantTokens', () => {
    const result = normalizeMarkName('Lumaro BV');
    expect(result.tokens).toEqual(['lumaro', 'bv']);
    expect(result.significantTokens).toEqual(['lumaro']);
  });

  it('keeps a token that merely contains, but does not equal, a stopword', () => {
    // "cover" contains "co" as a substring but must not be treated as the "co" stopword.
    const result = normalizeMarkName('Covero Group');
    expect(result.significantTokens).toContain('covero');
  });

  it('produces an empty representation for an empty/whitespace-only input', () => {
    const result = normalizeMarkName('   ');
    expect(result.normalized).toBe('');
    expect(result.tokens).toEqual([]);
    expect(result.significantTokens).toEqual([]);
    expect(result.length).toBe(0);
  });

  it('treats near-identical variants as producing distinct but very similar normalized forms', () => {
    const lumaro = normalizeMarkName('LUMARO');
    const lumaroo = normalizeMarkName('LUMAROO');
    expect(lumaro.normalized).not.toBe(lumaroo.normalized);
    expect(lumaro.normalized).toBe('lumaro');
    expect(lumaroo.normalized).toBe('lumaroo');
  });

  it('preserves digits, distinguishing a digit-substituted typosquat from the original', () => {
    const result = normalizeMarkName('VANTER0');
    expect(result.normalized).toBe('vanter0');
    expect(result.normalized).not.toBe('vantero');
  });

  it('is insensitive to case and surrounding whitespace for otherwise-identical marks', () => {
    const a = normalizeMarkName('  NorthVale  ');
    const b = normalizeMarkName('northvale');
    expect(a.normalized).toBe(b.normalized);
  });

  it('normalizes a spaced-out variant to different tokens than the concatenated form', () => {
    const spaced = normalizeMarkName('NORTH VALE');
    const concatenated = normalizeMarkName('NORTHVALE');
    expect(spaced.tokens).toEqual(['north', 'vale']);
    expect(concatenated.tokens).toEqual(['northvale']);
    expect(spaced.normalized).not.toBe(concatenated.normalized);
  });
});
