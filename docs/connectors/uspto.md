# USPTO connector

Deep connector for the US trademark register (`packages/register-connectors/src/uspto/`).

USPTO exposes two functionally distinct data sources this connector uses
independently (see `uspto.tsdr-client.ts`):

- **TSDR lookup** (`fetchTrademarkByNumber`) — requires only `USPTO_API_KEY`
  (+ optional `USPTO_API_BASE_URL`). Sent as the `USPTO-API-KEY` header
  against TSDR's case-status endpoint.
- **Official Gazette publications feed** (`fetchPublications`) — USPTO does
  not expose the weekly Gazette as a simple incremental JSON API, so this
  requires a separately-configured `USPTO_GAZETTE_FEED_URL` pointing at an
  operator-managed JSON proxy in front of the real bulk XML/PDF feed. A
  connector with only `USPTO_API_KEY` set reports `healthCheck()` → `ok`
  (lookup works) but `fetchPublications` still throws
  `ConnectorConfigurationError` until the Gazette feed is also configured.
- **Fixtures:** `USPTO_USE_FIXTURES=true` serves fictitious LUMENARY-style
  fixture data (case status + Gazette publications) with an incremental
  checkpoint.
- **Opposition:** 30 calendar days from publication date (Lanham Act
  §13 / 15 U.S.C. § 1063). Extension-of-time requests (up to 90 further
  days) are not modeled.
- **Classes:** Nice in modern filings; catalog default `nice_45`.
- Without `USPTO_API_KEY` (and fixtures off): `healthCheck()` →
  `configuration_required`; every fetch method throws
  `ConnectorConfigurationError` — never fake live data.

See also [`connector-contract.md`](./connector-contract.md).
