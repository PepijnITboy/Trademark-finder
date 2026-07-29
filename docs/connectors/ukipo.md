# UKIPO connector

UK Intellectual Property Office — wired through the generic HTTP factory
(`createConfiguredHttpConnector`), not a deep connector. See
[`_template.md`](./_template.md) for what that means in general.

- **Env:** `UKIPO_API_BASE_URL`, `UKIPO_API_KEY`, `UKIPO_USE_FIXTURES`.
- **Opposition:** defaults to 2 months from publication date (the generic
  factory's default) — **not yet confirmed** against the UK Trade Marks
  Act 1994's actual opposition window and should be revisited before this
  register goes live for real customers.
- **Classes:** `nice_45`.
- Without credentials (and fixtures off): `healthCheck()` →
  `configuration_required`; every fetch method throws
  `ConnectorConfigurationError`.

See [`world-catalog.md`](./world-catalog.md) for where UKIPO sits in the
overall register catalog and [`connector-contract.md`](./connector-contract.md)
for the shared contract every connector implements.
