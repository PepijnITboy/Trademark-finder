import { PHONETIC_LOCALES, type PhoneticLocale, type PhoneticRepresentation } from './types.js';

export const PHONETICS_ENGINE_VERSION = 'phonetics-v2';

function applyCRule(word: string, ambiguous: 'k' | 's'): string {
  return word
    .replace(/c(?=[aou])/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c(?![aeiouy])/g, ambiguous);
}

function hasAmbiguousC(word: string): boolean {
  return /c(?![aeiouy])/.test(word);
}

const DIGRAPHS: Record<PhoneticLocale, ReadonlyArray<readonly [RegExp, string]>> = {
  nl: [
    [/ck/g, 'k'],
    [/ph/g, 'f'],
    [/th/g, 't'],
    [/qu/g, 'kw'],
    [/ij/g, 'i'],
    [/y/g, 'i'],
    [/x/g, 'ks'],
    [/sch/g, 's'],
  ],
  en: [
    [/ph/g, 'f'],
    [/gh/g, ''],
    [/ck/g, 'k'],
    [/wr/g, 'r'],
    [/kn/g, 'n'],
    [/qu/g, 'kw'],
    [/x/g, 'ks'],
  ],
  de: [
    [/ph/g, 'f'],
    [/ck/g, 'k'],
    [/sch/g, 'sh'],
    [/ie/g, 'i'],
    [/ä|ae/g, 'e'],
    [/ö|oe/g, 'e'],
    [/ü|ue/g, 'u'],
    [/ß/g, 'ss'],
    [/x/g, 'ks'],
  ],
  fr: [
    [/ph/g, 'f'],
    [/qu/g, 'k'],
    [/ç/g, 's'],
    [/eau/g, 'o'],
    [/oux/g, 'u'],
    [/x$/g, ''],
    [/th/g, 't'],
  ],
  es: [
    [/ll/g, 'y'],
    [/ñ/g, 'n'],
    [/qu/g, 'k'],
    [/ch/g, 'ch'],
    [/x/g, 'ks'],
    [/y/g, 'i'],
  ],
  it: [
    [/ch(?=[ei])/g, 'k'],
    [/c(?=[ei])/g, 'ch'],
    [/gh(?=[ei])/g, 'g'],
    [/gl(?=i)/g, 'l'],
    [/gn/g, 'n'],
    [/qu/g, 'kw'],
    [/x/g, 'ks'],
  ],
};

function applyDigraphs(word: string, digraphs: ReadonlyArray<readonly [RegExp, string]>): string {
  return digraphs.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), word);
}

function collapseDoubles(word: string): string {
  return word.replace(/(.)\1+/g, '$1');
}

function toConsonantSkeleton(word: string): string {
  if (word.length === 0) return word;
  const first = word.charAt(0);
  const rest = word.slice(1).replace(/[aeiou]/g, '');
  return first + rest;
}

function encodeWord(word: string, locale: PhoneticLocale, ambiguousC: 'k' | 's'): string {
  const digraphs = DIGRAPHS[locale];
  const cResolved = applyCRule(word, ambiguousC);
  const digraphed = applyDigraphs(cResolved, digraphs);
  return toConsonantSkeleton(collapseDoubles(digraphed));
}

/**
 * Generates locale phonetic codes. Defaults to nl+en for backward compatibility;
 * pass full PHONETIC_LOCALES when `multilingual_phonetics` is enabled.
 */
export function generatePhoneticRepresentations(
  normalized: string,
  locales: readonly PhoneticLocale[] = ['nl', 'en'],
): PhoneticRepresentation[] {
  const words = normalized.split(' ').filter((word) => word.length > 0);

  return locales.map((locale) => {
    const primaryWords = words.map((word) => encodeWord(word, locale, 'k'));
    const code = primaryWords.join(' ');

    const isAmbiguous = words.some((word) => hasAmbiguousC(word));
    if (!isAmbiguous) {
      return { input: normalized, locale, code, engineVersion: PHONETICS_ENGINE_VERSION };
    }

    const alternateWords = words.map((word) => encodeWord(word, locale, 's'));
    return {
      input: normalized,
      locale,
      code,
      alternateCode: alternateWords.join(' '),
      engineVersion: PHONETICS_ENGINE_VERSION,
    };
  });
}
