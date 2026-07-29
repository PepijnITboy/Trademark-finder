import type { CandidateApplication, ConnectorHealthStatus, OppositionDeadline } from '@merkwacht/domain';
import type { SourceCheckpoint } from './source-checkpoint.js';

/**
 * Every register code Merkwacht has a connector for, kept in lockstep with
 * `packages/domain/src/register-catalog.ts` (the platform-managed catalog
 * of registers customers can pick from). `BOIP`, `EUIPO`, `USPTO`, and
 * `WIPO` have deep, register-specific implementations (`src/boip`,
 * `src/euipo`, `src/uspto`, `src/wipo`); every other code is wired through
 * the generic HTTP factory in `src/generic/configured-http.connector.ts`
 * via `src/catalog/create-all-connectors.ts`. See
 * `docs/connectors/connector-contract.md`.
 */
export const REGISTER_CODES = [
  'BOIP',
  'EUIPO',
  'WIPO',
  'UKIPO',
  'DPMA',
  'INPI',
  'OEPM',
  'UIBM',
  'IPI_CH',
  'PRH',
  'PRV',
  'DKPTO',
  'NIPO',
  'IPO_IE',
  'INPI_PT',
  'OEPA',
  'UPRP',
  'UPV_CZ',
  'HIPO',
  'OBI',
  'OSIM',
  'BPO',
  'SIPO_HR',
  'IPO_SK',
  'SIPO_SI',
  'VLS',
  'LRPV',
  'EPA',
  'DRCOR',
  'IPOMT',
  'USPTO',
  'CIPO',
  'IPAU',
  'INPI_BR',
  'CIPC',
  'IMPI',
  'JPO',
  'KIPO',
  'IPO_IN',
  'CNIPA',
] as const;
/** Every register connector Merkwacht currently supports. */
export type RegisterCode = (typeof REGISTER_CODES)[number];

/**
 * The shape a connector produces for a single fetched publication, before
 * persistence assigns it an `id`. `oppositionDeadline` is optional at fetch
 * time — it is filled in by the `calculate_opposition_deadlines` job using
 * `@merkwacht/opposition-rules` and the connector's own rule set.
 */
export type CandidateApplicationInput = Omit<
  CandidateApplication,
  'id' | 'oppositionDeadline'
> & {
  readonly oppositionDeadline?: OppositionDeadline | null;
};

/** Parameters accepted by {@link TrademarkRegisterConnector.fetchPublications}. */
export interface FetchPublicationsParams {
  /** Resume from this checkpoint, if present. `null`/omitted means "from the beginning". */
  readonly since?: SourceCheckpoint | null;
  /** Upper bound on the number of applications to fetch in a single call. */
  readonly pageSize?: number;
}

/** Result of a single {@link TrademarkRegisterConnector.fetchPublications} call. */
export interface FetchPublicationsResult {
  readonly applications: readonly CandidateApplicationInput[];
  /** Checkpoint to persist and pass as `since` on the next call, or `null` if the connector doesn't support incremental fetching. */
  readonly nextCheckpoint: SourceCheckpoint | null;
  /** `true` if more pages are available and the caller should call again with `nextCheckpoint` before the run is considered complete. */
  readonly hasMore: boolean;
}

/** Result of {@link TrademarkRegisterConnector.healthCheck}. */
export interface ConnectorHealthReport {
  readonly status: ConnectorHealthStatus;
  readonly message: string;
  readonly checkedAt: string;
}
