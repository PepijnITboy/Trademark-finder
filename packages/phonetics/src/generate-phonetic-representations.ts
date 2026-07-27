import { PHONETIC_LOCALES, type PhoneticLocale, type PhoneticRepresentation } from './types.js';

/**
 * Applies the shared "hard c vs. soft c" substitution used by both locales:
 * `c` before `a/o/u` -> `k`, before `e/i/y` -> `s`. A `c` followed by a
 * consonant or at a word boundary is ambiguous — it is resolved to
 * `ambiguous` for the primary code, with the caller responsible for also
 * producing an alternate code using the opposite resolution.
 */
function applyCRule(word: string, ambiguous: 'k' | 's'): string {
  return word
    .replace(/c(?=[aou])/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/c(?![aeiouy])/g, ambiguous);
}

function hasAmbiguousC(word: string): boolean {
  return /c(?![aeiouy])/.test(word);
}

const NL_DIGRAPHS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ck/g, 'k'],
  [/ph/g, 'f'],
  [/th/g, 't'],
  [/qu/g, 'kw'],
  [/ij/g, 'i'],
  [/y/g, 'i'],
  [/x/g, 'ks'],
];

const EN_DIGRAPHS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ph/g, 'f'],
  [/gh/g, ''],
  [/ck/g, 'k'],
  [/wr/g, 'r'],
  [/kn/g, 'n'],
  [/qu/g, 'kw'],
  [/x/g, 'ks'],
];

function applyDigraphs(word: string, digraphs: ReadonlyArray<readonly [RegExp, string]>): string {
  return digraphs.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), word);
}

/** Collapses runs of consecutive identical characters to a single occurrence. */
function collapseDoubles(word: string): string {
  return word.replace(/(.)\1+/g, '$1');
}

/**
 * Reduces a word to a coarse consonant skeleton: keeps the first character
 * (to preserve initial-sound distinctiveness) and strips vowels from the
 * remainder, in the spirit of Soundex/Metaphone.
 */
function toConsonantSkeleton(word: string): string {
  if (word.length === 0) return word;
  const first = word.charAt(0);
  const rest = word.slice(1).replace(/[aeiou]/g, '');
  return first + rest;
}

function encodeWord(word: string, locale: PhoneticLocale, ambiguousC: 'k' | 's'): string {
  const digraphs = locale === 'nl' ? NL_DIGRAPHS : EN_DIGRAPHS;
  const cResolved = applyCRule(word, ambiguousC);
  const digraphed = applyDigraphs(cResolved, digraphs);
  return toConsonantSkeleton(collapseDoubles(digraphed));
}

/**
 * Generates a heuristic, metaphone-inspired phonetic code for `normalized`
 * mark text, per locale. This is a v1 stub intentionally kept small and
 * dependency-free — see `docs/scoring/phonetics.md` for the full rationale
 * and the substitution rules implemented here.
 *
 * `normalized` is expected to already be lowercased/diacritic-folded (i.e.
 * the output of `@merkwacht/normalization`'s `normalizeMarkName().normalized`).
 */
export function generatePhoneticRepresentations(
  normalized: string,
  locales: readonly PhoneticLocale[] = PHONETIC_LOCALES,
): PhoneticRepresentation[] {
  const words = normalized.split(' ').filter((word) => word.length > 0);

  return locales.map((locale) => {
    const primaryWords = words.map((word) => encodeWord(word, locale, 'k'));
    const code = primaryWords.join(' ');

    const isAmbiguous = words.some((word) => hasAmbiguousC(word));
    if (!isAmbiguous) {
      return { input: normalized, locale, code };
    }

    const alternateWords = words.map((word) => encodeWord(word, locale, 's'));
    return { input: normalized, locale, code, alternateCode: alternateWords.join(' ') };
  });
}
