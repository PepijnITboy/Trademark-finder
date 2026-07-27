# Opposition Workflow

This document describes how Merkwacht tracks the opposition window for a
`CandidateApplication` and how a `TrademarkMatch` moves through its
lifecycle in relation to that window.

## What is an opposition period?

After a trademark office publishes an application, third parties who hold an
earlier, conflicting right typically have a limited window to formally
oppose the registration. The length and starting point of this window is
**register-specific**:

- **BOIP (Benelux):** 2 months from the publication date.
- Other registers (EUIPO, WIPO, national offices) have their own rules,
  which is why the deadline calculation lives behind the
  `OppositionRuleSet` abstraction rather than being hard-coded.

Merkwacht never advises a customer to file an opposition — it only surfaces
the deadline and the underlying conflict signal so the customer (or their
legal counsel) can decide. See
[`docs/product/legal-language.md`](../product/legal-language.md).

## `OppositionRuleSet` and `OppositionDeadline`

`OppositionRuleSet` (defined in `@merkwacht/domain`, implemented per-register
in `packages/register-connectors` and computed generically by
`packages/opposition-rules`) describes how a deadline is derived:

```ts
type OppositionRuleSet =
  | { kind: 'calendar_days'; days: number; startsFrom: 'publication_date' | 'filing_date' }
  | { kind: 'months'; months: number; startsFrom: 'publication_date' | 'filing_date' };
```

`calculateOppositionDeadline` (in `@merkwacht/opposition-rules`) takes the
relevant start date plus an `OppositionRuleSet` and returns an
`OppositionDeadline`:

```ts
interface OppositionDeadline {
  candidateApplicationId: string;
  registryCode: string;
  startDate: string;    // ISO date the window is calculated from
  deadlineDate: string; // ISO date, inclusive last day to oppose
  ruleSet: OppositionRuleSet;
  calculatedAt: string;
}
```

Calendar-day windows add whole days; month-based windows use calendar-month
arithmetic (e.g. 8 May + 2 months = 8 July), clamping to the last valid day
of the target month when the start day doesn't exist there (e.g. 31 Jan + 1
month = 28/29 Feb).

## Procedural status

A `CandidateApplication` also carries a `proceduralStatus`
(`ProceduralStatusResult` in `@merkwacht/domain`) reflecting what the
register itself reports (e.g. `published`, `opposition_period`,
`registered`, `opposed`, `withdrawn`, `refused`). This is distinct from — but
informs — the Merkwacht-side `MatchStatus` on a `TrademarkMatch`.

## Workflow states

```
CandidateApplication.proceduralStatus     TrademarkMatch.status (customer-facing)
────────────────────────────────────      ──────────────────────────────────────
published ───────────────────────────▶    new
                                            │  (customer/operator reviews)
                                            ▼
                                           under_review
                                            │
                        ┌───────────────────┼────────────────────┐
                        ▼                   ▼                    ▼
                  confirmed_conflict     dismissed          opposition_filed
                        │                                        │
                        ▼                                        ▼
          (deadline passes without action)          (customer confirms filing,
                        │                             tracked outside Merkwacht —
                        ▼                             we do not file oppositions)
              opposition_deadline_passed
```

- `new`: a fresh match created by the scoring job; unseen by a human.
- `under_review`: a customer or operator has opened the match.
- `confirmed_conflict`: a human has judged this a real conflict worth acting
  on. Still requires external legal action; Merkwacht does not submit
  oppositions on the customer's behalf.
- `dismissed`: judged not a real conflict (false positive / acceptable
  overlap). Feeds back into scoring quality review, see
  [`docs/testing/testing-strategy.md`](../testing/testing-strategy.md).
- `opposition_filed`: customer has indicated (manually) that they filed an
  opposition through their own counsel/agent. Informational only.
- `opposition_deadline_passed`: the `OppositionDeadline.deadlineDate` has
  passed with no `opposition_filed` status recorded. Terminal state; the
  match is archived from active dashboards but remains in history.

## Reminder cadence

The worker's daily jobs (see
[`docs/operations/daily-jobs.md`](../operations/daily-jobs.md)) check every
active `TrademarkMatch` with an upcoming `oppositionDeadline` and issue
`NotificationPayload`s of type `opposition_deadline_reminder` at fixed
offsets before the deadline (e.g. 30, 14, 7, and 2 days out), plus a final
"deadline passed" notification the day after expiry, after which the match
transitions to `opposition_deadline_passed`.

## Why Merkwacht never files oppositions

Filing an opposition is a legal act with formal requirements, fees, and
strategic considerations that require a licensed trademark
attorney/gemachtigde. Merkwacht's role stops at **signaling** — see
[`docs/product/legal-language.md`](../product/legal-language.md) for the
exact forbidden phrasing around this boundary.
