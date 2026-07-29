import {
  PROCEDURAL_STATUSES,
  REGISTER_TRADEMARK_STATUSES,
  type ProceduralStatus,
  type RegisterTrademarkStatus,
} from '@merkwacht/domain';

/**
 * Maps an ST.66 `MarkCurrentStatusCode` value to Merkwacht's
 * {@link ProceduralStatus}/{@link RegisterTrademarkStatus}. Madrid
 * designations can additionally carry a *different* status per designated
 * Contracting Party, which this flattened mapping does not represent (see
 * `docs/connectors/wipo.md`) - it reflects the international
 * registration's own status only. Same "unrecognized -> explicit default,
 * never guessed" rule as `../boip/boip.status-map.ts`.
 */
const WIPO_PROCEDURAL_STATUS_MAP: Readonly<Record<string, ProceduralStatus>> = {
  RECORDED: 'filed',
  PUBLISHED: 'published',
  REGISTERED: 'registered',
  'PROVISIONAL REFUSAL': 'opposition_period',
  OPPOSED: 'opposed',
  WITHDRAWN: 'withdrawn',
  REFUSED: 'refused',
  CANCELLED: 'expired',
  EXPIRED: 'expired',
};

const WIPO_REGISTER_STATUS_MAP: Readonly<Record<string, RegisterTrademarkStatus>> = {
  RECORDED: 'pending',
  PUBLISHED: 'pending',
  REGISTERED: 'registered',
  OPPOSED: 'opposed',
  WITHDRAWN: 'withdrawn',
  REFUSED: 'refused',
  CANCELLED: 'expired',
  EXPIRED: 'expired',
};

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function mapWipoProceduralStatus(raw: string | null | undefined): ProceduralStatus {
  if (!raw) return 'published';
  const mapped = WIPO_PROCEDURAL_STATUS_MAP[normalizeCode(raw)];
  return mapped ?? (isProceduralStatus(raw) ? raw : 'published');
}

export function mapWipoRegisterStatus(raw: string | null | undefined): RegisterTrademarkStatus {
  if (!raw) return 'unknown';
  const mapped = WIPO_REGISTER_STATUS_MAP[normalizeCode(raw)];
  return mapped ?? (isRegisterStatus(raw) ? raw : 'unknown');
}

function isProceduralStatus(value: string): value is ProceduralStatus {
  return (PROCEDURAL_STATUSES as readonly string[]).includes(value);
}

function isRegisterStatus(value: string): value is RegisterTrademarkStatus {
  return (REGISTER_TRADEMARK_STATUSES as readonly string[]).includes(value);
}
