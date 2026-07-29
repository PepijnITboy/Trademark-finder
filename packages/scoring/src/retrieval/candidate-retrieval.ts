import { normalizeMarkName } from '@merkwacht/normalization';
import { generatePhoneticRepresentations } from '@merkwacht/phonetics';
import { normalizedStringSimilarity, trigramJaccardSimilarity } from '../text-distance.js';

export type RetrievalStrategy =
  | 'exact'
  | 'compact_exact'
  | 'token'
  | 'prefix'
  | 'suffix'
  | 'trigram'
  | 'edit_distance'
  | 'phonetic'
  | 'other';

export interface RetrievalEvidence {
  readonly strategy: RetrievalStrategy;
  readonly queryValue: string;
  readonly candidateValue: string;
  readonly rawScore?: number;
  readonly rankWithinStrategy?: number;
  readonly configVersion: string;
}

export interface RetrievalCandidate<T> {
  readonly item: T;
  readonly markText: string;
  readonly evidence: RetrievalEvidence[];
}

export const RETRIEVAL_CONFIG_VERSION = 'retrieval-v1';

function compact(value: string): string {
  return normalizeMarkName(value).normalized.replace(/\s+/g, '');
}

/**
 * Multi-channel candidate retrieval (union). Cheap, broad, not a legal judgment.
 */
export function retrieveCandidates<T>(
  queryMark: string,
  corpus: readonly { item: T; markText: string }[],
  options: { limit?: number; minEditSimilarity?: number } = {},
): RetrievalCandidate<T>[] {
  const limit = options.limit ?? 500;
  const minEdit = options.minEditSimilarity ?? 0.45;
  const queryNorm = normalizeMarkName(queryMark);
  const queryCompact = compact(queryMark);
  const queryPhonetic = generatePhoneticRepresentations(queryNorm.normalized);
  const queryTokens = new Set(queryNorm.significantTokens);

  const byKey = new Map<string, RetrievalCandidate<T>>();

  const add = (
    entry: { item: T; markText: string },
    strategy: RetrievalStrategy,
    queryValue: string,
    candidateValue: string,
    rawScore?: number,
  ) => {
    const key = entry.markText;
    const evidence: RetrievalEvidence = {
      strategy,
      queryValue,
      candidateValue,
      ...(rawScore !== undefined ? { rawScore } : {}),
      configVersion: RETRIEVAL_CONFIG_VERSION,
    };
    const existing = byKey.get(key);
    if (existing) {
      byKey.set(key, { ...existing, evidence: [...existing.evidence, evidence] });
    } else {
      byKey.set(key, { item: entry.item, markText: entry.markText, evidence: [evidence] });
    }
  };

  for (const entry of corpus) {
    const candNorm = normalizeMarkName(entry.markText);
    const candCompact = compact(entry.markText);

    if (candNorm.normalized === queryNorm.normalized) {
      add(entry, 'exact', queryNorm.normalized, candNorm.normalized, 1);
    }
    if (candCompact === queryCompact && queryCompact.length > 0) {
      add(entry, 'compact_exact', queryCompact, candCompact, 1);
    }

    const sharedTokens = candNorm.significantTokens.filter((t) => queryTokens.has(t));
    if (sharedTokens.length > 0) {
      add(entry, 'token', [...queryTokens].join(' '), sharedTokens.join(' '), sharedTokens.length);
    }

    if (
      queryNorm.foldedAscii.length >= 3 &&
      candNorm.foldedAscii.startsWith(queryNorm.foldedAscii.slice(0, 3))
    ) {
      add(entry, 'prefix', queryNorm.foldedAscii.slice(0, 3), candNorm.foldedAscii.slice(0, 3));
    }
    if (
      queryNorm.foldedAscii.length >= 3 &&
      candNorm.foldedAscii.endsWith(queryNorm.foldedAscii.slice(-3))
    ) {
      add(entry, 'suffix', queryNorm.foldedAscii.slice(-3), candNorm.foldedAscii.slice(-3));
    }

    const trigram = trigramJaccardSimilarity(queryNorm.normalized, candNorm.normalized);
    if (trigram >= 0.35) {
      add(entry, 'trigram', queryNorm.normalized, candNorm.normalized, trigram);
    }

    const edit = normalizedStringSimilarity(queryNorm.normalized, candNorm.normalized);
    if (edit >= minEdit) {
      add(entry, 'edit_distance', queryNorm.normalized, candNorm.normalized, edit);
    }

    const candPhonetic = generatePhoneticRepresentations(candNorm.normalized);
    let bestPhon = 0;
    for (const q of queryPhonetic) {
      for (const c of candPhonetic) {
        if (q.locale !== c.locale) continue;
        bestPhon = Math.max(bestPhon, normalizedStringSimilarity(q.code, c.code));
      }
    }
    if (bestPhon >= 0.75) {
      add(entry, 'phonetic', queryNorm.normalized, candNorm.normalized, bestPhon);
    }
  }

  return [...byKey.values()]
    .sort((a, b) => b.evidence.length - a.evidence.length)
    .slice(0, limit);
}
