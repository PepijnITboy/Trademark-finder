/**
 * Goods/services overlap from free-text descriptions + Nice classes.
 * Missing data must not silently mean "no similarity" for risk — callers use coverage + missing flags.
 */

export interface GoodsServiceTextEntry {
  readonly niceClass?: number;
  readonly description: string;
}

function normalizeGoodsText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeGoodsText(value)
    .split(' ')
    .filter((t) => t.length > 2);
}

/** Bootstrap cross-class commercial proximity (feature, not hard conflict). */
const CROSS_CLASS_RELATIONS: ReadonlyArray<{
  left: number;
  right: number;
  strength: number;
  code: string;
}> = [
  { left: 32, right: 33, strength: 0.55, code: 'beverages_alcohol_adjacent' },
  { left: 33, right: 35, strength: 0.45, code: 'alcohol_retail' },
  { left: 33, right: 43, strength: 0.5, code: 'alcohol_hospitality' },
  { left: 9, right: 42, strength: 0.4, code: 'software_services' },
  { left: 25, right: 35, strength: 0.45, code: 'clothing_retail' },
];

function crossClassStrength(leftClasses: readonly number[], rightClasses: readonly number[]): number {
  let best = 0;
  for (const rel of CROSS_CLASS_RELATIONS) {
    const hit =
      (leftClasses.includes(rel.left) && rightClasses.includes(rel.right)) ||
      (leftClasses.includes(rel.right) && rightClasses.includes(rel.left));
    if (hit) best = Math.max(best, rel.strength);
  }
  return best;
}

export interface GoodsServicesOverlapResult {
  /** 0-1 similarity; 0 with hasText=false means unknown, not proven dissimilar. */
  readonly overallSimilarity: number;
  readonly identity: number;
  readonly coverage: number;
  readonly hasText: boolean;
  readonly niceOnlyFallback: boolean;
  readonly reasonCodes: readonly string[];
}

export function calculateGoodsServicesOverlap(input: {
  leftEntries: readonly GoodsServiceTextEntry[];
  rightEntries: readonly GoodsServiceTextEntry[];
  leftNiceClasses: readonly number[];
  rightNiceClasses: readonly number[];
}): GoodsServicesOverlapResult {
  const reasonCodes: string[] = [];
  const leftTexts = input.leftEntries.map((e) => e.description).filter(Boolean);
  const rightTexts = input.rightEntries.map((e) => e.description).filter(Boolean);
  const hasText = leftTexts.length > 0 && rightTexts.length > 0;

  const leftTokens = new Set(leftTexts.flatMap(tokenize));
  const rightTokens = new Set(rightTexts.flatMap(tokenize));

  let textSim = 0;
  if (hasText) {
    let intersection = 0;
    for (const t of leftTokens) {
      if (rightTokens.has(t)) intersection += 1;
    }
    const union = leftTokens.size + rightTokens.size - intersection;
    textSim = union === 0 ? 1 : intersection / union;

    const leftJoined = normalizeGoodsText(leftTexts.join(' '));
    const rightJoined = normalizeGoodsText(rightTexts.join(' '));
    if (leftJoined === rightJoined && leftJoined.length > 0) {
      textSim = 1;
      reasonCodes.push('identical_goods_text');
    }
  } else {
    reasonCodes.push('missing_goods_text');
  }

  const sharedNice = input.leftNiceClasses.filter((c) => input.rightNiceClasses.includes(c));
  const niceJaccard =
    input.leftNiceClasses.length === 0 && input.rightNiceClasses.length === 0
      ? 0
      : sharedNice.length /
        new Set([...input.leftNiceClasses, ...input.rightNiceClasses]).size;

  const cross = crossClassStrength(input.leftNiceClasses, input.rightNiceClasses);
  if (cross > 0) reasonCodes.push('cross_class_relation');

  if (!hasText) {
    // Nice-only fallback with lower coverage — not silent zero for risk engine.
    const overall = Math.max(niceJaccard * 0.6, cross * 0.7);
    return {
      overallSimilarity: overall,
      identity: 0,
      coverage: overall > 0 ? 0.4 : 0.2,
      hasText: false,
      niceOnlyFallback: true,
      reasonCodes,
    };
  }

  const overall = Math.min(1, Math.max(textSim, niceJaccard * 0.5, cross * 0.55));
  return {
    overallSimilarity: overall,
    identity: textSim >= 0.99 ? 1 : 0,
    coverage: 0.85,
    hasText: true,
    niceOnlyFallback: false,
    reasonCodes,
  };
}
