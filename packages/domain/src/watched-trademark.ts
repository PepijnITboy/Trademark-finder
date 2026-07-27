import type { MarkType, RegisterTrademarkStatus, WatchedTrademarkStatus } from './statuses.js';
import type { WatchEligibilityDecision } from './watch-eligibility/types.js';

/**
 * The last-known state of the actual register entry backing a
 * {@link WatchedTrademark}, refreshed periodically by the
 * `refresh_watched_snapshot` job. See `docs/domain/trademark-model.md`.
 */
export interface RegisteredTrademarkSnapshot {
  readonly registryCode: string;
  readonly registrationNumber: string;
  readonly markText: string;
  readonly markType: MarkType;
  readonly niceClasses: readonly number[];
  readonly applicantName: string;
  readonly filingDate: string;
  readonly registrationDate: string | null;
  readonly registerStatus: RegisterTrademarkStatus;
  readonly lastCheckedAt: string;
}

/**
 * A trademark a customer organization has asked Merkwacht to monitor.
 * Produces {@link TrademarkMatch} records only while `eligibility.eligible`
 * is `true` — see `packages/domain/src/watch-eligibility`.
 */
export interface WatchedTrademark {
  readonly id: string;
  readonly organizationId: string;
  readonly label: string;
  readonly status: WatchedTrademarkStatus;
  readonly eligibility: WatchEligibilityDecision;
  readonly snapshot: RegisteredTrademarkSnapshot;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Input shape accepted when a customer creates a new watched trademark. */
export interface CreateWatchedTrademarkInput {
  readonly organizationId: string;
  readonly label: string;
  readonly registryCode: string;
  readonly registrationNumber: string;
}
