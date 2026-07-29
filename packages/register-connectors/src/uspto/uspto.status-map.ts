import {
  PROCEDURAL_STATUSES,
  REGISTER_TRADEMARK_STATUSES,
  type ProceduralStatus,
  type RegisterTrademarkStatus,
} from '@merkwacht/domain';

/**
 * Maps a USPTO TSDR/Gazette status phrase to Merkwacht's
 * {@link ProceduralStatus}/{@link RegisterTrademarkStatus}. USPTO reports
 * status as free-text phrases (e.g. "PUBLISHED FOR OPPOSITION") rather
 * than short codes - this map covers the most common ones and, like
 * `../boip/boip.status-map.ts`, degrades to an explicit default (never a
 * guess) for anything unrecognized. Confirm against live TSDR responses
 * before production use - see `docs/connectors/uspto.md`.
 */
const USPTO_PROCEDURAL_STATUS_MAP: Readonly<Record<string, ProceduralStatus>> = {
  'NEW APPLICATION': 'filed',
  'NEW APPLICATION - RECORD INITIALIZED': 'filed',
  'PUBLISHED FOR OPPOSITION': 'opposition_period',
  'NOTICE OF PUBLICATION': 'published',
  'OPPOSITION FILED': 'opposed',
  'REGISTERED': 'registered',
  'REGISTERED - PRINCIPAL REGISTER': 'registered',
  ABANDONED: 'withdrawn',
  'ABANDONED - FAILURE TO RESPOND': 'withdrawn',
  'ABANDONED - AFTER PUBLICATION': 'withdrawn',
  REFUSED: 'refused',
  CANCELLED: 'expired',
  EXPIRED: 'expired',
};

const USPTO_REGISTER_STATUS_MAP: Readonly<Record<string, RegisterTrademarkStatus>> = {
  'NEW APPLICATION': 'pending',
  'PUBLISHED FOR OPPOSITION': 'pending',
  'OPPOSITION FILED': 'opposed',
  'REGISTERED': 'registered',
  'REGISTERED - PRINCIPAL REGISTER': 'registered',
  ABANDONED: 'withdrawn',
  REFUSED: 'refused',
  CANCELLED: 'expired',
  EXPIRED: 'expired',
};

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function mapUsptoProceduralStatus(raw: string | null | undefined): ProceduralStatus {
  if (!raw) return 'published';
  const mapped = USPTO_PROCEDURAL_STATUS_MAP[normalizeCode(raw)];
  return mapped ?? (isProceduralStatus(raw) ? raw : 'published');
}

export function mapUsptoRegisterStatus(raw: string | null | undefined): RegisterTrademarkStatus {
  if (!raw) return 'unknown';
  const mapped = USPTO_REGISTER_STATUS_MAP[normalizeCode(raw)];
  return mapped ?? (isRegisterStatus(raw) ? raw : 'unknown');
}

function isProceduralStatus(value: string): value is ProceduralStatus {
  return (PROCEDURAL_STATUSES as readonly string[]).includes(value);
}

function isRegisterStatus(value: string): value is RegisterTrademarkStatus {
  return (REGISTER_TRADEMARK_STATUSES as readonly string[]).includes(value);
}
