# Generic-factory national/regional connectors

DPMA, UKIPO, CIPO, IP Australia, CNIPA, and the ~30 other catalog offices
without a deep connector all share the same `createConfiguredHttpConnector`
scaffold. See [`_template.md`](./_template.md) for the full explanation of
what that means (env shape, health/fixture/live behavior, opposition rule
defaults) and how to promote a register to a deep connector later.

Per-register docs with register-specific caveats:

- [`ukipo.md`](./ukipo.md)
- [`dpma.md`](./dpma.md)
- [`cipo.md`](./cipo.md)
- [`ipau.md`](./ipau.md)
- [`cnipa.md`](./cnipa.md)

Every other catalog code (INPI, OEPM, UIBM, IPI_CH, PRH, PRV, DKPTO, NIPO,
IPO_IE, INPI_PT, OEPA, UPRP, UPV_CZ, HIPO, OBI, OSIM, BPO, SIPO_HR, IPO_SK,
SIPO_SI, VLS, LRPV, EPA, DRCOR, IPOMT, INPI_BR, CIPC, IMPI, JPO, KIPO,
IPO_IN — see [`world-catalog.md`](./world-catalog.md) for the full list)
follows the exact same pattern without its own dedicated doc yet; copy
[`_template.md`](./_template.md) if/when one needs register-specific notes.

See also [`connector-contract.md`](./connector-contract.md) for the shared
contract test that runs across every connector, deep or generic.
