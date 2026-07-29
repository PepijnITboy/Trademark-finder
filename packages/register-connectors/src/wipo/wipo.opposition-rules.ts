import type { OppositionRuleSet } from '@merkwacht/domain';

/**
 * WIPO itself does not administer oppositions for Madrid System
 * international registrations - opposition (or "provisional refusal
 * based on opposition") is a matter for each **designated Contracting
 * Party's** national/regional office, with deadlines that vary by
 * jurisdiction (e.g. EUIPO's 3-month EUTMR window if the EU is
 * designated, vs. other periods for other offices) and are typically
 * measured from the *national* publication date in that office's
 * gazette, not from WIPO's own International Registration publication.
 *
 * Encoding a single, precise rule here is therefore not possible without
 * also tracking which offices were designated - out of scope for this
 * connector. This value is a **documented placeholder**
 * (3 months from WIPO's own publication date, the most common single
 * period among Madrid member offices) used only until per-designated-office
 * opposition tracking is built - see `docs/connectors/wipo.md`. Consumers
 * that need to be precise about opposition timing for a specific
 * designated office should not rely on this value alone.
 */
export const WIPO_OPPOSITION_RULE_SET: OppositionRuleSet = {
  kind: 'months',
  months: 3,
  startsFrom: 'publication_date',
};

export function getWipoOppositionRuleSet(): OppositionRuleSet {
  return WIPO_OPPOSITION_RULE_SET;
}
