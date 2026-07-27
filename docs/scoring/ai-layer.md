# AI Layer

The AI layer is an **optional, budget-capped enrichment step** on top of the
deterministic scoring pipeline. It never replaces rule-based scoring and the
system must produce complete, correct `TrademarkMatch` records with
`AI_PROVIDER=none`.

## Why the AI layer is optional by design

1. **Reliability.** Rule-based components (`textualSimilarity`,
   `phoneticSimilarity`, `niceClassOverlap`, etc.) are cheap, fast, and have
   no external dependency or cost. The product must keep working if the AI
   provider is down, misconfigured, or intentionally disabled by a customer
   on cost grounds.
2. **Cost control.** LLM calls have a real, variable cost. Scoring runs at
   volume (every new candidate application against every eligible watched
   trademark that survives pre-filtering), so uncapped AI usage could produce
   unpredictable bills.
3. **Auditability.** A purely rule-based score is fully explainable from
   its inputs. The AI contribution is isolated into a single, small,
   clearly-labeled component (`aiPlausibilityAdjustment`, weight `3`, see
   [`weights.md`](./weights.md)) so it can never silently dominate or
   obscure the rule-based reasoning.

## Configuration

| Env var | Purpose |
| --- | --- |
| `AI_PROVIDER` | `"openai"` to enable AI enrichment, `"none"` to disable it entirely. |
| `OPENAI_API_KEY` | Credential for the configured provider. |
| `AI_MONTHLY_BUDGET_EUR` | Hard monthly spending cap (default `5`). |

## `AiEnrichmentPort` (dependency inversion)

As described in
[`docs/architecture/module-boundaries.md`](../architecture/module-boundaries.md#dependency-inversion-for-the-ai-layer),
`packages/scoring` defines the interface it needs; `packages/ai` implements
it:

```ts
// defined in packages/scoring, implemented in packages/ai
interface AiEnrichmentPort {
  adjust(
    context: ScoringContext,
    ruleBasedScores: TrademarkMatchScores,
  ): Promise<{ adjustment: number; rationale: string } | null>;
}
```

- Returning `null` means "no adjustment" (e.g. budget exhausted, provider
  error, or the AI layer determined no adjustment was warranted) — the
  pipeline proceeds with `aiPlausibilityAdjustment = 0`, never blocking or
  failing the overall scoring job.
- `adjustment` is clamped by the pipeline to `[-1, 1]` before being
  multiplied by the `aiPlausibilityAdjustment` weight, so even a
  misbehaving provider response cannot swing the total score by more than
  the weight allows (±3 points at the `v1` weight profile).
- `rationale` is stored alongside the match for transparency in the UI
  ("AI adjustment: +2 — mark shares an invented-word structure with the
  watched mark despite low textual overlap").

## Budget enforcement

Every AI call is recorded in the `ai_usage_ledger` table (see
[`docs/database/schema.md`](../database/schema.md)) with an estimated cost in
EUR. Before making a call, `packages/ai` sums the current calendar month's
`estimated_cost_eur` and compares it against `AI_MONTHLY_BUDGET_EUR`:

- **Under budget:** proceed with the call.
- **At or over budget:** skip the call, return `null` from `adjust()`, and
  emit a `connector_down`-style operational signal on `/platform` (budget
  exhaustion is treated as an operational event, not a silent no-op) so the
  team can decide whether to raise the cap.

Cost estimation uses the provider's published per-token pricing and the
actual token usage reported by the API response (not a flat guess per call),
recorded after the call completes.

## What the AI layer is asked to do

The AI layer is scoped narrowly: given the rule-based scores and the mark
context (both mark texts, Nice classes, goods/services text), assess
holistic plausibility of confusion that the rule-based components might
under- or over-weight — for example, two marks that are conceptually the
same invented term with a spelling variation neither the textual nor
phonetic component fully captures. It is explicitly **not** asked to:

- Give legal advice or a risk verdict.
- Decide whether to file an opposition.
- Generate customer-facing summary text unsupervised (any AI-generated
  customer copy must go through the language rules in
  [`docs/product/legal-language.md`](../product/legal-language.md)).

## Failure modes

| Failure | Behavior |
| --- | --- |
| `AI_PROVIDER=none` | `AiEnrichmentPort` is never wired in; `aiPlausibilityAdjustment` is always `0`. |
| Missing `OPENAI_API_KEY` with `AI_PROVIDER=openai` | Treated as a configuration error; AI layer disabled with an operational warning, pipeline continues rule-based-only. |
| Budget exhausted | `adjust()` returns `null` for the remainder of the month; logged, not silent. |
| Provider timeout/error | `adjust()` returns `null` for that pair; the specific failure is logged but does not fail the surrounding `ProcessingJob`. |
