/**
 * Single source of truth for the mandatory Dutch legal disclaimer. Every
 * customer-facing surface (dashboard, e-mail notifications, PDF/CSV
 * exports) must import and render this constant verbatim rather than
 * re-authoring the text. See `docs/product/legal-language.md`.
 */
export const LEGAL_DISCLAIMER_NL =
  'Merkwacht signaleert automatisch gedetecteerde overeenkomsten tussen ' +
  'merken op basis van openbare registergegevens. Deze signalering vormt ' +
  'geen juridisch advies en geen juridische beoordeling van inbreuk of ' +
  'verwarringsgevaar. Raadpleeg een merkengemachtigde of advocaat voordat ' +
  'u actie onderneemt, waaronder het al dan niet indienen van een ' +
  'oppositie.';

/**
 * Phrases that must never appear in customer-facing text (UI copy, e-mail
 * templates, exports, or AI-generated rationale shown to customers) because
 * they imply a legal determination or action Merkwacht does not make/take.
 * See `docs/product/legal-language.md` for the full rationale table.
 *
 * Matching is case-insensitive and substring-based; this is intentionally a
 * blunt guard rail suitable for CI/lint checks and AI-output filtering, not
 * a natural-language understanding system.
 */
export const FORBIDDEN_PHRASES_NL: readonly string[] = [
  'dit is een inbreuk',
  'u moet opposeren',
  'wij adviseren oppositie',
  'wij dienen de oppositie voor u in',
  'wij nemen actie namens u',
  'gegarandeerd',
  '100% zeker',
  'juridisch advies' /* as a description of what Merkwacht itself provides */,
  'er is verwarringsgevaar',
  'wij garanderen dat u het merk mag',
];

/**
 * Checks whether `text` contains any forbidden phrase. Used to guard
 * AI-generated rationale text before it is shown to a customer — see
 * `docs/scoring/ai-layer.md`. Returns the matched phrase(s), if any.
 */
export function findForbiddenLanguage(text: string): readonly string[] {
  const haystack = text.toLowerCase();
  return FORBIDDEN_PHRASES_NL.filter((phrase) => haystack.includes(phrase.toLowerCase()));
}
