# Scoring Weight Profile

`TrademarkMatchScores` combines eight components into a single `totalScore`
(0–100) using a fixed, versioned weight profile. This document is the source
of truth for the current default weights — code in
`packages/scoring/src/weight-profile.ts` must match this table exactly.

## Default weight profile (`v1`)

| Component | Weight | Rationale |
| --- | --- | --- |
| `textualSimilarity` | 25 | The single strongest legal signal for likelihood of confusion — literal closeness of the mark text. |
| `phoneticSimilarity` | 22 | Sound-alike marks are a well-established basis for confusion even with different spelling. |
| `niceClassOverlap` | 17 | Marks only conflict within overlapping goods/services classes; this is a near-necessary condition, weighted accordingly. |
| `visualSimilarity` | 13 | Structural/visual closeness matters for word marks (letter patterns, length) and is a proxy for figurative comparison until v2. |
| `goodsServicesOverlap` | 8 | Finer-grained than class overlap — rewards matches where the *actual* goods/services description overlaps, not just the class number. |
| `semanticSimilarity` | 8 | Conceptual/meaning closeness (synonyms, translated equivalents) — a real but secondary confusion factor. |
| `geographicOverlap` | 4 | Low weight at BOIP-only launch (same-register matches always fully overlap); becomes more meaningful once multiple registers are supported. |
| `aiPlausibilityAdjustment` | 3 | Small, capped adjustment from the optional AI layer — see [`ai-layer.md`](./ai-layer.md). Deliberately the smallest weight so AI can nudge but never dominate a score. |
| **Total** | **100** | |

## `ScoringWeightProfile` type

```ts
interface ScoringWeightProfile {
  readonly id: string; // e.g. "v1"
  readonly weights: {
    readonly textualSimilarity: number;
    readonly phoneticSimilarity: number;
    readonly visualSimilarity: number;
    readonly semanticSimilarity: number;
    readonly niceClassOverlap: number;
    readonly goodsServicesOverlap: number;
    readonly geographicOverlap: number;
    readonly aiPlausibilityAdjustment: number;
  };
}
```

The weights in a profile must always sum to `100`; this invariant is
enforced by a unit test in `packages/scoring` that iterates every exported
profile.

## Versioning weight profiles

Weight profiles are identified by an `id` (e.g. `"v1"`) and every
`TrademarkMatch` stores which profile produced its `totalScore`. This means:

- Changing the weights (e.g. after quality review shows `phoneticSimilarity`
  should count for more) requires adding a new profile (`"v2"`) rather than
  mutating `"v1"` in place, so historical scores remain reproducible and
  explainable.
- The worker can re-score existing matches under a new profile as an
  explicit, auditable batch job rather than silently drifting.

## Interpreting `totalScore`

`totalScore` is a weighted percentage (0–100), not a probability. Internal
product guidance for triage bands (subject to revision as real-world data
accumulates):

| `totalScore` range | Suggested triage |
| --- | --- |
| 80–100 | High-confidence conflict signal — surfaced prominently, included in urgent notifications. |
| 50–79 | Moderate — surfaced in the dashboard, included in regular digest notifications. |
| 25–49 | Low — visible on request/filtered views, not pushed via notification. |
| 0–24 | Not surfaced as a match at all (and, combined with pre-filtering, most such pairs never reach scoring). |

These bands are a product/UX convention layered on top of the score, not a
part of the scoring algorithm itself, and must never be presented to
customers as a legal risk probability — see
[`docs/product/legal-language.md`](../product/legal-language.md).
