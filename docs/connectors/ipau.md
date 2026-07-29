# IP Australia connector

IP Australia — wired through the generic HTTP factory
(`createConfiguredHttpConnector`), not a deep connector. See
[`_template.md`](./_template.md) for what that means in general.

- **Env:** `IPAU_API_BASE_URL`, `IPAU_API_KEY`, `IPAU_USE_FIXTURES`.
- **Real-world note:** IP Australia publishes an official Trade Marks
  Search API/bulk data offering; the exact endpoint shapes this generic
  connector assumes (`/v1/publications`, `/v1/trademarks/:id`) have not
  been validated against it - confirm before enabling for real customers.
- **Opposition:** defaults to 2 months from publication date (the generic
  factory's default) — Australia's Trade Marks Act 1995 opposition period
  is also 2 months from acceptance advertisement, but this has not been
  independently re-verified against the live source for this connector.
- **Classes:** `nice_45`.
- Without credentials (and fixtures off): `healthCheck()` →
  `configuration_required`; every fetch method throws
  `ConnectorConfigurationError`.

See [`world-catalog.md`](./world-catalog.md) and
[`connector-contract.md`](./connector-contract.md).
