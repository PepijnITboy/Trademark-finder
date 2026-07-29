# EUIPO connector

Deep connector for the EU trademark register (`packages/register-connectors/src/euipo/`).

- **Primary auth:** OAuth2 client credentials — `EUIPO_CLIENT_ID`, `EUIPO_CLIENT_SECRET`
  (+ optional `EUIPO_API_BASE_URL`, `EUIPO_TOKEN_URL`). The client
  (`euipo.oauth-client.ts`) acquires and caches an access token, refreshing
  it ~30s before its reported expiry.
- **Open-data fallback:** if only `EUIPO_OPEN_DATA_BASE_URL` is set (no
  client secret), the connector serves `fetchPublications` from EUIPO's
  unauthenticated open-data bulk extracts instead. `fetchTrademarkByNumber`
  still requires full OAuth credentials — the open-data extracts aren't
  structured for random-access single-mark lookup.
- **Fixtures:** `EUIPO_USE_FIXTURES=true` serves fictitious LUMENTIA-style
  fixture data with an incremental (numeric-index) checkpoint.
- **Opposition:** 3 months from publication date (EUTMR Article 46).
- **Classes:** `nice_45`.
- Without either OAuth credentials or the open-data URL (and fixtures
  off): `healthCheck()` → `configuration_required`; every fetch method
  throws `ConnectorConfigurationError` — never fake live data.
- Exact OAuth/API paths in `euipo.oauth-client.ts`/`euipo.schemas.ts` are
  best-effort placeholders pending confirmation against EUIPO's developer
  portal documentation.

See also [`connector-contract.md`](./connector-contract.md).
