import type { OppositionRuleSet } from '@merkwacht/domain';

/**
 * Implemented by every connector to expose the opposition rule that applies
 * to applications from its register. Kept as a method (not a static
 * constant) so a connector could vary the rule set by application type in
 * the future without changing the {@link TrademarkRegisterConnector}
 * contract. See `docs/domain/opposition-workflow.md`.
 */
export interface OppositionRuleProvider {
  getOppositionRuleSet(): OppositionRuleSet;
}
