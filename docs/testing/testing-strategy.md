# Testing Strategy

Merkwacht uses a layered testing strategy matched to the monorepo's package
boundaries (see
[`docs/architecture/module-boundaries.md`](../architecture/module-boundaries.md)).

## Test layers

| Layer | Tool | Scope | Runs in CI on |
| --- | --- | --- | --- |
| Unit | Vitest | Pure functions/modules within a single package (normalization, phonetics, scoring components, opposition-rules math, domain policies). | Every push/PR |
| Integration | Vitest + local Supabase | Cross-package flows that touch the database (e.g. `apps/worker` job runners against a real local Postgres). | Every push/PR |
| Database | pgTAP (`supabase/tests`) | RLS policies, constraints, triggers, migrations. | Every push/PR |
| End-to-end | Playwright (`apps/web`) | Full user flows through the actual UI against a seeded local stack. | Every push/PR (or nightly, if runtime becomes a constraint) |
| Contract | Vitest, shared fixtures in `packages/testing` | Every `TrademarkRegisterConnector` implementation against the same interface/error-handling assertions. | Every push/PR |

## Unit testing conventions

- Every package under `packages/` ships its own `vitest.config.ts` (or
  relies on package-local Vitest defaults via root `vitest.config.ts`) and colocates
  tests as `*.test.ts` next to the source file they cover.
- Pure algorithmic packages (`normalization`, `phonetics`, `opposition-rules`,
  `scoring`) are held to a high coverage bar since they contain the
  product's core logic and are trivial to unit test (no I/O).
- `phonetics` and `normalization` are tested with **table-driven fixtures**
  of real-world mark name pairs (known sound-alikes, known false-positives to
  avoid) rather than only synthetic examples, so regressions in matching
  quality are caught, not just type errors.
- `packages/domain`'s `watch-eligibility` policies are tested with one test
  per eligibility rule (e.g. "figurative mark → ineligible", "expired
  registration → ineligible", "active word mark → eligible") so the reason
  codes in `WatchEligibilityDecision` are individually verified.

## Connector testing

Per [`docs/connectors/connector-contract.md`](../connectors/connector-contract.md):

1. Every connector has recorded/mocked HTTP fixtures — **no live network
   calls in CI**, ever, to avoid flakiness and unbounded API usage against
   real registers.
2. Every connector has an explicit test asserting `healthCheck()` returns
   `configuration_required` (not a thrown exception, not synthetic data)
   when required env vars are unset.
3. A shared contract test suite in `packages/testing`
   (`registerConnectorContractTests(connectorFactory)`) is run against every
   connector implementation to assert the interface shape and
   error-mapping invariants are upheld consistently.

## Scoring quality testing

Beyond unit tests of individual score components, `packages/scoring`
maintains a **golden fixture set**: pairs of real (anonymized/synthetic but
realistic) mark names with an expected `totalScore` range and expected
dominant component(s). This catches regressions where a change to one
component's algorithm silently shifts the overall ranking of matches in an
undesirable direction. The AI layer is tested with a mocked
`AiEnrichmentPort` in these fixtures — real AI provider calls are never made
in CI (see [`ai-layer.md`](../scoring/ai-layer.md)).

## Integration testing

`apps/worker`'s job runners are tested against a local Supabase instance
(spun up via the Supabase CLI in CI) to verify:

- Idempotency of upserts across repeated job runs (see
  [`docs/operations/daily-jobs.md`](../operations/daily-jobs.md#idempotency)).
- Correct partial-failure behavior (e.g. one connector failing doesn't block
  others).
- End-to-end flow from a fixture connector's `CandidateApplication`s through
  to persisted `trademark_match` rows with correct scores.

## Database testing

`supabase/tests` contains pgTAP tests asserting:

- RLS policies correctly allow/deny access for each role (customer member,
  platform operator, unauthenticated) per table.
- Uniqueness/foreign-key constraints from
  [`docs/database/schema.md`](../database/schema.md) are enforced.
- Migrations apply cleanly from an empty database (run as part of
  `pnpm db:setup` in CI).

## End-to-end testing

Playwright tests in `apps/web` cover the primary customer journeys (create a
watched trademark, view matches, review/dismiss a match) and the primary
operator journeys on `/platform` (view connector health, re-trigger a job).
E2E tests run against a fully seeded local stack with `DEV_MODE=true` and
fixture-backed connectors/AI, never against live external services.

## Coverage expectations

- `packages/domain`, `packages/normalization`, `packages/phonetics`,
  `packages/scoring`, `packages/opposition-rules`: high line/branch coverage
  expected given they are pure and cheap to test exhaustively.
- Connector packages: coverage focused on mapping/error-handling logic
  rather than raw HTTP plumbing.
- `apps/web` UI components: covered primarily by E2E flows plus targeted
  component tests for complex interactive elements (score breakdown display,
  deadline countdown).

## CI pipeline order

```
pnpm install → pnpm lint → pnpm typecheck → pnpm test:unit
  → (start local Supabase) → pnpm db:setup → pnpm test:integration
  → supabase test db (pgTAP) → pnpm test:e2e → pnpm build
```

Failing any stage blocks merge. Unit tests and lint/typecheck run first
since they're fastest and catch the majority of issues cheaply.
