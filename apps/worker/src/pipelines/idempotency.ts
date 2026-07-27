import { createHash } from 'node:crypto';

/**
 * Deterministically stringifies `value` with object keys sorted, so two
 * structurally-identical payloads always hash to the same value regardless
 * of property insertion order. Not a general-purpose canonical JSON
 * implementation (no special-casing for `Map`/`Set`/`undefined`), but
 * sufficient for the plain `CandidateApplicationInput`-shaped objects this
 * module hashes.
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value ?? null);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`).join(',')}}`;
}

/**
 * Computes a stable content hash for a fetched payload (a single
 * connector-fetched publication/record). Used to detect whether a
 * re-fetched record actually changed since the last run, so
 * `upsertCandidateApplication` can skip a no-op write - see
 * `docs/operations/daily-jobs.md`'s idempotency section.
 */
export function computeSourceHash(payload: unknown): string {
  return createHash('sha256').update(canonicalStringify(payload)).digest('hex');
}

/** Idempotency key for a single candidate application upsert within a scan run. */
export function buildCandidateIdempotencyKey(registryCode: string, applicationNumber: string): string {
  return `candidate::${registryCode}::${applicationNumber}`;
}

/**
 * Idempotency key for a queued match job. Includes the candidate's current
 * `sourceHash` so a candidate that changes again later is re-queued for
 * scoring (rather than permanently deduped after its first appearance),
 * while a candidate that hasn't changed is never queued twice for the same
 * `(watched, candidate)` pair.
 */
export function buildMatchJobIdempotencyKey(
  watchedTrademarkId: string,
  candidateApplicationId: string,
  sourceHash: string,
): string {
  return `match::${watchedTrademarkId}::${candidateApplicationId}::${sourceHash}`;
}

/** Idempotency key for a scan run, scoped to a calendar day so re-triggering the same pipeline twice in one day is a visible, intentional operator action rather than an accidental duplicate. */
export function buildScanRunIdempotencyKey(
  type: string,
  registryCode: string | null,
  referenceDate: Date = new Date(),
): string {
  const day = referenceDate.toISOString().slice(0, 10);
  return `scan::${type}::${registryCode ?? 'ALL'}::${day}`;
}
