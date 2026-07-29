import {
  MARK_TYPES,
  type MarkType,
  type OfficialCandidateApplication,
  type OfficialTrademarkRecord,
  type RegisteredTrademarkSnapshot,
} from '@merkwacht/domain';
import type { RegisterCode } from '../core/register-types.js';
import type { CandidateApplicationInput } from '../core/register-types.js';
import { mapGenericProceduralStatus, mapGenericRegisterStatus } from './generic.status-map.js';
import type { GenericPublicationRecord, GenericTrademarkRecord } from './generic.schemas.js';

function mapMarkType(raw: string | undefined): MarkType {
  if (!raw) return 'other';
  const lower = raw.toLowerCase();
  return (MARK_TYPES as readonly string[]).includes(lower) ? (lower as MarkType) : 'other';
}

/** Maps a validated {@link GenericPublicationRecord} into the register-agnostic {@link OfficialCandidateApplication}. Mirrors `../boip/boip.mapper.ts`. */
export function mapGenericPublicationToOfficialCandidateApplication(
  registryCode: RegisterCode,
  record: GenericPublicationRecord,
  options: { rawPayloadRef?: string | null; retrievedAt?: string } = {},
): OfficialCandidateApplication {
  return {
    registryCode,
    applicationNumber: record.applicationNumber,
    markText: record.markText,
    markType: mapMarkType(record.markType),
    niceClasses: record.niceClasses,
    applicantName: record.applicantName,
    filingDate: record.filingDate,
    publicationDate: record.publicationDate,
    proceduralStatus: mapGenericProceduralStatus(record.proceduralStatus),
    retrievedAt: options.retrievedAt ?? new Date().toISOString(),
    rawPayloadRef: options.rawPayloadRef ?? null,
  };
}

/** Maps a validated {@link GenericTrademarkRecord} into the register-agnostic {@link OfficialTrademarkRecord}. */
export function mapGenericTrademarkToOfficialRecord(
  registryCode: RegisterCode,
  record: GenericTrademarkRecord,
  options: { rawPayloadRef?: string | null; retrievedAt?: string } = {},
): OfficialTrademarkRecord {
  return {
    registryCode,
    registrationNumber: record.registrationNumber,
    markText: record.markText,
    markType: mapMarkType(record.markType),
    niceClasses: record.niceClasses,
    applicantName: record.applicantName,
    filingDate: record.filingDate,
    registrationDate: record.registrationDate ?? null,
    registerStatus: mapGenericRegisterStatus(record.registerStatus),
    retrievedAt: options.retrievedAt ?? new Date().toISOString(),
    rawPayloadRef: options.rawPayloadRef ?? null,
  };
}

function officialCandidateApplicationToInput(official: OfficialCandidateApplication): CandidateApplicationInput {
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

function officialTrademarkRecordToSnapshot(official: OfficialTrademarkRecord): RegisteredTrademarkSnapshot {
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
export function mapGenericPublicationToCandidateApplicationInput(
  registryCode: RegisterCode,
  record: GenericPublicationRecord,
  options?: { rawPayloadRef?: string | null; retrievedAt?: string },
): CandidateApplicationInput {
  return officialCandidateApplicationToInput(
    mapGenericPublicationToOfficialCandidateApplication(registryCode, record, options),
  );
}

/** Convenience one-shot: raw validated trademark record straight to connector output. */
export function mapGenericTrademarkToSnapshot(
  registryCode: RegisterCode,
  record: GenericTrademarkRecord,
  options?: { rawPayloadRef?: string | null; retrievedAt?: string },
): RegisteredTrademarkSnapshot {
  return officialTrademarkRecordToSnapshot(mapGenericTrademarkToOfficialRecord(registryCode, record, options));
}
