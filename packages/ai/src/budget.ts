import type { NotificationPayload } from '@merkwacht/domain';

/** Hard monthly spending cap applied when no explicit `limitEur` is provided. See `docs/scoring/ai-layer.md`. */
export const DEFAULT_AI_MONTHLY_BUDGET_EUR = 5;

/** Fraction of the monthly budget at which a `warning` state is reported (before the hard `exhausted` pause). */
export const AI_BUDGET_WARN_THRESHOLD_RATIO = 0.8;

export type AiBudgetState = 'ok' | 'warning' | 'exhausted';

export interface AiBudgetStatus {
  readonly workspaceId: string;
  /** Clamped to `>= 0`; a negative ledger sum is treated as `0` spent. */
  readonly usedEur: number;
  /** Clamped to `>= 0`. */
  readonly limitEur: number;
  readonly remainingEur: number;
  /** `usedEur / limitEur`, in `[0, +Inf)`. `1` when `limitEur` is `0` (nothing left to spend). */
  readonly usedRatio: number;
  readonly state: AiBudgetState;
  /** `true` unless `state === 'exhausted'` - whether a new AI call may proceed. */
  readonly canProceed: boolean;
  /** Dutch, operator/customer-facing summary of the budget state. */
  readonly messageNl: string;
}

function formatEur(value: number): string {
  return value.toFixed(2);
}

/**
 * Evaluates a workspace's (or the global scope's) AI spend for the current
 * calendar month against `limitEur`. Pure function - the caller is
 * responsible for summing `ai_usage_records.estimated_cost_eur` for the
 * current month and passing it in as `usedEur` (see
 * `docs/scoring/ai-layer.md`'s budget enforcement section).
 *
 * Three states, mirroring the product's escalation model:
 * - `ok`: below {@link AI_BUDGET_WARN_THRESHOLD_RATIO} of the budget - proceed silently.
 * - `warning`: at or above {@link AI_BUDGET_WARN_THRESHOLD_RATIO} (default 80%) but still under budget - proceed, but this should be surfaced on `/platform`.
 * - `exhausted`: at or over the limit - `canProceed` is `false`; every AI
 *   call must be skipped (`adjust()` returns `null`) for the remainder of
 *   the month. This is an operational event, not a silent no-op - see
 *   {@link toAiBudgetExhaustedNotification}.
 */
export function checkMonthlyBudget(
  workspaceId: string,
  usedEur: number,
  limitEur: number = DEFAULT_AI_MONTHLY_BUDGET_EUR,
): AiBudgetStatus {
  const safeLimit = Number.isFinite(limitEur) && limitEur > 0 ? limitEur : 0;
  const safeUsed = Number.isFinite(usedEur) && usedEur > 0 ? usedEur : 0;

  const usedRatio = safeLimit === 0 ? 1 : safeUsed / safeLimit;
  const remainingEur = Math.max(0, safeLimit - safeUsed);

  let state: AiBudgetState;
  let messageNl: string;

  if (safeUsed >= safeLimit) {
    state = 'exhausted';
    messageNl = `Het maandelijkse AI-budget van €${formatEur(safeLimit)} is bereikt (verbruik: €${formatEur(safeUsed)}). AI-verrijking is gepauzeerd tot een nieuwe kalendermaand of een verhoging van het budget.`;
  } else if (usedRatio >= AI_BUDGET_WARN_THRESHOLD_RATIO) {
    state = 'warning';
    messageNl = `Het AI-budget is voor ${Math.round(usedRatio * 100)}% verbruikt (€${formatEur(safeUsed)} van €${formatEur(safeLimit)}).`;
  } else {
    state = 'ok';
    messageNl = `AI-budget binnen grenzen (€${formatEur(safeUsed)} van €${formatEur(safeLimit)} verbruikt).`;
  }

  return {
    workspaceId,
    usedEur: safeUsed,
    limitEur: safeLimit,
    remainingEur,
    usedRatio,
    state,
    canProceed: state !== 'exhausted',
    messageNl,
  };
}

/**
 * Builds the `ai_budget_exhausted` notification payload for a budget status
 * that has reached `exhausted`. Throws if called with a non-exhausted
 * status, so callers can't accidentally fire a false alarm.
 */
export function toAiBudgetExhaustedNotification(
  status: AiBudgetStatus,
): Extract<NotificationPayload, { type: 'ai_budget_exhausted' }> {
  if (status.state !== 'exhausted') {
    throw new Error('toAiBudgetExhaustedNotification called with a non-exhausted AiBudgetStatus');
  }
  return {
    type: 'ai_budget_exhausted',
    monthlyBudgetEur: status.limitEur,
    spentEur: status.usedEur,
  };
}
