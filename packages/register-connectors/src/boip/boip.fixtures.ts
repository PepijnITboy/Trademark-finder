import type { BoipPublicationRecord, BoipTrademarkRecord } from './boip.schemas.js';

/**
 * Fictitious BOIP/Datolite-shaped fixture data used by tests and by
 * `BoipConnector` when `BOIP_USE_FIXTURES=true` (local development without
 * live BOIP credentials - see `docs/connectors/boip.md`). Every mark name
 * below is invented for Merkwacht (LUMARO-style: short, distinctive,
 * non-dictionary) and does not correspond to any real registered
 * trademark. Never use this data as a substitute for live BOIP data in a
 * production code path - see the "no fake data" rule in
 * `docs/connectors/connector-contract.md`.
 */

/** The fixture "own" registration a customer might be watching. */
export const BOIP_FIXTURE_TRADEMARK_REGISTRATIONS: readonly BoipTrademarkRecord[] = [
  {
    registrationNumber: 'BX-0001234567',
    markText: 'LUMARO',
    markType: 'WORD',
    niceClasses: [9, 42],
    applicantName: 'Lumaro Technologies B.V.',
    filingDate: '2022-03-10',
    registrationDate: '2022-09-14',
    registerStatus: 'REGISTERED',
  },
  {
    registrationNumber: 'BX-0001234901',
    markText: 'NOVEXA',
    markType: 'WORD',
    niceClasses: [35, 41],
    applicantName: 'Novexa Group N.V.',
    filingDate: '2021-06-01',
    registrationDate: '2021-12-20',
    registerStatus: 'REGISTERED',
  },
];

/**
 * The fixture "publications" feed: newly published applications, some of
 * which are deliberately close to `LUMARO` above so fixture-mode local
 * development exercises the scoring pipeline end-to-end.
 */
export const BOIP_FIXTURE_PUBLICATIONS: readonly BoipPublicationRecord[] = [
  {
    applicationNumber: 'BX-2026-0004521',
    markText: 'LUMAROO',
    markType: 'WORD',
    niceClasses: [9, 42],
    applicantName: 'Lumaroo Digital B.V.',
    filingDate: '2026-05-02',
    publicationDate: '2026-05-20',
    proceduralStatus: 'PUBLISHED',
  },
  {
    applicationNumber: 'BX-2026-0004522',
    markText: 'LUMERO',
    markType: 'WORD',
    niceClasses: [9],
    applicantName: 'Lumero Solutions B.V.',
    filingDate: '2026-04-18',
    publicationDate: '2026-05-08',
    proceduralStatus: 'PUBLISHED',
  },
  {
    applicationNumber: 'BX-2026-0004530',
    markText: 'BRENTIQ',
    markType: 'WORD',
    niceClasses: [42],
    applicantName: 'Brentiq Labs B.V.',
    filingDate: '2026-03-30',
    publicationDate: '2026-04-15',
    proceduralStatus: 'PUBLISHED',
  },
  {
    applicationNumber: 'BX-2026-0004541',
    markText: 'VELORA',
    markType: 'FIGURATIVE',
    niceClasses: [25],
    applicantName: 'Velora Fashion N.V.',
    filingDate: '2026-02-11',
    publicationDate: '2026-03-01',
    proceduralStatus: 'PUBLISHED',
  },
  {
    applicationNumber: 'BX-2026-0004555',
    markText: 'KASTORIN',
    markType: 'WORD',
    niceClasses: [30],
    applicantName: 'Kastorin Foods B.V.',
    filingDate: '2026-01-22',
    publicationDate: '2026-02-10',
    proceduralStatus: 'PUBLISHED',
  },
];

/** Looks up a fixture trademark registration by registration number, or `null` if absent (mirrors real 404 semantics). */
export function findBoipFixtureTrademark(registrationNumber: string): BoipTrademarkRecord | null {
  return (
    BOIP_FIXTURE_TRADEMARK_REGISTRATIONS.find(
      (record) => record.registrationNumber === registrationNumber,
    ) ?? null
  );
}
