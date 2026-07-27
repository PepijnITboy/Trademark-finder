import { createHash } from 'node:crypto';

/**
 * Everything that determines whether two AI enrichment calls would produce
 * an equivalent assessment. Keyed on the `(watched, candidate)` mark-text
 * pair plus `promptVersion` and `model` so a prompt or model change never
 * serves a stale cached response - see `docs/scoring/ai-layer.md` and the
 * `ai_response_cache` table in `supabase/migrations`.
 */
export interface AiCacheKeyInput {
  readonly watchedMarkText: string;
  readonly candidateMarkText: string;
  readonly niceClasses?: readonly number[];
  readonly promptVersion: string;
  readonly model: string;
}

function canonicalize(input: AiCacheKeyInput): string {
  return JSON.stringify({
    watchedMarkText: input.watchedMarkText.trim().toUpperCase(),
    candidateMarkText: input.candidateMarkText.trim().toUpperCase(),
    niceClasses: [...(input.niceClasses ?? [])].sort((a, b) => a - b),
    promptVersion: input.promptVersion,
    model: input.model,
  });
}

/**
 * Builds a stable, hash-based cache key for an AI enrichment request.
 * Deterministic and order-independent (Nice classes are sorted, mark text
 * is case/whitespace-normalized) so requests that are semantically
 * identical but constructed in a different order still hit the same cache
 * entry.
 */
export function buildAiCacheKey(input: AiCacheKeyInput): string {
  const hash = createHash('sha256').update(canonicalize(input)).digest('hex');
  return `ai:${input.promptVersion}:${hash}`;
}

export interface AiCacheEntry<T> {
  readonly value: T;
  readonly cachedAt: string;
  readonly expiresAt: string | null;
}

/**
 * Minimal in-memory response cache, keyed by {@link buildAiCacheKey}. Mirrors
 * the shape of the `ai_response_cache` table for local development/tests
 * without a database - a Postgres-backed implementation should satisfy the
 * same `get`/`set` contract. Not safe to share across processes; each
 * `apps/worker` instance holds its own.
 */
export class InMemoryAiResponseCache<T> {
  private readonly entries = new Map<string, AiCacheEntry<T>>();

  constructor(private readonly defaultTtlMs: number | null = 24 * 60 * 60 * 1000) {}

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number | null = this.defaultTtlMs): void {
    const now = Date.now();
    this.entries.set(key, {
      value,
      cachedAt: new Date(now).toISOString(),
      expiresAt: ttlMs === null ? null : new Date(now + ttlMs).toISOString(),
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
