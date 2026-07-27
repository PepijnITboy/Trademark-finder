export const PHONETIC_LOCALES = ['nl', 'en'] as const;
export type PhoneticLocale = (typeof PHONETIC_LOCALES)[number];

/**
 * A phonetic encoding of a (normalized) mark name for a specific locale.
 * See `docs/scoring/phonetics.md`.
 */
export interface PhoneticRepresentation {
  /** The normalized mark text this was generated from. */
  readonly input: string;
  readonly locale: PhoneticLocale;
  /** Primary phonetic code. */
  readonly code: string;
  /** Secondary encoding produced when a substitution rule was ambiguous. */
  readonly alternateCode?: string;
}
