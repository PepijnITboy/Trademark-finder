import type { OppositionRuleSet } from '@merkwacht/domain';

/**
 * Under Section 13 of the Lanham Act (15 U.S.C. § 1063), any person who
 * believes they would be damaged by the registration of a mark has **30
 * days from the date of publication** in the Official Gazette to file an
 * opposition (or a request to extend time to oppose, which can extend
 * the window by up to an additional 90 days in 30/60/90-day increments).
 * This connector encodes only the base statutory 30-day window; extension
 * requests are not modeled. See `docs/connectors/uspto.md`.
 */
export const USPTO_OPPOSITION_RULE_SET: OppositionRuleSet = {
  kind: 'calendar_days',
  days: 30,
  startsFrom: 'publication_date',
};

export function getUsptoOppositionRuleSet(): OppositionRuleSet {
  return USPTO_OPPOSITION_RULE_SET;
}
