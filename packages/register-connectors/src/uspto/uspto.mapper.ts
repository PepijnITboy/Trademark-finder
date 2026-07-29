import {
  type OfficialCandidateApplication,
  type OfficialTrademarkRecord,
  type RegisteredTrademarkSnapshot,
} from '@merkwacht/domain';
import type { CandidateApplicationInput, RegisterCode } from '../core/register-types.js';
import { mapUsptoProceduralStatus, mapUsptoRegisterStatus } from './uspto.status-map.js';
import type { UsptoCaseStatusRecord, UsptoGazettePublicationRecord } from './uspto.schemas.js';

const USPTO_REGISTRY_CODE: RegisterCode = 'USPTO';

/**
 * Maps a validated {@link UsptoGazettePublicationRecord} into the
 * register-agnostic {@link OfficialCandidateApplication}. USPTO's Gazette
 * feed doesn't report mark type (word/figurative/combined) in the flattened
 * shape this connector consumes, so it is always `'word'` until a richer
 * feed is wired up - see `docs/connectors/uspto.md`.
 */
export function mapUsptoPublicationToOfficialCandidateApplication(
  record: UsptoGazettePublicationRecord,
  options: { rawPayloadRef?: string | null; retrievedAt?: string } = {},
): OfficialCandidateApplication {
  return {
    registryCode: USPTO_REGISTRY_CODE,
    applicationNumber: record.applicationNumber,
    markText: record.markText,
    markType: 'word',
    niceClasses: record.niceClasses,
    applicantName: record.applicantName,
    filingDate: record.filingDate,
    publicationDate: record.publicationDate,
    proceduralStatus: mapUsptoProceduralStatus(record.status),
    retrievedAt: options.retrievedAt ?? new Date().toISOString(),
    rawPayloadRef: options.rawPayloadRef ?? null,
  };
}

/** Maps a validated {@link UsptoCaseStatusRecord} (TSDR) into the register-agnostic {@link OfficialTrademarkRecord}. */
export function mapUsptoCaseStatusToOfficialRecord(
  record: UsptoCaseStatusRecord,
  options: { rawPayloadRef?: string | null; retrievedAt?: string } = {},
): OfficialTrademarkRecord {
  return {
    registryCode: USPTO_REGISTRY_CODE,
    registrationNumber: record.registrationNumber,
    markText: record.markText,
    markType: 'word',
    niceClasses: record.niceClasses,
    applicantName: record.applicantName,
    filingDate: record.filingDate,
    registrationDate: record.registrationDate ?? null,
    registerStatus: mapUsptoRegisterStatus(record.status),
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

/** Convenience one-shot: raw validated Gazette record straight to connector output. */
export function mapUsptoPublicationToCandidateApplicationInput(
  record: UsptoGazettePublicationRecord,
  options?: { rawPayloadRef?: string | null; retrievedAt?: string },
): CandidateApplicationInput {
  return officialCandidateApplicationToInput(mapUsptoPublicationToOfficialCandidateApplication(record, options));
}

/** Convenience one-shot: raw validated TSDR case status record straight to connector output. */
export function mapUsptoCaseStatusToSnapshot(
  record: UsptoCaseStatusRecord,
  options?: { rawPayloadRef?: string | null; retrievedAt?: string },
): RegisteredTrademarkSnapshot {
  return officialTrademarkRecordToSnapshot(mapUsptoCaseStatusToOfficialRecord(record, options));
}
