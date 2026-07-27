import type { CandidateApplication, ConnectorHealthStatus, OppositionDeadline } from '@merkwacht/domain';
import type { SourceCheckpoint } from './source-checkpoint.js';

export const REGISTER_CODES = ['BOIP'] as const;
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
