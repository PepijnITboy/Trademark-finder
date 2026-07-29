import type { OppositionRuleSet } from '@merkwacht/domain';

/**
 * Under Article 46 of the EU Trade Mark Regulation (EUTMR, Regulation
 * (EU) 2017/1001), third parties have **3 months from the date of
 * publication** of an EU trademark application to file a notice of
 * opposition with EUIPO. See `docs/connectors/euipo.md`.
 */
export const EUIPO_OPPOSITION_RULE_SET: OppositionRuleSet = {
  kind: 'months',
  months: 3,
  startsFrom: 'publication_date',
};

export function getEuipoOppositionRuleSet(): OppositionRuleSet {
  return EUIPO_OPPOSITION_RULE_SET;
}
