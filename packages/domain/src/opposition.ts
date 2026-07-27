import type { ProceduralStatus } from './statuses.js';

/**
 * Describes how a register derives its opposition filing deadline.
 * Implemented per-register in `@merkwacht/register-connectors` and resolved
 * generically by `@merkwacht/opposition-rules`. See
 * `docs/domain/opposition-workflow.md`.
 */
export type OppositionRuleSet =
  | {
      readonly kind: 'calendar_days';
      readonly days: number;
      readonly startsFrom: 'publication_date' | 'filing_date';
    }
  | {
      readonly kind: 'months';
      readonly months: number;
      readonly startsFrom: 'publication_date' | 'filing_date';
    };

/** The calculated opposition filing window for a `CandidateApplication`. */
export interface OppositionDeadline {
  readonly candidateApplicationId: string;
  readonly registryCode: string;
  readonly startDate: string;
  readonly deadlineDate: string;
  readonly ruleSet: OppositionRuleSet;
  readonly calculatedAt: string;
}

/**
 * The register-reported procedural status of a `CandidateApplication`,
 * along with the point in time it was observed. Kept distinct from
 * `TrademarkMatch.status`, which is the Merkwacht-side, customer-facing
 * workflow state.
 */
export interface ProceduralStatusResult {
  readonly status: ProceduralStatus;
  readonly observedAt: string;
}
