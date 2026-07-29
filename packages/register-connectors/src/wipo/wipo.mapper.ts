import {
  type OfficialCandidateApplication,
  type RegisteredTrademarkSnapshot,
  type OfficialTrademarkRecord,
} from '@merkwacht/domain';
import type { CandidateApplicationInput, RegisterCode } from '../core/register-types.js';
import { mapWipoProceduralStatus, mapWipoRegisterStatus } from './wipo.status-map.js';
import type { WipoTransactionRecord } from './wipo.schemas.js';
import type { WipoFixtureTrademark } from './wipo.fixtures.js';

const WIPO_REGISTRY_CODE: RegisterCode = 'WIPO';

/** Maps a validated {@link WipoTransactionRecord} (extracted from ST.66 XML) into the register-agnostic {@link OfficialCandidateApplication}. */
export function mapWipoTransactionToOfficialCandidateApplication(
  record: WipoTransactionRecord,
  options: { rawPayloadRef?: string | null; retrievedAt?: string } = {},
): OfficialCandidateApplication {
  return {
    registryCode: WIPO_REGISTRY_CODE,
    applicationNumber: record.applicationNumber,
    markText: record.markText,
    // ST.66's TransactionData doesn't carry a simple word/figurative flag
    // in the flattened subset this connector extracts - see
    // `wipo.st66-parser.ts`.
    markType: 'word',
    niceClasses: record.niceClasses,
    applicantName: record.applicantName,
    filingDate: record.filingDate,
    publicationDate: record.publicationDate,
    proceduralStatus: mapWipoProceduralStatus(record.status),
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

/** Convenience one-shot: raw validated ST.66 transaction record straight to connector output. */
export function mapWipoTransactionToCandidateApplicationInput(
  record: WipoTransactionRecord,
  options?: { rawPayloadRef?: string | null; retrievedAt?: string },
): CandidateApplicationInput {
  return officialCandidateApplicationToInput(mapWipoTransactionToOfficialCandidateApplication(record, options));
}

/** Maps a {@link WipoFixtureTrademark} (fixture-mode "own registration") into a {@link RegisteredTrademarkSnapshot}. */
export function mapWipoFixtureTrademarkToSnapshot(
  record: WipoFixtureTrademark,
  options: { retrievedAt?: string } = {},
): RegisteredTrademarkSnapshot {
  const official: OfficialTrademarkRecord = {
    registryCode: WIPO_REGISTRY_CODE,
    registrationNumber: record.registrationNumber,
    markText: record.markText,
    markType: 'word',
    niceClasses: record.niceClasses,
    applicantName: record.applicantName,
    filingDate: record.filingDate,
    registrationDate: record.registrationDate,
    registerStatus: mapWipoRegisterStatus(record.status),
    retrievedAt: options.retrievedAt ?? new Date().toISOString(),
    rawPayloadRef: null,
  };
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
