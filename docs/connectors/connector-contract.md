# Register Connector Contract

All trademark register integrations implement a single TypeScript interface,
`TrademarkRegisterConnector`, defined in
`packages/register-connectors/src/core/register-connector.ts`. This document
explains the contract and the invariants every implementation must uphold.

## Why a single contract?

Merkwacht intends to support multiple registers (BOIP today; EUIPO, WIPO
Madrid, and national offices are plausible future additions). Every register
has different APIs, authentication schemes, pagination models, and
opposition rules. The contract exists so that:

- `packages/scoring`, `apps/worker`, and `apps/api` never need to know which
  register they're talking to.
- A connector outage or missing configuration degrades gracefully instead of
  crashing the pipeline or fabricating data.
- Adding a new register is additive: implement the interface, register it,
  done.

## The interface (shape)

```ts
interface TrademarkRegisterConnector {
  readonly registryCode: RegisterCode;
  readonly capabilities: RegisterConnectorCapabilities;

  healthCheck(): Promise<ConnectorHealthStatus>;

  fetchPublications(
    params: FetchPublicationsParams,
  ): Promise<FetchPublicationsResult>;

  fetchTrademarkByNumber(
    registrationNumber: string,
  ): Promise<RegisteredTrademarkSnapshot | null>;

  getOppositionRuleSet(): OppositionRuleSet;
}
```

See `packages/register-connectors/src/core/register-types.ts` for the exact
parameter/result shapes and `register-capabilities.ts` for the capability
flags a connector can declare (e.g. whether it supports incremental
checkpointed fetching, figurative marks, or opposition-status callbacks).

## Health states — no fake data, ever

`healthCheck()` returns a `ConnectorHealthStatus` with one of:

- `ok` — connector is configured and the last probe succeeded.
- `configuration_required` — required credentials/config (e.g. API key) are
  missing. **The connector must not attempt live calls in this state and
  must never return synthetic/placeholder trademark data.**
- `degraded` — reachable but with partial/limited functionality (e.g. rate
  limited, one of several endpoints failing).
- `unavailable` — the upstream register cannot be reached at all.

`apps/worker` must skip fetch jobs for a connector whose health is anything
other than `ok` or `degraded`, and must record this in the `ProcessingJob`
outcome so operators see it on `/platform` rather than silently getting zero
new matches. This is a hard product requirement: **Merkwacht never invents
trademark data to fill a gap left by a misconfigured or unreachable
connector.**

## Errors

Connectors throw typed errors from `register-errors.ts`:

- `ConnectorConfigurationError` — missing/invalid config; maps to
  `configuration_required` health.
- `ConnectorRateLimitError` — includes a `retryAfterMs` hint.
- `ConnectorUpstreamError` — the register returned an unexpected error/5xx.
- `ConnectorParseError` — the register returned data the connector could not
  map to `CandidateApplication`/`RegisteredTrademarkSnapshot`. This should be
  logged loudly (it usually means the upstream changed its response shape)
  and must not silently drop or guess at fields.

Callers (the worker's job runners) catch these, record them on the
`ProcessingJob`, and apply the register's own retry/backoff policy — never
swallow-and-continue with partial, unvalidated data.

## Checkpointing

Most registers publish more applications per day than is practical to
re-fetch from scratch. Connectors that support incremental fetching persist
a `SourceCheckpoint` (see `source-checkpoint.ts`) — typically a cursor,
page token, or last-seen publication date/sequence number — so the next run
resumes where the last one left off. Checkpoints are per-connector and
opaque to the rest of the system; only the connector that wrote a checkpoint
knows how to interpret it.

## Opposition rules

Each connector exposes `getOppositionRuleSet()`, returning the
`OppositionRuleSet` that applies to applications from that register (see
[`docs/domain/opposition-workflow.md`](../domain/opposition-workflow.md)).
This is intentionally a *method* rather than a static constant so that a
connector could, in principle, vary the rule set by application type in the
future without changing the contract.

## Testing connectors

Every connector implementation must have:

1. A unit test suite against recorded/mocked HTTP fixtures (no live network
   calls in CI).
2. A `healthCheck()` test proving `configuration_required` is returned (not
   an exception, not fabricated data) when required env vars are absent.
3. A contract test (shared across all connectors, living in
   `packages/testing`) asserting the interface shape and error-handling
   invariants above.

See [`docs/testing/testing-strategy.md`](../testing/testing-strategy.md).
