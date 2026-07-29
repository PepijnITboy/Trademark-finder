import {
  PROCEDURAL_STATUSES,
  REGISTER_TRADEMARK_STATUSES,
  type ProceduralStatus,
  type RegisterTrademarkStatus,
} from '@merkwacht/domain';

/**
 * Maps an EUIPO Trademark Search status code to Merkwacht's
 * {@link ProceduralStatus}/{@link RegisterTrademarkStatus}. Values here are
 * best-effort until confirmed against the live API (see
 * `docs/connectors/euipo.md`) - same "unrecognized -> explicit, never
 * guessed" rule as `../boip/boip.status-map.ts`.
 */
const EUIPO_PROCEDURAL_STATUS_MAP: Readonly<Record<string, ProceduralStatus>> = {
  FILED: 'filed',
  RECEIVED: 'filed',
  PUBLISHED: 'published',
  OPPOSITION_PENDING: 'opposition_period',
  REGISTERED: 'registered',
  OPPOSED: 'opposed',
  WITHDRAWN: 'withdrawn',
  REFUSED: 'refused',
  EXPIRED: 'expired',
  LAPSED: 'expired',
};

const EUIPO_REGISTER_STATUS_MAP: Readonly<Record<string, RegisterTrademarkStatus>> = {
  PENDING: 'pending',
  REGISTERED: 'registered',
  OPPOSED: 'opposed',
  REFUSED: 'refused',
  WITHDRAWN: 'withdrawn',
  EXPIRED: 'expired',
  LAPSED: 'expired',
};

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function mapEuipoProceduralStatus(raw: string | null | undefined): ProceduralStatus {
  if (!raw) return 'published';
  const mapped = EUIPO_PROCEDURAL_STATUS_MAP[normalizeCode(raw)];
  return mapped ?? (isProceduralStatus(raw) ? raw : 'published');
}

export function mapEuipoRegisterStatus(raw: string | null | undefined): RegisterTrademarkStatus {
  if (!raw) return 'unknown';
  const mapped = EUIPO_REGISTER_STATUS_MAP[normalizeCode(raw)];
  return mapped ?? (isRegisterStatus(raw) ? raw : 'unknown');
}

function isProceduralStatus(value: string): value is ProceduralStatus {
  return (PROCEDURAL_STATUSES as readonly string[]).includes(value);
}

function isRegisterStatus(value: string): value is RegisterTrademarkStatus {
  return (REGISTER_TRADEMARK_STATUSES as readonly string[]).includes(value);
}
