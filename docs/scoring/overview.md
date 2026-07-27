# Scoring Overview

The scoring pipeline turns a `(WatchedTrademark, CandidateApplication)` pair
into an explainable `TrademarkMatchScores` object and a single
`totalScore` (0–100). This document describes the pipeline stages; see
[`weights.md`](./weights.md) for the exact weight profile,
[`normalization.md`](./normalization.md) and [`phonetics.md`](./phonetics.md)
for the linguistic pre-processing, and [`ai-layer.md`](./ai-layer.md) for the
optional AI enrichment stage.

## Design principles

1. **Deterministic core, optional enrichment.** The rule-based components
   (textual, phonetic, class overlap, etc.) always run and are sufficient to
   produce a usable score. The AI layer only ever *adjusts* the score within
   a small, capped range — it never replaces the rule-based components.
2. **Explainability over accuracy shortcuts.** Every score component is
   stored, not just the total. Customers and reviewers can see exactly why a
   0–100 number was assigned.
3. **Cheap pre-filtering before expensive scoring.** Full scoring is only run
   on pairs that pass inexpensive pre-filters (shared/overlapping Nice
   class, or normalized name within a coarse edit-distance/phonetic bucket)
   to keep the daily job's compute bounded as the number of watched
   trademarks and candidate applications grows.

## Pipeline stages

```
CandidateApplication ─┐
                       ├─▶ normalizeMarkName() ──▶ NormalizedMarkRepresentations
WatchedTrademark ──────┘

NormalizedMarkRepresentations ──▶ generatePhoneticRepresentations() ──▶ PhoneticRepresentation

(pre-filter: shared Nice class OR phonetic/edit-distance bucket match)
        │
        ▼ pairs that survive
scoreMatch(watched, candidate, normalized, phonetic) ──▶ TrademarkMatchScores (rule-based)
        │
        ▼ if AI_PROVIDER != "none" and budget available
applyAiAdjustment(scores, context) ──▶ TrademarkMatchScores (final, with aiPlausibilityAdjustment)
        │
        ▼
totalScore = Σ (component × weight)
```

## `scoreMatch` pipeline interface

`packages/scoring/src/scoring-pipeline.ts` defines the pipeline as a small
set of composable interfaces so each stage is independently testable:

```ts
interface ScoringContext {
  watched: WatchedTrademark;
  candidate: CandidateApplication;
  watchedNormalized: NormalizedMarkRepresentations;
  candidateNormalized: NormalizedMarkRepresentations;
  watchedPhonetic: PhoneticRepresentation;
  candidatePhonetic: PhoneticRepresentation;
}

interface ScoreComponentCalculator {
  readonly component: keyof TrademarkMatchScores;
  calculate(context: ScoringContext): number; // 0-1, pre-weight
}

interface AiEnrichmentPort {
  adjust(
    context: ScoringContext,
    ruleBasedScores: TrademarkMatchScores,
  ): Promise<{ adjustment: number; rationale: string } | null>;
}

interface ScoreMatchResult {
  scores: TrademarkMatchScores;
  totalScore: number;
  weightProfile: ScoringWeightProfile;
}

function scoreMatch(
  context: ScoringContext,
  options: { weightProfile?: ScoringWeightProfile; ai?: AiEnrichmentPort },
): Promise<ScoreMatchResult>;
```

Each `ScoreComponentCalculator` returns a normalized `0..1` value; the
pipeline multiplies by the component's weight (see
[`weights.md`](./weights.md)) and sums to produce `totalScore` out of 100.

## Score components

| Component | What it measures |
| --- | --- |
| `textualSimilarity` | Literal/orthographic closeness of normalized mark text (edit distance, token overlap). |
| `phoneticSimilarity` | How similar the marks sound when spoken, per [`phonetics.md`](./phonetics.md). |
| `visualSimilarity` | Structural/visual closeness (shared letter patterns, length, common prefixes/suffixes) — a proxy in v1 pending true image-based comparison for figurative marks. |
| `semanticSimilarity` | Conceptual/meaning closeness (e.g. synonyms, translations) — rule-based heuristics in v1, candidate for AI enrichment. |
| `niceClassOverlap` | Degree of overlap between the watched mark's and candidate's Nice classification classes. |
| `goodsServicesOverlap` | Finer-grained overlap of the actual goods/services descriptions within shared classes. |
| `geographicOverlap` | Overlap of registered territory/market (meaningful once multiple registers are supported; BOIP-only v1 treats same-register matches as full overlap). |
| `aiPlausibilityAdjustment` | Bounded adjustment from the optional AI layer, reflecting holistic plausibility a rule-based pipeline might miss. |

## Pre-filtering

Running full scoring against every possible pair would be O(watched ×
candidates) per day, which does not scale. The matching job in `apps/worker`
applies two cheap filters before calling `scoreMatch`:

1. **Nice class overlap filter:** skip pairs with zero overlapping Nice
   classes (configurable to "near" classes later, e.g. coordinated classes).
2. **Coarse phonetic/edit-distance bucket filter:** group normalized mark
   names into buckets (e.g. by phonetic code prefix) and only score pairs
   whose buckets are identical or adjacent.

Pairs that fail pre-filtering are never scored and never produce a
`TrademarkMatch` row — this keeps the matches customers see meaningfully
above-noise, and keeps daily compute bounded.

## Output persistence

`TrademarkMatchScores` and `totalScore` are persisted verbatim on the
`trademark_match` row (see [`docs/database/schema.md`](../database/schema.md))
so the UI can render a full breakdown without re-computing anything, and so
historical scores remain stable even if the weight profile changes later
(a weight profile version is stored alongside the scores for auditability).
