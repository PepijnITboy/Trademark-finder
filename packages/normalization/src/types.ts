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
  /** Compact form without whitespace (v2+). */
  readonly compact?: string;
  /** NFC / NFKC forms when v2 engine is used. */
  readonly unicodeNfc?: string;
  readonly unicodeNfkc?: string;
  /** Token classifications (v2) — tokens are not silently dropped. */
  readonly classifiedTokens?: readonly ClassifiedMarkToken[];
}

export type MarkTokenClassification =
  | 'distinctive'
  | 'weak'
  | 'descriptive'
  | 'generic'
  | 'geographic'
  | 'company_suffix'
  | 'article'
  | 'product_term'
  | 'unknown';

export interface ClassifiedMarkToken {
  readonly raw: string;
  readonly normalized: string;
  readonly position: number;
  readonly classification: MarkTokenClassification;
  readonly confidence: number;
}
