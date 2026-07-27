import type { ClassOverlapResult } from './types.js';

/**
 * Computes the overlap between two sets of Nice classification classes.
 * Pure and order-independent - duplicate classes in the input are
 * deduplicated before comparison. Mirrors the Jaccard-based approach
 * `@merkwacht/scoring`'s `niceClassOverlapCalculator` uses internally, but
 * exposed here with the full breakdown (not just a single `0..1` score) for
 * UI/product surfaces that want to explain *which* classes overlap.
 */
export function calculateClassOverlap(
  first: readonly number[],
  second: readonly number[],
): ClassOverlapResult {
  const a = new Set(first);
  const b = new Set(second);

  const overlappingClasses = [...a].filter((klass) => b.has(klass)).sort((x, y) => x - y);
  const onlyInFirst = [...a].filter((klass) => !b.has(klass)).sort((x, y) => x - y);
  const onlyInSecond = [...b].filter((klass) => !a.has(klass)).sort((x, y) => x - y);

  const unionSize = new Set([...a, ...b]).size;
  const intersectionSize = overlappingClasses.length;
  const jaccard = unionSize === 0 ? 0 : intersectionSize / unionSize;

  return {
    overlappingClasses,
    onlyInFirst,
    onlyInSecond,
    jaccard,
    intersectionSize,
    unionSize,
  };
}
