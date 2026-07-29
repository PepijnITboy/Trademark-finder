# Architecture Overview

Merkwacht is a monorepo (pnpm workspaces) split into three deployable
applications and a set of pure/independent packages. This document describes
the runtime architecture, the daily data flow, and how the pieces fit
together. For package-level dependency rules, see
[`module-boundaries.md`](./module-boundaries.md).

## Goals of the architecture

1. **Register connectors are replaceable.** BOIP is the first supported
   register, but EUIPO, WIPO/Madrid, or national offices should be addable
   without touching domain logic or scoring.
2. **Scoring is explainable.** Every `TrademarkMatch` carries a breakdown of
   the score components (`TrademarkMatchScores`), never just a single opaque
   number. Customers and internal reviewers must be able to see *why* a match
   was flagged.
3. **The AI layer is optional and budget-capped.** The system must produce
   useful, correct results with `AI_PROVIDER=none`. AI is an enrichment layer
   on top of deterministic rules, never a replacement for them.
4. **No fabricated data.** If a connector cannot authenticate or a register is
   unreachable, the system must surface a `configuration_required` /
   `unavailable` health state — it must never invent placeholder trademarks,
   applications, or scores.

## Deployables

```
apps/web      Vue application. Hosts two logically separate areas:
              - /app       customer-facing dashboard (watched trademarks, matches)
              - /platform  internal operator console — see `docs/product/platform-ia.md`
                           (Systeem catalogus vs Operatie runtime vs Klantprofiel)
apps/api      HTTP/RPC layer in front of Supabase Postgres. Owns authorization,
              request validation, and orchestration for synchronous operations
              (CRUD on watched trademarks, exports, subscription management).
apps/worker   Scheduled/queued background processing. Owns the daily pipeline:
              fetch publications -> normalize -> match -> score -> notify.
```

`apps/web` and `apps/api` never talk to register connectors or the AI
provider directly — that responsibility belongs to `apps/worker` and the
packages it orchestrates. This keeps request/response latency in the web tier
predictable and keeps API keys/secrets out of the request path.

## Daily data flow

```
                     ┌────────────────────────────────────────────┐
                     │                apps/worker                  │
                     │                                              │
  register-connectors│  1. fetchPublications() per active register │
  (e.g. BOIP)  ──────┼─▶  -> CandidateApplication[]                 │
                     │                                              │
  normalization      │  2. normalizeMarkName() on watched marks     │
                     │     and candidate marks                      │
                     │                                              │
  phonetics          │  3. generatePhoneticRepresentations()        │
                     │                                              │
  scoring            │  4. scoreMatch() per (watched, candidate)    │
                     │     pair that survives cheap pre-filters     │
                     │     -> TrademarkMatchScores                  │
                     │                                              │
  opposition-rules   │  5. calculateOppositionDeadline() for every  │
                     │     candidate application                    │
                     │                                              │
  database           │  6. persist trademark_match rows             │
                     │                                              │
  notifications      │  7. dispatch NotificationPayload for new/    │
                     │     urgent matches                            │
                     └────────────────────────────────────────────┘
```

Each numbered step is implemented as a discrete `ProcessingJob` (see
`packages/domain/src/jobs/types.ts`) so that failures are isolated,
retryable, and auditable per register/organization rather than as one giant
transaction. See [`docs/operations/daily-jobs.md`](../operations/daily-jobs.md)
for the full job schedule and retry policy.

## Core domain concepts

| Concept | Package | Description |
| --- | --- | --- |
| `WatchedTrademark` | `@merkwacht/domain` | A trademark a customer has asked Merkwacht to monitor, anchored to a `RegisteredTrademarkSnapshot`. |
| `CandidateApplication` | `@merkwacht/domain` | A newly published register application fetched by a connector. |
| `TrademarkMatch` | `@merkwacht/domain` | A scored relationship between a `WatchedTrademark` and a `CandidateApplication`. |
| `OppositionDeadline` | `@merkwacht/domain` | The calculated last date to file opposition against a `CandidateApplication`. |
| `ProcessingJob` | `@merkwacht/domain` | A unit of worker execution with status, attempts, and audit metadata. |

See [`docs/domain/trademark-model.md`](../domain/trademark-model.md) for the
full breakdown of these types and how they relate.

## Package layering

```
                     apps/web   apps/api   apps/worker
                         \          |          /
                          \         |         /
                     packages/database, ai, notifications, exports
                                    |
                     packages/scoring, opposition-rules
                                    |
                     packages/normalization, phonetics, register-connectors
                                    |
                             packages/domain
                                    |
                    packages/shared, validation, logging, config
```

`packages/domain` sits at the bottom of the application-logic stack: it has
no runtime dependencies on Supabase, HTTP, or any connector SDK. Everything
above it depends downward, never sideways-and-back-up. This is enforced in
[`module-boundaries.md`](./module-boundaries.md).

## Technology choices

- **Language:** TypeScript everywhere (strict mode, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`).
- **Database:** Supabase (Postgres + Auth + Row Level Security). See
  [`docs/database/schema.md`](../database/schema.md).
- **Package manager:** pnpm workspaces, no Nx/Turborepo dependency required
  for the current scale of the monorepo.
- **Testing:** Vitest for unit/integration, Playwright for end-to-end, pgTAP
  for database-level tests. See
  [`docs/testing/testing-strategy.md`](../testing/testing-strategy.md).
