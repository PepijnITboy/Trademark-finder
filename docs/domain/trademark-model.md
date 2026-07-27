# Trademark Domain Model

This document explains the three central entities in Merkwacht and how they
relate: `WatchedTrademark`, `CandidateApplication`, and `TrademarkMatch`. All
three are defined in `@merkwacht/domain`.

## Why three separate entities?

It is tempting to model "a trademark" as a single table, but Merkwacht
tracks two fundamentally different kinds of trademark data plus the
relationship between them:

1. **Data we monitor on behalf of a customer** — their own registered mark.
2. **Data we ingest from a register** — every newly published application,
   regardless of whether it conflicts with anything.
3. **The computed relationship** between (1) and (2), which is the actual
   product output shown to the customer.

Conflating these would make it impossible to, for example, re-score all
matches after a scoring algorithm change without re-fetching register data,
or to store register data once and reuse it across every customer who might
be interested in it.

## `WatchedTrademark`

Represents a mark a customer (organization) has asked Merkwacht to monitor.

```
WatchedTrademark
├─ id
├─ organizationId
├─ label                      human-friendly name shown in the UI
├─ status                     WatchedTrademarkStatus (see statuses.ts)
├─ eligibility                WatchEligibilityDecision (see watch-eligibility/)
├─ snapshot: RegisteredTrademarkSnapshot
└─ createdAt / updatedAt
```

`RegisteredTrademarkSnapshot` is the last-known state of the *actual*
register entry backing this watch (registration number, mark text, Nice
classes, applicant, dates, register-reported status). It is refreshed
periodically by the worker so that, e.g., an expired registration
automatically flips the watch's eligibility.

A `WatchedTrademark` only produces matches while its
`WatchEligibilityDecision.eligible` is `true`. See
[`watch-eligibility/boip-v1.policy.ts`](../../packages/domain/src/watch-eligibility/boip-v1.policy.ts):
for BOIP v1, only **word marks** with a register status of **registered /
active** are eligible. Figurative-only marks and pending/opposed/expired
registrations are explicitly excluded until a later policy version adds
support for image-based similarity.

## `CandidateApplication`

Represents a single application as published by a register, independent of
any customer. One row per (register, application number).

```
CandidateApplication
├─ id
├─ registryCode                e.g. "BOIP"
├─ applicationNumber
├─ markText
├─ markType                    'word' | 'figurative' | 'combined' | 'other'
├─ niceClasses[]
├─ applicantName
├─ filingDate
├─ publicationDate
├─ proceduralStatus            register-reported lifecycle status
├─ oppositionDeadline?         OppositionDeadline, once calculable
├─ rawPayloadRef?              pointer to the raw connector payload for audit
└─ fetchedAt
```

`CandidateApplication` rows are register-wide and shared across all
organizations — Merkwacht fetches each publication once and matches it
against every relevant `WatchedTrademark`, rather than fetching per
customer.

## `TrademarkMatch`

The computed, customer-facing relationship between one `WatchedTrademark`
and one `CandidateApplication`.

```
TrademarkMatch
├─ id
├─ watchedTrademarkId
├─ candidateApplicationId
├─ status                      MatchStatus (see statuses.ts)
├─ scores: TrademarkMatchScores
├─ totalScore                  weighted sum, 0-100
├─ oppositionDeadline?         copied/denormalized from the candidate for fast queries
├─ reviewedBy? / reviewedAt?
├─ createdAt / updatedAt
```

`TrademarkMatchScores` is the explainable breakdown described in
[`docs/scoring/overview.md`](../scoring/overview.md) and
[`docs/scoring/weights.md`](../scoring/weights.md) — never just a single
number.

## Relationship diagram

```
organization 1───* WatchedTrademark 1───* TrademarkMatch *───1 CandidateApplication
                         │                                          │
                         └── snapshot: RegisteredTrademarkSnapshot   └── oppositionDeadline
```

- One `WatchedTrademark` can have many `TrademarkMatch` rows over time (a new
  one is created whenever a new relevant `CandidateApplication` appears).
- One `CandidateApplication` can match many different customers'
  `WatchedTrademark`s (e.g. a generic word mark applied for by a third party
  may be relevant to several customers who all watch similar marks).
- A `TrademarkMatch` is unique per `(watchedTrademarkId, candidateApplicationId)`
  pair — re-running the matching job must be idempotent (upsert, not insert).

## Lifecycle summary

1. Customer creates a `WatchedTrademark` → worker resolves and stores its
   `RegisteredTrademarkSnapshot` and initial `WatchEligibilityDecision`.
2. Worker's daily fetch job creates/updates `CandidateApplication` rows from
   connectors.
3. Matching job pairs eligible `WatchedTrademark`s against newly seen (or
   updated) `CandidateApplication`s using cheap pre-filters (shared Nice
   class, normalized-name prefix/edit-distance bucket) before running full
   scoring.
4. Scoring job computes `TrademarkMatchScores` and persists/updates the
   `TrademarkMatch` row, moving `status` from `new` onward as a human (or
   the opposition workflow) interacts with it — see
   [`docs/domain/opposition-workflow.md`](./opposition-workflow.md).
5. Notification job informs the customer of new or urgent (deadline-approaching)
   matches.
