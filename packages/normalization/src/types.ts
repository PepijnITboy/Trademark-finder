/**
 * The set of representations `normalizeMarkName` derives from raw mark
 * text, used throughout the scoring pipeline. See
 * `docs/scoring/normalization.md`.
 */
export interface NormalizedMarkRepresentations {
  /** The untouched input text, kept for display/audit purposes. */
  readonly original: string;
  /** Lowercased, diacritic-folded, punctuation-stripped, whitespace-collapsed. */
  readonly normalized: string;
  /** `normalized` with all non-ASCII letters transliterated to their closest ASCII equivalent. */
  readonly foldedAscii: string;
  /** `normalized`, split on whitespace. */
  readonly tokens: readonly string[];
  /** `tokens` with common legal-entity suffixes and generic stopwords removed. */
  readonly significantTokens: readonly string[];
  /** Character length of `normalized`. */
  readonly length: number;
}
