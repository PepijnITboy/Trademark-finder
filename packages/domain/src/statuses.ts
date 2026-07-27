/**
 * Central vocabulary for status/enum-like unions used across the Merkwacht
 * domain. Every union is backed by a `readonly [...] as const` array so
 * consumers can iterate the valid values (e.g. to render a `<select>`,
 * validate input, or drive a Zod enum) without duplicating the literal list.
 */

export const MARK_TYPES = ['word', 'figurative', 'combined', 'other'] as const;
/** How a mark is represented in a register filing. */
export type MarkType = (typeof MARK_TYPES)[number];

export const WATCHED_TRADEMARK_STATUSES = ['active', 'paused', 'expired', 'archived'] as const;
/**
 * Lifecycle status of a {@link WatchedTrademark} within Merkwacht itself.
 * Distinct from {@link RegisterTrademarkStatus}, which reflects the
 * register's own reported status of the underlying registration.
 */
export type WatchedTrademarkStatus = (typeof WATCHED_TRADEMARK_STATUSES)[number];

export const REGISTER_TRADEMARK_STATUSES = [
  'pending',
  'registered',
  'opposed',
  'refused',
  'withdrawn',
  'expired',
  'unknown',
] as const;
/** Status of a registration as reported by the register itself. */
export type RegisterTrademarkStatus = (typeof REGISTER_TRADEMARK_STATUSES)[number];

export const PROCEDURAL_STATUSES = [
  'filed',
  'published',
  'opposition_period',
  'registered',
  'opposed',
  'withdrawn',
  'refused',
  'expired',
] as const;
/** Lifecycle status of a {@link CandidateApplication} as reported by a register. */
export type ProceduralStatus = (typeof PROCEDURAL_STATUSES)[number];

export const MATCH_STATUSES = [
  'new',
  'under_review',
  'confirmed_conflict',
  'dismissed',
  'opposition_filed',
  'opposition_deadline_passed',
] as const;
/** Customer/operator-facing lifecycle status of a {@link TrademarkMatch}. */
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const JOB_STATUSES = ['pending', 'running', 'succeeded', 'failed', 'skipped'] as const;
/** Execution status of a {@link ProcessingJob}. */
export type JobStatus = (typeof JOB_STATUSES)[number];

export const CONNECTOR_HEALTH_STATUSES = [
  'ok',
  'configuration_required',
  'degraded',
  'unavailable',
] as const;
/**
 * Health of a register connector. `configuration_required` and
 * `unavailable` must never be papered over with fabricated data — see
 * `docs/connectors/connector-contract.md`.
 */
export type ConnectorHealthStatus = (typeof CONNECTOR_HEALTH_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ['email', 'in_app'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
