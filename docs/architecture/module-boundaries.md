# Module Boundaries

This document defines which packages are allowed to depend on which other
packages. The rule of thumb: **dependencies point downward only**. A package
listed higher in this document may depend on packages listed lower, never the
reverse, and never sideways within the same layer unless explicitly listed.

## Layers (top = highest-level, bottom = foundational)

### Layer 5 — Applications

- `apps/web`
- `apps/api`
- `apps/worker`

May depend on any package below. Apps must not import from each other's
`src` directories directly — cross-app communication happens over HTTP or
through the shared database layer.

### Layer 4 — Orchestration & delivery packages

- `packages/ai`
- `packages/exports`
- `packages/notifications`
- `packages/database`

May depend on Layer 3, Layer 2, Layer 1, and Layer 0. `packages/ai` must not
be a hard dependency of `packages/scoring` — see the inversion rule below.

### Layer 3 — Domain algorithms

- `packages/scoring`
- `packages/opposition-rules`

May depend on Layer 2, Layer 1, and Layer 0. `packages/scoring` may depend on
`packages/ai` **only through an injected interface**, never by importing a
concrete provider — see [`docs/scoring/ai-layer.md`](../scoring/ai-layer.md).

### Layer 2 — Data acquisition & linguistics

- `packages/register-connectors`
- `packages/normalization`
- `packages/phonetics`

May depend on Layer 1 and Layer 0. Connectors must not depend on
`packages/scoring` — scoring consumes connector output, not the reverse.

### Layer 1 — Core domain

- `packages/domain`

May depend only on Layer 0. This package defines the vocabulary of the whole
system (types, statuses, policies) and must remain free of I/O, HTTP
clients, and third-party SDKs so it can be safely imported everywhere,
including client-side bundles (`apps/web`).

### Layer 0 — Foundations

- `packages/shared`
- `packages/validation`
- `packages/logging`
- `packages/config`
- `packages/ui`
- `packages/testing`

These packages depend on nothing else in the monorepo (aside from
`packages/testing`, which may depend on `packages/domain` purely for fixture
typing, and `packages/ui`, which may depend on `packages/domain` for
component prop types).

## Dependency inversion for the AI layer

`packages/scoring` must be able to run deterministically with
`AI_PROVIDER=none`. To keep this true without a hard dependency:

1. `packages/scoring` defines an `AiEnrichmentPort` interface (consumer-owned
   interface).
2. `packages/ai` implements that interface.
3. `apps/worker` wires the concrete implementation into the scoring pipeline
   at startup.

This means `packages/scoring` never imports `@merkwacht/ai` in its
`package.json` dependencies — only `@merkwacht/domain` for shared types.

## Enforcement

- Boundaries are enforced by convention and code review today. As the
  codebase grows, introduce `eslint-plugin-import`'s
  `no-restricted-imports`/path-based zone rules, or a dedicated dependency
  boundary linter (e.g. `dependency-cruiser`), configured from this document.
- CI should fail if a package's `package.json` lists a dependency that
  violates the layering above.

## Rationale for register-connector isolation

Register connectors talk to unstable, rate-limited, and sometimes
undocumented government/EU APIs. Isolating them in
`packages/register-connectors` behind a single `TrademarkRegisterConnector`
contract (see
[`docs/connectors/connector-contract.md`](../connectors/connector-contract.md))
means:

- A connector outage never crashes scoring or the web app — it only degrades
  the affected register's health status.
- Adding EUIPO or WIPO later only requires a new implementation of the
  contract plus its opposition rule set, with zero changes to
  `packages/scoring`, `packages/domain`, or the apps.
