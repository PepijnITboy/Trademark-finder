import { RELATED_NICE_CLASS_RULES } from './related-class-rules.js';
import type { RelatedClassSuggestion, SuggestRelatedClassesOptions } from './types.js';

/**
 * Related-class suggestions are off by default: they are a heuristic
 * co-occurrence pattern (see `related-class-rules.ts`), not a
 * registry-confirmed relationship, so surfacing them without an explicit
 * opt-in risks implying more certainty than the feature actually has. A
 * customer/operator must explicitly enable the feature (e.g. via a
 * `feature_flag`) before `suggestRelatedClasses` returns anything.
 */
export const RELATED_CLASS_SUGGESTIONS_ENABLED_DEFAULT = false;

/**
 * Suggests additional Nice classes related to `selectedClasses`, based on
 * `RELATED_NICE_CLASS_RULES`. Returns an empty array unless explicitly
 * enabled via `options.enabled` - see
 * `RELATED_CLASS_SUGGESTIONS_ENABLED_DEFAULT`. Pure and synchronous; the
 * caller is responsible for persisting/accepting individual suggestions
 * (mirrors `watch_related_class_suggestions` in `supabase/migrations`).
 */
export function suggestRelatedClasses(
  selectedClasses: readonly number[],
  options: SuggestRelatedClassesOptions = {},
): readonly RelatedClassSuggestion[] {
  const enabled = options.enabled ?? RELATED_CLASS_SUGGESTIONS_ENABLED_DEFAULT;
  if (!enabled) return [];

  const excludeAlreadySelected = options.excludeAlreadySelected ?? true;
  const selected = new Set(selectedClasses);

  const suggestions = new Map<number, RelatedClassSuggestion>();

  for (const selectedClass of selected) {
    for (const rule of RELATED_NICE_CLASS_RULES) {
      const suggestedClass =
        rule.niceClass === selectedClass
          ? rule.relatedClass
          : rule.relatedClass === selectedClass
            ? rule.niceClass
            : null;
      if (suggestedClass === null) continue;
      if (excludeAlreadySelected && selected.has(suggestedClass)) continue;
      // Keep the first (highest-priority) match per suggested class rather
      // than overwriting with a later, lower-priority rule.
      if (!suggestions.has(suggestedClass)) {
        suggestions.set(suggestedClass, {
          niceClass: suggestedClass,
          triggeredByClass: selectedClass,
          reasonNl: rule.reasonNl,
        });
      }
    }
  }

  return [...suggestions.values()].sort((a, b) => a.niceClass - b.niceClass);
}
