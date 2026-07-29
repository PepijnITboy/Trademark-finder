# CIPO connector

Canadian Intellectual Property Office — wired through the generic HTTP
factory (`createConfiguredHttpConnector`), not a deep connector. See
[`_template.md`](./_template.md) for what that means in general.

- **Env:** `CIPO_API_BASE_URL`, `CIPO_API_KEY`, `CIPO_USE_FIXTURES`.
- **Opposition:** defaults to 2 months from publication date (the generic
  factory's default) — **not yet confirmed** against the Canadian
  Trademarks Act's actual opposition window (Canada's statutory period is
  2 months from advertisement, extendable — the base period happens to
  match the generic default here, but this has not been independently
  verified against the live CIPO source).
- **Classes:** `nice_45`.
- Without credentials (and fixtures off): `healthCheck()` →
  `configuration_required`; every fetch method throws
  `ConnectorConfigurationError`.

See [`world-catalog.md`](./world-catalog.md) and
[`connector-contract.md`](./connector-contract.md).
