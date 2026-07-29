# Connector doc template / generic-register note

This file is a template for `docs/connectors/<code>.md` and explains what
"wired through the generic HTTP factory" means for the ~35 catalog
registers that don't (yet) have a deep, office-specific connector under
`packages/register-connectors/src/<code>/`.

## What "generic HTTP factory" means

These registers are instantiated in
`packages/register-connectors/src/catalog/create-all-connectors.ts` via
`createConfiguredHttpConnector` (`src/generic/configured-http.connector.ts`)
instead of a hand-written connector folder. They all share:

- **Env shape:** `{CODE}_API_BASE_URL`, `{CODE}_API_KEY`,
  `{CODE}_USE_FIXTURES` (e.g. `UKIPO_API_BASE_URL`), read straight from
  `process.env` — **not** individually declared in
  `packages/config/src/schema.ts` (see the comment on `apiEnvSchema`/
  `workerEnvSchema` there for why).
- **`healthCheck()`:** `configuration_required` when neither an API
  key/base URL nor `{CODE}_USE_FIXTURES=true` is set — this connector
  family never invents live data.
- **Fixture mode** (`{CODE}_USE_FIXTURES=true`): serves deterministic,
  clearly-fictitious fixture publications/trademarks
  (`src/generic/fixture-factory.ts`) with an incremental numeric-index
  checkpoint, so pipelines and UI can be exercised end-to-end before a
  real integration exists.
- **Live mode** (API key/base URL set): a plain JSON GET against a
  configurable publications path (default `/v1/publications`), parsed
  into `CandidateApplicationInput`/`RegisteredTrademarkSnapshot`. This is
  a reasonable *default shape* but has **not** been validated against any
  specific office's real API — see the per-register doc for known caveats
  before enabling a given register for real customers.
- **Opposition rules:** default to 2 months from publication date unless
  overridden per-register in `create-all-connectors.ts`. This is a
  placeholder default, not a researched legal fact per jurisdiction —
  each register's doc should flag whether its real statutory period has
  been confirmed yet.
- **Classes:** default `nice_45` classification scheme unless the catalog
  entry in `packages/domain/src/register-catalog.ts` says otherwise.

## When to promote a register to a deep connector

Follow the `src/boip/` (or `src/euipo/`, `src/uspto/`, `src/wipo/`)
pattern — dedicated `*.client.ts`, `*.schemas.ts`, `*.mapper.ts`,
`*.status-map.ts`, `*.opposition-rules.ts`, `*.fixtures.ts`,
`*.connector.ts` + tests — once:

1. The office's real API/data-feed shape is confirmed, and
2. Its opposition deadline rule is confirmed against the actual statute
   (not just the generic 2-month default), and
3. Credentials/a data-license agreement exist to test against something
   real (or at minimum a realistic fixture derived from real sample data).

## Copy this template

To document a new generic-factory register, copy this file to
`docs/connectors/<code>.md` (lowercase catalog code) and fill in:

- The real env var names (should just be `{CODE}_API_BASE_URL` /
  `{CODE}_API_KEY` / `{CODE}_USE_FIXTURES`).
- Whether the opposition period default (2 months) has been confirmed or
  still needs research.
- Any known mismatch between this generic connector's assumed API shape
  and the office's real data offering.

See [`euipo.md`](./euipo.md), [`uspto.md`](./uspto.md), and
[`wipo.md`](./wipo.md) for examples of deep, office-specific connector
docs (those three + BOIP are not generic-factory registers).
