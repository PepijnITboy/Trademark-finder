import { describe, expect, it } from 'vitest';
import {
  AI_BUDGET_WARN_THRESHOLD_RATIO,
  DEFAULT_AI_MONTHLY_BUDGET_EUR,
  checkMonthlyBudget,
  toAiBudgetExhaustedNotification,
} from './budget.js';

describe('checkMonthlyBudget', () => {
  it('defaults to a €5 monthly budget when limitEur is omitted', () => {
    expect(DEFAULT_AI_MONTHLY_BUDGET_EUR).toBe(5);
    const status = checkMonthlyBudget('ws-1', 0);
    expect(status.limitEur).toBe(5);
  });

  it('reports "ok" comfortably under budget', () => {
    const status = checkMonthlyBudget('ws-1', 1, 5);
    expect(status.state).toBe('ok');
    expect(status.canProceed).toBe(true);
    expect(status.remainingEur).toBe(4);
    expect(status.usedRatio).toBeCloseTo(0.2);
  });

  it('reports "warning" at exactly the 80% threshold', () => {
    const status = checkMonthlyBudget('ws-1', 4, 5);
    expect(AI_BUDGET_WARN_THRESHOLD_RATIO).toBe(0.8);
    expect(status.state).toBe('warning');
    expect(status.canProceed).toBe(true);
  });

  it('reports "warning" just above the 80% threshold', () => {
    const status = checkMonthlyBudget('ws-1', 4.5, 5);
    expect(status.state).toBe('warning');
    expect(status.canProceed).toBe(true);
  });

  it('reports "exhausted" and disallows further calls once usage reaches the limit', () => {
    const status = checkMonthlyBudget('ws-1', 5, 5);
    expect(status.state).toBe('exhausted');
    expect(status.canProceed).toBe(false);
    expect(status.remainingEur).toBe(0);
  });

  it('reports "exhausted" when usage exceeds the limit', () => {
    const status = checkMonthlyBudget('ws-1', 7.5, 5);
    expect(status.state).toBe('exhausted');
    expect(status.canProceed).toBe(false);
  });

  it('clamps a negative usedEur to zero rather than reporting a negative ratio', () => {
    const status = checkMonthlyBudget('ws-1', -10, 5);
    expect(status.usedEur).toBe(0);
    expect(status.state).toBe('ok');
  });

  it('treats a zero/negative limit as fully exhausted rather than dividing by zero', () => {
    const status = checkMonthlyBudget('ws-1', 0, 0);
    expect(status.state).toBe('exhausted');
    expect(status.canProceed).toBe(false);
    expect(Number.isFinite(status.usedRatio)).toBe(true);
  });

  it('includes the workspaceId verbatim in the result', () => {
    const status = checkMonthlyBudget('ws-42', 1, 5);
    expect(status.workspaceId).toBe('ws-42');
  });

  it('produces a Dutch, human-readable message for every state', () => {
    for (const usedEur of [0, 4.5, 6]) {
      const status = checkMonthlyBudget('ws-1', usedEur, 5);
      expect(status.messageNl.length).toBeGreaterThan(0);
    }
  });
});

describe('toAiBudgetExhaustedNotification', () => {
  it('builds an ai_budget_exhausted payload from an exhausted status', () => {
    const status = checkMonthlyBudget('ws-1', 6, 5);
    const notification = toAiBudgetExhaustedNotification(status);
    expect(notification).toEqual({ type: 'ai_budget_exhausted', monthlyBudgetEur: 5, spentEur: 6 });
  });

  it('throws when called with a non-exhausted status', () => {
    const status = checkMonthlyBudget('ws-1', 1, 5);
    expect(() => toAiBudgetExhaustedNotification(status)).toThrow();
  });
});
