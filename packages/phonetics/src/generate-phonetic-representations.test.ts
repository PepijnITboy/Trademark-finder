import { describe, expect, it } from 'vitest';
import { generatePhoneticRepresentations } from './generate-phonetic-representations.js';

describe('generatePhoneticRepresentations', () => {
  it('generates a consonant-skeleton phonetic code for the fictitious mark "LUMARO"', () => {
    const representations = generatePhoneticRepresentations('lumaro');
    const nl = representations.find((r) => r.locale === 'nl');
    const en = representations.find((r) => r.locale === 'en');

    expect(nl?.input).toBe('lumaro');
    expect(nl?.locale).toBe('nl');
    expect(nl?.code).toBe('lmr');
    expect(en?.code).toBe('lmr');
    expect(nl?.alternateCode).toBeUndefined();
  });

  it('generates a consonant-skeleton phonetic code for the fictitious mark "VANTERO"', () => {
    const representations = generatePhoneticRepresentations('vantero');
    const nl = representations.find((r) => r.locale === 'nl');
    const en = representations.find((r) => r.locale === 'en');

    expect(nl?.code).toBe('vntr');
    expect(en?.code).toBe('vntr');
  });

  it('defaults to generating both the nl and en locales', () => {
    const representations = generatePhoneticRepresentations('lumaro');

    expect(representations).toHaveLength(2);
    expect(representations.map((r) => r.locale)).toEqual(['nl', 'en']);
  });

  it('only generates the requested locales when given explicitly', () => {
    const representations = generatePhoneticRepresentations('lumaro', ['nl']);

    expect(representations).toHaveLength(1);
    expect(representations[0]?.locale).toBe('nl');
  });

  it('encodes each word separately and joins the per-word codes with a space', () => {
    const [nl] = generatePhoneticRepresentations('lumaro group');

    expect(nl?.code).toBe('lmr grp');
  });

  it('produces an alternateCode when the input has an ambiguous "c" (not followed by a vowel)', () => {
    const [nl] = generatePhoneticRepresentations('acme');

    expect(nl?.code).toBe('akm');
    expect(nl?.alternateCode).toBe('asm');
  });

  it('does not produce an alternateCode when "c" is unambiguous (followed by a vowel)', () => {
    const [nl] = generatePhoneticRepresentations('cola');

    expect(nl?.code).toBe('kl');
    expect(nl?.alternateCode).toBeUndefined();
  });

  it('collapses doubled letters before building the consonant skeleton', () => {
    const [nl] = generatePhoneticRepresentations('lumarro');
    expect(nl?.code).toBe('lmr');
  });

  it('supports extended locales when requested', () => {
    const reps = generatePhoneticRepresentations('schon', ['de', 'fr']);
    expect(reps.map((r) => r.locale)).toEqual(['de', 'fr']);
    expect(reps[0]?.code.length).toBeGreaterThan(0);
  });

  it('PHLOX and FLOKS share phonetic proximity in en', () => {
    const a = generatePhoneticRepresentations('phlox', ['en'])[0]?.code;
    const b = generatePhoneticRepresentations('floks', ['en'])[0]?.code;
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a![0]).toBe(b![0]);
  });

  it('returns an empty representation list of codes when given only whitespace', () => {
    const [nl] = generatePhoneticRepresentations('   ');

    expect(nl?.code).toBe('');
  });
});
