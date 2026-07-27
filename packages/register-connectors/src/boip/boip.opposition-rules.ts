import type { OppositionRuleSet } from '@merkwacht/domain';

/**
 * Under Benelux trademark law (BVIE), third parties have 2 calendar months
 * from an application's publication date to file a notice of opposition
 * with BOIP. See `docs/connectors/boip.md`.
 */
export const BOIP_OPPOSITION_RULE_SET: OppositionRuleSet = {
  kind: 'months',
  months: 2,
  startsFrom: 'publication_date',
};

export function getBoipOppositionRuleSet(): OppositionRuleSet {
  return BOIP_OPPOSITION_RULE_SET;
}
