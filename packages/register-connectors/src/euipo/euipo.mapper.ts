import {
  MARK_TYPES,
  type MarkType,
  type OfficialCandidateApplication,
  type OfficialTrademarkRecord,
  type RegisteredTrademarkSnapshot,
} from '@merkwacht/domain';
import type { CandidateApplicationInput, RegisterCode } from '../core/register-types.js';
import { mapEuipoProceduralStatus, mapEuipoRegisterStatus } from './euipo.status-map.js';
import type { EuipoPublicationRecord, EuipoTrademarkRecord } from './euipo.schemas.js';

const EUIPO_REGISTRY_CODE: RegisterCode = 'EUIPO';

function mapMarkType(raw: string | undefined): MarkType {
  if (!raw) return 'other';
  const lower = raw.toLowerCase();
  return (MARK_TYPES as readonly string[]).includes(lower) ? (lower as MarkType) : 'other';
}

/** Maps a validated {@link EuipoPublicationRecord} into the register-agnostic {@link OfficialCandidateApplication}. */
export function mapEuipoPublicationToOfficialCandidateApplication(
  record: EuipoPublicationRecord,
  options: { rawPayloadRef?: string | null; retrievedAt?: string } = {},
): OfficialCandidateApplication {
  return {
    registryCode: EUIPO_REGISTRY_CODE,
    applicationNumber: record.applicationNumber,
    markText: record.markText,
    markType: mapMarkType(record.markFeature),
    niceClasses: record.niceClasses,
    applicantName: record.applicantName,
    filingDate: record.filingDate,
    publicationDate: record.publicationDate,
    proceduralStatus: mapEuipoProceduralStatus(record.status),
    retrievedAt: options.retrievedAt ?? new Date().toISOString(),
    rawPayloadRef: options.rawPayloadRef ?? null,
  };
}

/** Maps a validated {@link EuipoTrademarkRecord} into the register-agnostic {@link OfficialTrademarkRecord}. */
export function mapEuipoTrademarkToOfficialRecord(
  record: EuipoTrademarkRecord,
  options: { rawPayloadRef?: string | null; retrievedAt?: string } = {},
): OfficialTrademarkRecord {
  return {
    registryCode: EUIPO_REGISTRY_CODE,
    registrationNumber: record.registrationNumber,
    markText: record.markText,
    markType: mapMarkType(record.markFeature),
    niceClasses: record.niceClasses,
    applicantName: record.applicantName,
    filingDate: record.filingDate,
    registrationDate: record.registrationDate ?? null,
    registerStatus: mapEuipoRegisterStatus(record.status),
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
export function mapEuipoPublicationToCandidateApplicationInput(
  record: EuipoPublicationRecord,
  options?: { rawPayloadRef?: string | null; retrievedAt?: string },
): CandidateApplicationInput {
  return officialCandidateApplicationToInput(mapEuipoPublicationToOfficialCandidateApplication(record, options));
}

/** Convenience one-shot: raw validated trademark record straight to connector output. */
export function mapEuipoTrademarkToSnapshot(
  record: EuipoTrademarkRecord,
  options?: { rawPayloadRef?: string | null; retrievedAt?: string },
): RegisteredTrademarkSnapshot {
  return officialTrademarkRecordToSnapshot(mapEuipoTrademarkToOfficialRecord(record, options));
}
