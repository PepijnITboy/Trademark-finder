# DPMA connector

Deutsches Patent- und Markenamt (German Patent and Trade Mark Office) —
wired through the generic HTTP factory (`createConfiguredHttpConnector`),
not a deep connector. See [`_template.md`](./_template.md) for what that
means in general.

- **Env:** `DPMA_API_BASE_URL`, `DPMA_API_KEY`, `DPMA_USE_FIXTURES`.
- **Real-world note:** the register catalog (`packages/domain/src/register-catalog.ts`)
  marks DPMA's `authMode` as `open_data` — DPMA's actual public data
  offering (DPMAregister) may not require an API key the way this
  generic connector's env shape assumes. Confirm the real integration
  shape (open-data bulk export vs. keyed API) before enabling this
  register for real customers; the generic factory is an interim scaffold.
- **Opposition:** defaults to 2 months from publication date (the generic
  factory's default) — **not yet confirmed** against the German
  Markengesetz's actual opposition window.
- **Classes:** `nice_45`.
- Without credentials (and fixtures off): `healthCheck()` →
  `configuration_required`; every fetch method throws
  `ConnectorConfigurationError`.

See [`world-catalog.md`](./world-catalog.md) and
[`connector-contract.md`](./connector-contract.md).
