# BOIP Connector

BOIP (Benelux-Bureau voor de Intellectuele Eigendom / Benelux Office for
Intellectual Property) is Merkwacht's first and, at launch, only supported
trademark register. This document covers integration specifics that go
beyond the generic
[connector contract](./connector-contract.md).

## Data source: Datolite

BOIP exposes its trademark register data through **Datolite**, BOIP's
official data/API platform. The `packages/register-connectors/src/boip`
implementation is built against Datolite's trademark search and publication
feed endpoints — not a scraped or unofficial source. Access requires:

- A Datolite API key (`BOIP_API_KEY`)
- The Datolite API base URL (`BOIP_API_BASE_URL`) — configurable per
  environment (production vs. any sandbox/acceptance environment BOIP
  provides).

Both are required environment variables. If either is missing, the connector
reports `healthCheck()` → `configuration_required` and performs **no**
network calls. It does not fall back to cached, mocked, or invented data —
see the "no fake data" rule in the
[connector contract](./connector-contract.md#health-states--no-fake-data-ever).
This matters especially for BOIP because it is the only register at launch:
a misconfigured BOIP connector means Merkwacht has *zero* live data, and the
product must make that visible on `/platform` rather than hide it behind
placeholder trademarks.

## Opposition period: 2 months

Under Benelux trademark law (BVIE — Benelux-verdrag inzake de intellectuele
eigendom), third parties have **2 calendar months from the publication date**
of an application to file a notice of opposition with BOIP.
`packages/register-connectors/src/boip/boip.opposition-rules.ts` encodes this
as:

```ts
{ kind: 'months', months: 2, startsFrom: 'publication_date' }
```

This is passed through `@merkwacht/opposition-rules`'
`calculateOppositionDeadline` to produce the `OppositionDeadline` attached to
every BOIP `CandidateApplication`. See
[`docs/domain/opposition-workflow.md`](../domain/opposition-workflow.md) for
how this deadline drives customer notifications.

## What the connector fetches

- **Publications feed:** newly published applications within a date range or
  since the last `SourceCheckpoint`, mapped to `CandidateApplication`.
- **Trademark lookup by registration number:** used to build and refresh the
  `RegisteredTrademarkSnapshot` backing a customer's `WatchedTrademark`.

## Mark types and watch eligibility

BOIP publishes word marks, figurative marks, and combined (word + figurative)
marks. The v1 watch eligibility policy
(`packages/domain/src/watch-eligibility/boip-v1.policy.ts`) only considers
**word marks with an active/registered status** eligible for watching and
matching, because:

- Reliable figurative similarity requires an image-similarity model that is
  out of scope for v1.
- Pending, opposed, refused, or expired registrations do not constitute a
  valid earlier right to defend, or are not yet enforceable.

This restriction is deliberately isolated in a policy object (rather than
scattered `if` statements) so it can be revised — e.g. a `boip-v2.policy.ts`
that adds figurative support — without touching the connector or scoring
pipeline.

## Rate limits and fetch cadence

Datolite enforces rate limits per API key (see BOIP's Datolite developer
documentation for current limits, which are subject to change and must be
confirmed against the live API terms rather than assumed). The connector:

- Respects `Retry-After`/rate-limit headers by throwing
  `ConnectorRateLimitError` with a `retryAfterMs` hint, which the worker's
  job runner uses to back off.
- Uses `SourceCheckpoint`-based incremental fetching (see the
  [connector contract](./connector-contract.md#checkpointing)) so the daily
  job only requests publications since the last successful run, rather than
  re-scanning the full register.

## Configuration summary

| Env var | Required | Purpose |
| --- | --- | --- |
| `BOIP_API_BASE_URL` | Yes | Datolite API base URL for the target environment |
| `BOIP_API_KEY` | Yes | Datolite API key/credential |

Without both, `apps/worker` will show the BOIP connector as
`configuration_required` on `/platform` and skip all BOIP fetch jobs — by
design, not as a bug.
