import { PROCEDURAL_STATUSES, REGISTER_TRADEMARK_STATUSES, type ProceduralStatus, type RegisterTrademarkStatus } from '@merkwacht/domain';

/**
 * Register-agnostic status mapping used by `createConfiguredHttpConnector`
 * for the many registers that don't yet have a deep, register-specific
 * status map (compare `../boip/boip.status-map.ts`). Rather than guessing
 * at a per-register vocabulary we don't yet have documentation for, this
 * only recognizes raw values that already match Merkwacht's own
 * `ProceduralStatus`/`RegisterTrademarkStatus` enums (case-insensitively)
 * and otherwise degrades to an explicit, honest default - never a guessed
 * status. See the "no fake data" rule in
 * `docs/connectors/connector-contract.md`.
 */

function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

/** Maps a raw procedural status string to {@link ProceduralStatus}, defaulting to `'published'` for anything unrecognized. */
export function mapGenericProceduralStatus(raw: string | null | undefined): ProceduralStatus {
  if (!raw) return 'published';
  const normalized = normalizeCode(raw);
  return (PROCEDURAL_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as ProceduralStatus)
    : 'published';
}

/** Maps a raw register status string to {@link RegisterTrademarkStatus}, defaulting to `'unknown'` for anything unrecognized. */
export function mapGenericRegisterStatus(raw: string | null | undefined): RegisterTrademarkStatus {
  if (!raw) return 'unknown';
  const normalized = normalizeCode(raw);
  return (REGISTER_TRADEMARK_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as RegisterTrademarkStatus)
    : 'unknown';
}
