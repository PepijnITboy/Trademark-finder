# WIPO Madrid connector

Deep connector for the WIPO Madrid System (international registrations),
`packages/register-connectors/src/wipo/`.

- **Primary path:** WIPO's commercial FTP daily-delta feed — `yyyymmdd.zip`
  files, each containing one or more ST.66 XML `TransactionData` records
  (`wipo.st66-parser.ts` extracts the fields Merkwacht needs). Requires
  `WIPO_FTP_HOST`, `WIPO_FTP_USER`, `WIPO_FTP_PASSWORD` (optional
  `WIPO_FTP_REMOTE_DIR`) **and** an injected `WipoFtpClient` implementation
  (`wipo.ftp-client.ts` defines the interface only — no FTP client
  dependency is bundled until a real WIPO data-license agreement is in
  place). Full commercial FTP access is historically negotiated per
  organization (~CHF 30,000/yr order of magnitude per WIPO's public
  pricing pages) — confirm current pricing/terms before procurement.
- **Do not scrape** the Madrid Monitor UI or Global Brand Database —
  automated querying of those is against WIPO's terms of use.
- **Fixtures:** `WIPO_USE_FIXTURES=true` serves a sample ST.66 XML fixture
  with an incremental (numeric-index) checkpoint.
- **Checkpoint:** the live path's `SourceCheckpoint.cursor` is the
  `yyyymmdd` string extracted from the earliest pending delta file's name
  (see `parseWipoDeltaFileDate`), so the next run only considers later
  files.
- **Single-registration lookup:** not served by the daily-delta feed
  (which only carries *changes*, not a random-access index).
  `fetchTrademarkByNumber` throws `ConnectorConfigurationError` in live
  mode until a periodic full base-file import/index is built; fixture mode
  serves a small fixture list instead.
- **Opposition:** WIPO itself doesn't administer oppositions — that's up
  to each designated Contracting Party's office, with deadlines that vary
  by jurisdiction. `getOppositionRuleSet()` returns a documented
  placeholder (3 months from WIPO's own publication date) — see
  `wipo.opposition-rules.ts` for the full caveat.
- **Classes:** `nice_45`.
- Without FTP credentials + client (and fixtures off): `healthCheck()` →
  `configuration_required`; every fetch method throws
  `ConnectorConfigurationError` — never fake live data.

See also [`connector-contract.md`](./connector-contract.md).
