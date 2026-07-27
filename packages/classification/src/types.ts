/**
 * Nice classification (1-45) overlap scoring and "related class" suggestion
 * types. Kept dependency-free (no `@merkwacht/domain` import) so this
 * package can be consumed from anywhere - product surfaces that let a
 * customer pick Nice classes when creating a watch, `packages/scoring`'s
 * `niceClassOverlapCalculator`, and `apps/worker` alike - without pulling in
 * the full domain vocabulary. See `docs/scoring/overview.md`.
 */

/** Result of comparing two sets of Nice classes. */
export interface ClassOverlapResult {
  /** Classes present in both sets. */
  readonly overlappingClasses: readonly number[];
  /** Classes only present in the first ("watched") set. */
  readonly onlyInFirst: readonly number[];
  /** Classes only present in the second ("candidate") set. */
  readonly onlyInSecond: readonly number[];
  /** `overlappingClasses.length / unionSize`, `0` when both sets are empty. */
  readonly jaccard: number;
  readonly intersectionSize: number;
  readonly unionSize: number;
}

/**
 * A single curated relationship between two Nice classes, used to power
 * `suggestRelatedClasses`. `reasonNl` is a short, factual (never
 * AI-generated) Dutch explanation shown alongside the suggestion - see
 * `docs/product/legal-language.md` for the tone this must follow (a
 * descriptive observation, never a recommendation to act).
 */
export interface RelatedClassRule {
  readonly niceClass: number;
  readonly relatedClass: number;
  readonly reasonNl: string;
}

/** A single suggested additional Nice class for a watch, derived from `RelatedClassRule`s. */
export interface RelatedClassSuggestion {
  readonly niceClass: number;
  /** The class already selected/watched that triggered this suggestion. */
  readonly triggeredByClass: number;
  readonly reasonNl: string;
}

export interface SuggestRelatedClassesOptions {
  /**
   * Related-class suggestions are an opt-in feature: they are a heuristic,
   * not a registry-confirmed relationship, so surfacing them by default
   * risks implying more certainty than the underlying curated list
   * actually has. Defaults to `false` - see
   * `RELATED_CLASS_SUGGESTIONS_ENABLED_DEFAULT`.
   */
  readonly enabled?: boolean;
  /** Never suggest a class already present in the input selection. Always applied regardless of `enabled`. */
  readonly excludeAlreadySelected?: boolean;
}
