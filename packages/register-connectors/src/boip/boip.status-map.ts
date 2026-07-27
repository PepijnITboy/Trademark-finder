import {
  PROCEDURAL_STATUSES,
  REGISTER_TRADEMARK_STATUSES,
  type ProceduralStatus,
  type RegisterTrademarkStatus,
} from '@merkwacht/domain';

/**
 * Maps a BOIP/Datolite procedural status code to Merkwacht's
 * {@link ProceduralStatus}. BOIP reports status in Dutch/French/English
 * depending on the requested locale; Datolite's canonical codes (left-hand
 * side) are UPPER_SNAKE_CASE regardless of locale, which is what this map
 * keys on. Values here are best-effort until confirmed against the live
 * Datolite API (see `docs/connectors/boip.md`) - anything unrecognized maps
 * to `'published'` rather than being guessed more specifically, and is
 * still surfaced (never silently dropped).
 */
const BOIP_PROCEDURAL_STATUS_MAP: Readonly<Record<string, ProceduralStatus>> = {
  FILED: 'filed',
  PUBLISHED: 'published',
  OPPOSITION_PERIOD: 'opposition_period',
  REGISTERED: 'registered',
  OPPOSED: 'opposed',
  WITHDRAWN: 'withdrawn',
  REFUSED: 'refused',
  EXPIRED: 'expired',
};

/**
 * Maps a BOIP/Datolite register status code to Merkwacht's
 * {@link RegisterTrademarkStatus}. See {@link BOIP_PROCEDURAL_STATUS_MAP}
 * for the same "unrecognized -> explicit unknown, never guessed" rule.
 */
const BOIP_REGISTER_STATUS_MAP: Readonly<Record<string, RegisterTrademarkStatus>> = {
  PENDING: 'pending',
  REGISTERED: 'registered',
  OPPOSED: 'opposed',
  REFUSED: 'refused',
  WITHDRAWN: 'withdrawn',
  EXPIRED: 'expired',
};

/** Normalizes a raw status code for lookup: trims and upper-cases. */
function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Maps a raw BOIP procedural status string to {@link ProceduralStatus}.
 * Returns `'published'` (never throws) for unrecognized codes so a single
 * unexpected status value never fails an entire fetch - see the
 * "no fake data, but degrade gracefully on enums" note in
 * `docs/connectors/connector-contract.md`.
 */
export function mapBoipProceduralStatus(raw: string | null | undefined): ProceduralStatus {
  if (!raw) return 'published';
  const mapped = BOIP_PROCEDURAL_STATUS_MAP[normalizeCode(raw)];
  return mapped ?? (isProceduralStatus(raw) ? raw : 'published');
}

/**
 * Maps a raw BOIP register status string to {@link RegisterTrademarkStatus}.
 * Returns `'unknown'` (never throws) for unrecognized codes, which is a
 * meaningful, explicit value in this enum (unlike `ProceduralStatus`).
 */
export function mapBoipRegisterStatus(raw: string | null | undefined): RegisterTrademarkStatus {
  if (!raw) return 'unknown';
  const mapped = BOIP_REGISTER_STATUS_MAP[normalizeCode(raw)];
  return mapped ?? (isRegisterStatus(raw) ? raw : 'unknown');
}

function isProceduralStatus(value: string): value is ProceduralStatus {
  return (PROCEDURAL_STATUSES as readonly string[]).includes(value);
}

function isRegisterStatus(value: string): value is RegisterTrademarkStatus {
  return (REGISTER_TRADEMARK_STATUSES as readonly string[]).includes(value);
}
