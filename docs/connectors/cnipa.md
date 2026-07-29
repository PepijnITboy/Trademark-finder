# CNIPA connector

China National Intellectual Property Administration — wired through the
generic HTTP factory (`createConfiguredHttpConnector`), not a deep
connector. See [`_template.md`](./_template.md) for what that means in
general.

- **Env:** `CNIPA_API_BASE_URL`, `CNIPA_API_KEY`, `CNIPA_USE_FIXTURES`.
- **Real-world note:** CNIPA does not offer a straightforward public REST
  API comparable to EUIPO/USPTO; real integration would likely require a
  licensed data vendor or CNIPA's own bulk-data channel. Treat the
  `{CODE}_API_BASE_URL` / `{CODE}_API_KEY` env shape as an interim
  scaffold only — do not assume it maps to a real CNIPA product without
  confirming first.
- **Opposition:** defaults to 2 months from publication date (the generic
  factory's default) — **not yet confirmed** against Chinese Trademark
  Law's actual opposition window (which is 3 months from preliminary
  publication) — this register's `getOppositionRuleSet()` value should be
  corrected to 3 months before this register is trusted for real deadline
  calculations.
- **Classes:** `nice_45`.
- Without credentials (and fixtures off): `healthCheck()` →
  `configuration_required`; every fetch method throws
  `ConnectorConfigurationError`.

See [`world-catalog.md`](./world-catalog.md) and
[`connector-contract.md`](./connector-contract.md).
