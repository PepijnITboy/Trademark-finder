import type { UsptoCaseStatusRecord, UsptoGazettePublicationRecord } from './uspto.schemas.js';

/**
 * Fictitious USPTO-shaped fixture data used by tests and by
 * `UsptoConnector` when `USPTO_USE_FIXTURES=true`. Every mark name below
 * is invented for Merkwacht and does not correspond to any real
 * registered US trademark - see the "no fake data" rule in
 * `docs/connectors/connector-contract.md`. Mirrors `../boip/boip.fixtures.ts`.
 */

export const USPTO_FIXTURE_CASE_STATUSES: readonly UsptoCaseStatusRecord[] = [
  {
    registrationNumber: 'US-7012345',
    markText: 'LUMENARY',
    niceClasses: [9, 42],
    applicantName: 'Lumenary Technologies Inc.',
    filingDate: '2022-01-15',
    registrationDate: '2022-10-04',
    status: 'REGISTERED - PRINCIPAL REGISTER',
  },
];

export const USPTO_FIXTURE_GAZETTE_PUBLICATIONS: readonly UsptoGazettePublicationRecord[] = [
  {
    applicationNumber: 'US-98765432',
    markText: 'LUMENARIS',
    niceClasses: [9, 42],
    applicantName: 'Lumenaris Digital LLC',
    filingDate: '2026-05-01',
    publicationDate: '2026-06-17',
    status: 'PUBLISHED FOR OPPOSITION',
  },
  {
    applicationNumber: 'US-98765433',
    markText: 'LUMENARY CO',
    niceClasses: [9],
    applicantName: 'Lumenary Co LLC',
    filingDate: '2026-04-20',
    publicationDate: '2026-06-03',
    status: 'PUBLISHED FOR OPPOSITION',
  },
  {
    applicationNumber: 'US-98765434',
    markText: 'BRANDFORGE',
    niceClasses: [35],
    applicantName: 'Brandforge Inc.',
    filingDate: '2026-03-10',
    publicationDate: '2026-05-20',
    status: 'PUBLISHED FOR OPPOSITION',
  },
];

/** Looks up a fixture case status by registration number, or `null` if absent (mirrors real 404 semantics). */
export function findUsptoFixtureCaseStatus(registrationNumber: string): UsptoCaseStatusRecord | null {
  return USPTO_FIXTURE_CASE_STATUSES.find((record) => record.registrationNumber === registrationNumber) ?? null;
}
