/**
 * Fictitious WIPO Madrid-shaped fixture data used by tests and by
 * `WipoMadridConnector` when `WIPO_USE_FIXTURES=true`. Every mark name
 * below is invented for Merkwacht and does not correspond to any real
 * international registration - see the "no fake data" rule in
 * `docs/connectors/connector-contract.md`. Mirrors `../boip/boip.fixtures.ts`.
 */

export interface WipoFixtureTrademark {
  readonly registrationNumber: string;
  readonly markText: string;
  readonly niceClasses: readonly number[];
  readonly applicantName: string;
  readonly filingDate: string;
  readonly registrationDate: string | null;
  readonly status?: string;
}

/** The fixture "own" international registration a customer might be watching. */
export const WIPO_FIXTURE_TRADEMARK_REGISTRATIONS: readonly WipoFixtureTrademark[] = [
  {
    registrationNumber: 'WO-1876543',
    markText: 'LUMAROINT',
    niceClasses: [9, 42],
    applicantName: 'Lumaro International SA',
    filingDate: '2021-11-02',
    registrationDate: '2022-03-18',
    status: 'REGISTERED',
  },
];

/**
 * Sample ST.66-shaped fixture XML representing one WIPO Madrid daily
 * delta file's contents. Structurally mirrors the real `TransactionData`
 * element `wipo.st66-parser.ts` extracts from (application number, mark
 * text, Nice classes, applicant, filing/publication dates, status) - see
 * `docs/connectors/wipo.md` for how this compares to a real ST.66 file.
 */
export const WIPO_ST66_FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Transaction>
  <TransactionData>
    <MarkCurrentStatusCode>Published</MarkCurrentStatusCode>
    <ApplicationNumber>WO-2026-0001111</ApplicationNumber>
    <MarkVerbalElementText>LUMAROWORLD</MarkVerbalElementText>
    <ClassNumber>9</ClassNumber>
    <ClassNumber>42</ClassNumber>
    <ApplicantName>Lumaroworld Holding SA</ApplicantName>
    <FilingDate>2026-05-01</FilingDate>
    <PublicationDate>2026-06-15</PublicationDate>
  </TransactionData>
  <TransactionData>
    <MarkCurrentStatusCode>Published</MarkCurrentStatusCode>
    <ApplicationNumber>WO-2026-0001112</ApplicationNumber>
    <MarkVerbalElementText>NOVEXAGLOBAL</MarkVerbalElementText>
    <ClassNumber>42</ClassNumber>
    <ApplicantName>Novexa Global AG</ApplicantName>
    <FilingDate>2026-04-12</FilingDate>
    <PublicationDate>2026-05-30</PublicationDate>
  </TransactionData>
  <TransactionData>
    <MarkCurrentStatusCode>Published</MarkCurrentStatusCode>
    <ApplicationNumber>WO-2026-0001113</ApplicationNumber>
    <MarkVerbalElementText>BRENTIQUA</MarkVerbalElementText>
    <ClassNumber>35</ClassNumber>
    <ApplicantName>Brentiqua Ventures Ltd</ApplicantName>
    <FilingDate>2026-03-20</FilingDate>
    <PublicationDate>2026-05-01</PublicationDate>
  </TransactionData>
</Transaction>
`;
