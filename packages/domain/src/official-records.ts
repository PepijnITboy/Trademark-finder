import type { MarkType, ProceduralStatus, RegisterTrademarkStatus } from './statuses.js';

/**
 * Register-agnostic, canonical shape a connector's mapper produces for a
 * single trademark registration, before it is narrowed into a
 * {@link RegisteredTrademarkSnapshot}. Kept as its own type (rather than
 * reusing `RegisteredTrademarkSnapshot` directly) so connector mapping code
 * has a stable intermediate representation that carries provenance
 * (`retrievedAt`, `rawPayloadRef`) independent of how the snapshot is
 * ultimately persisted. See `docs/connectors/connector-contract.md`.
 */
export interface OfficialTrademarkRecord {
  readonly registryCode: string;
  readonly registrationNumber: string;
  readonly markText: string;
  readonly markType: MarkType;
  readonly niceClasses: readonly number[];
  readonly applicantName: string;
  readonly filingDate: string;
  readonly registrationDate: string | null;
  readonly registerStatus: RegisterTrademarkStatus;
  /** When this record was retrieved from the official source. */
  readonly retrievedAt: string;
  /** Pointer to the archived raw connector payload, for audit purposes only. */
  readonly rawPayloadRef: string | null;
}

/**
 * Register-agnostic, canonical shape a connector's mapper produces for a
 * single published application, before it is narrowed into a
 * {@link CandidateApplicationInput}. See {@link OfficialTrademarkRecord} for
 * the rationale behind keeping this as its own intermediate type.
 */
export interface OfficialCandidateApplication {
  readonly registryCode: string;
  readonly applicationNumber: string;
  readonly markText: string;
  readonly markType: MarkType;
  readonly niceClasses: readonly number[];
  readonly applicantName: string;
  readonly filingDate: string;
  readonly publicationDate: string;
  readonly proceduralStatus: ProceduralStatus;
  /** When this record was retrieved from the official source. */
  readonly retrievedAt: string;
  /** Pointer to the archived raw connector payload, for audit purposes only. */
  readonly rawPayloadRef: string | null;
}
