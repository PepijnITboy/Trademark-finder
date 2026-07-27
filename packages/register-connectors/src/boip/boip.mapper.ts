import {
  MARK_TYPES,
  type MarkType,
  type OfficialCandidateApplication,
  type OfficialTrademarkRecord,
  type RegisteredTrademarkSnapshot,
} from '@merkwacht/domain';
import type { RegisterCode } from '../core/register-types.js';
import type { CandidateApplicationInput } from '../core/register-types.js';
import { mapBoipProceduralStatus, mapBoipRegisterStatus } from './boip.status-map.js';
import type { BoipPublicationRecord, BoipTrademarkRecord } from './boip.schemas.js';

const BOIP_REGISTRY_CODE: RegisterCode = 'BOIP';

function mapMarkType(raw: string | undefined): MarkType {
  if (!raw) return 'other';
  const lower = raw.toLowerCase();
  return (MARK_TYPES as readonly string[]).includes(lower) ? (lower as MarkType) : 'other';
}

/** Maps a validated {@link BoipPublicationRecord} into the register-agnostic {@link OfficialCandidateApplication}. */
export function mapBoipPublicationToOfficialCandidateApplication(
  record: BoipPublicationRecord,
  options: { rawPayloadRef?: string | null; retrievedAt?: string } = {},
): OfficialCandidateApplication {
  return {
    registryCode: BOIP_REGISTRY_CODE,
    applicationNumber: record.applicationNumber,
    markText: record.markText,
    markType: mapMarkType(record.markType),
    niceClasses: record.niceClasses,
    applicantName: record.applicantName,
    filingDate: record.filingDate,
    publicationDate: record.publicationDate,
    proceduralStatus: mapBoipProceduralStatus(record.proceduralStatus),
    retrievedAt: options.retrievedAt ?? new Date().toISOString(),
    rawPayloadRef: options.rawPayloadRef ?? null,
  };
}

/** Maps a validated {@link BoipTrademarkRecord} into the register-agnostic {@link OfficialTrademarkRecord}. */
export function mapBoipTrademarkToOfficialRecord(
  record: BoipTrademarkRecord,
  options: { rawPayloadRef?: string | null; retrievedAt?: string } = {},
): OfficialTrademarkRecord {
  return {
    registryCode: BOIP_REGISTRY_CODE,
    registrationNumber: record.registrationNumber,
    markText: record.markText,
    markType: mapMarkType(record.markType),
    niceClasses: record.niceClasses,
    applicantName: record.applicantName,
    filingDate: record.filingDate,
    registrationDate: record.registrationDate ?? null,
    registerStatus: mapBoipRegisterStatus(record.registerStatus),
    retrievedAt: options.retrievedAt ?? new Date().toISOString(),
    rawPayloadRef: options.rawPayloadRef ?? null,
  };
}

/** Narrows an {@link OfficialCandidateApplication} into the shape `TrademarkRegisterConnector.fetchPublications` returns. */
export function officialCandidateApplicationToInput(
  official: OfficialCandidateApplication,
): CandidateApplicationInput {
  return {
    registryCode: official.registryCode,
    applicationNumber: official.applicationNumber,
    markText: official.markText,
    markType: official.markType,
    niceClasses: official.niceClasses,
    applicantName: official.applicantName,
    filingDate: official.filingDate,
    publicationDate: official.publicationDate,
    proceduralStatus: official.proceduralStatus,
    rawPayloadRef: official.rawPayloadRef,
    fetchedAt: official.retrievedAt,
  };
}

/** Narrows an {@link OfficialTrademarkRecord} into a {@link RegisteredTrademarkSnapshot}. */
export function officialTrademarkRecordToSnapshot(
  official: OfficialTrademarkRecord,
): RegisteredTrademarkSnapshot {
  return {
    registryCode: official.registryCode,
    registrationNumber: official.registrationNumber,
    markText: official.markText,
    markType: official.markType,
    niceClasses: official.niceClasses,
    applicantName: official.applicantName,
    filingDate: official.filingDate,
    registrationDate: official.registrationDate,
    registerStatus: official.registerStatus,
    lastCheckedAt: official.retrievedAt,
  };
}

/** Convenience one-shot: raw validated publication record straight to connector output. */
export function mapBoipPublicationToCandidateApplicationInput(
  record: BoipPublicationRecord,
  options?: { rawPayloadRef?: string | null; retrievedAt?: string },
): CandidateApplicationInput {
  return officialCandidateApplicationToInput(
    mapBoipPublicationToOfficialCandidateApplication(record, options),
  );
}

/** Convenience one-shot: raw validated trademark record straight to connector output. */
export function mapBoipTrademarkToSnapshot(
  record: BoipTrademarkRecord,
  options?: { rawPayloadRef?: string | null; retrievedAt?: string },
): RegisteredTrademarkSnapshot {
  return officialTrademarkRecordToSnapshot(mapBoipTrademarkToOfficialRecord(record, options));
}
