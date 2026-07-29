import type { EuipoPublicationRecord, EuipoTrademarkRecord } from './euipo.schemas.js';

/**
 * Fictitious EUIPO-shaped fixture data used by tests and by
 * `EuipoConnector` when `EUIPO_USE_FIXTURES=true`. Every mark name below is
 * invented for Merkwacht and does not correspond to any real registered
 * EU trademark - see the "no fake data" rule in
 * `docs/connectors/connector-contract.md`. Mirrors `../boip/boip.fixtures.ts`.
 */

export const EUIPO_FIXTURE_TRADEMARK_REGISTRATIONS: readonly EuipoTrademarkRecord[] = [
  {
    registrationNumber: 'EU-018123456',
    markText: 'LUMENTIA',
    markFeature: 'WORD',
    niceClasses: [9, 42],
    applicantName: 'Lumentia Technologies GmbH',
    filingDate: '2022-02-01',
    registrationDate: '2022-08-15',
    status: 'REGISTERED',
  },
];

export const EUIPO_FIXTURE_PUBLICATIONS: readonly EuipoPublicationRecord[] = [
  {
    applicationNumber: 'EU-018987001',
    markText: 'LUMENTIO',
    markFeature: 'WORD',
    niceClasses: [9, 42],
    applicantName: 'Lumentio Digital SE',
    filingDate: '2026-06-01',
    publicationDate: '2026-06-22',
    status: 'PUBLISHED',
  },
  {
    applicationNumber: 'EU-018987002',
    markText: 'LUMENTA',
    markFeature: 'WORD',
    niceClasses: [9],
    applicantName: 'Lumenta Group NV',
    filingDate: '2026-05-20',
    publicationDate: '2026-06-10',
    status: 'PUBLISHED',
  },
  {
    applicationNumber: 'EU-018987003',
    markText: 'BRANDOVIA',
    markFeature: 'WORD',
    niceClasses: [35, 42],
    applicantName: 'Brandovia Ventures SA',
    filingDate: '2026-04-11',
    publicationDate: '2026-05-01',
    status: 'PUBLISHED',
  },
];

/** Looks up a fixture trademark registration by registration number, or `null` if absent (mirrors real 404 semantics). */
export function findEuipoFixtureTrademark(registrationNumber: string): EuipoTrademarkRecord | null {
  return (
    EUIPO_FIXTURE_TRADEMARK_REGISTRATIONS.find((record) => record.registrationNumber === registrationNumber) ?? null
  );
}
