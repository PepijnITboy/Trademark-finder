import type { NormalizedMarkRepresentations } from './types.js';

/**
 * Legal-entity suffixes and generic stopwords removed when deriving
 * `significantTokens`. Deliberately conservative — this list must never
 * strip a token that could plausibly be part of a distinctive mark. See
 * `docs/scoring/normalization.md`.
 */
const STOPWORDS = new Set([
  // Dutch/Benelux legal entity suffixes
  'bv',
  'nv',
  'vof',
  'cv',
  'ug',
  // Common international legal entity suffixes
  'gmbh',
  'ltd',
  'llc',
  'inc',
  'co',
  'corp',
  'plc',
  'sa',
  'sarl',
  'ag',
  // Common Dutch/English stopwords unlikely to be distinctive on their own
  'de',
  'het',
  'the',
  'and',
  'en',
]);

/** Best-effort ASCII transliteration table for common Latin diacritics/ligatures not covered by NFKD stripping alone. */
const EXTRA_TRANSLITERATIONS: Record<string, string> = {
  ø: 'o',
  Ø: 'O',
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  ß: 'ss',
  ð: 'd',
  þ: 'th',
  ł: 'l',
};

function stripDiacritics(input: string): string {
  return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function toAscii(input: string): string {
  let result = '';
  for (const char of stripDiacritics(input)) {
    result += EXTRA_TRANSLITERATIONS[char] ?? char;
  }
  // Drop any remaining non-ASCII characters that weren't handled by
  // diacritic-stripping or the transliteration table above.
  return Array.from(result)
    .filter((char) => char.codePointAt(0)! <= 127)
    .join('');
}

/**
 * Turns raw mark text into a stable set of representations for comparison.
 * Pure and synchronous — see `docs/scoring/normalization.md` for the full
 * step-by-step rationale.
 */
export function normalizeMarkName(input: string): NormalizedMarkRepresentations {
  const diacriticsStripped = stripDiacritics(input).toLowerCase();

  // Replace hyphens *between letters* with a space before stripping other
  // punctuation, so "Coca-Cola" tokenizes as ["coca", "cola"] rather than
  // collapsing into "cocacola".
  const hyphensAsSpaces = diacriticsStripped.replace(/(\p{L})-(\p{L})/gu, '$1 $2');

  // Strip everything that isn't a letter, digit, or whitespace (handles ®, ™, ., ,, ', etc.)
  const punctuationStripped = hyphensAsSpaces.replace(/[^\p{L}\p{N}\s]/gu, ' ');

  const normalized = punctuationStripped.replace(/\s+/g, ' ').trim();

  const tokens = normalized.length > 0 ? normalized.split(' ') : [];
  const significantTokens = tokens.filter((token) => !STOPWORDS.has(token));

  const foldedAscii = toAscii(normalized).replace(/\s+/g, ' ').trim();

  return {
    original: input,
    normalized,
    foldedAscii,
    tokens,
    significantTokens,
    length: normalized.length,
    compact: normalized.replace(/\s+/g, ''),
    unicodeNfc: input.normalize('NFC'),
    unicodeNfkc: input.normalize('NFKC'),
  };
}

const COMPANY_SUFFIXES = new Set(['bv', 'nv', 'vof', 'gmbh', 'ltd', 'llc', 'inc', 'co', 'corp', 'plc', 'sa', 'ag']);
const ARTICLES = new Set(['de', 'het', 'the', 'a', 'an', 'der', 'die', 'das', 'le', 'la', 'el']);
const PRODUCT_TERMS = new Set([
  'drinks',
  'foods',
  'shop',
  'group',
  'company',
  'international',
  'original',
  'premium',
  'ginger',
  'spritz',
]);

/**
 * Normalization v2: keeps all tokens classified instead of silently dropping stopwords.
 * Still produces `significantTokens` for legacy consumers (excludes company_suffix + article).
 */
export function normalizeMarkNameV2(input: string): NormalizedMarkRepresentations {
  const base = normalizeMarkName(input);
  const classifiedTokens = base.tokens.map((token, position) => {
    let classification: import('./types.js').MarkTokenClassification = 'unknown';
    let confidence = 0.5;
    if (COMPANY_SUFFIXES.has(token)) {
      classification = 'company_suffix';
      confidence = 0.95;
    } else if (ARTICLES.has(token)) {
      classification = 'article';
      confidence = 0.9;
    } else if (PRODUCT_TERMS.has(token)) {
      classification = 'product_term';
      confidence = 0.7;
    } else if (token.length >= 4) {
      classification = 'distinctive';
      confidence = 0.55;
    } else {
      classification = 'weak';
      confidence = 0.4;
    }
    return { raw: token, normalized: token, position, classification, confidence };
  });

  const significantTokens = classifiedTokens
    .filter((t) => t.classification !== 'company_suffix' && t.classification !== 'article')
    .map((t) => t.normalized);

  return {
    ...base,
    significantTokens,
    classifiedTokens,
  };
}
