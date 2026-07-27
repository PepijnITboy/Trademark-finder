import type { OppositionRuleSet } from '@merkwacht/domain';
import { describe, expect, it } from 'vitest';
import { calculateOppositionDeadline } from './calculate-opposition-deadline.js';

const BOIP_TWO_MONTH_RULE: OppositionRuleSet = {
  kind: 'months',
  months: 2,
  startsFrom: 'publication_date',
};

describe('calculateOppositionDeadline', () => {
  it('adds exactly 2 calendar months from the publication date for the BOIP rule set', () => {
    const deadline = calculateOppositionDeadline({
      candidateApplicationId: 'candidate-1',
      registryCode: 'BOIP',
      filingDate: '2026-01-10',
      publicationDate: '2026-03-15',
      ruleSet: BOIP_TWO_MONTH_RULE,
    });

    expect(deadline.startDate).toBe('2026-03-15');
    expect(deadline.deadlineDate).toBe('2026-05-15');
    expect(deadline.registryCode).toBe('BOIP');
    expect(deadline.candidateApplicationId).toBe('candidate-1');
    expect(deadline.ruleSet).toEqual(BOIP_TWO_MONTH_RULE);
  });

  it('starts from the filing date when the rule set specifies startsFrom: filing_date', () => {
    const deadline = calculateOppositionDeadline({
      candidateApplicationId: 'candidate-2',
      registryCode: 'BOIP',
      filingDate: '2026-01-10',
      publicationDate: '2026-03-15',
      ruleSet: { kind: 'months', months: 2, startsFrom: 'filing_date' },
    });

    expect(deadline.startDate).toBe('2026-01-10');
    expect(deadline.deadlineDate).toBe('2026-03-10');
  });

  it('supports calendar_days rule sets', () => {
    const deadline = calculateOppositionDeadline({
      candidateApplicationId: 'candidate-3',
      registryCode: 'BOIP',
      filingDate: '2026-01-01',
      publicationDate: '2026-01-01',
      ruleSet: { kind: 'calendar_days', days: 30, startsFrom: 'publication_date' },
    });

    expect(deadline.deadlineDate).toBe('2026-01-31');
  });

  describe('leap year handling', () => {
    it('clamps 31 December + 2 months to the last day of February in a leap year', () => {
      const deadline = calculateOppositionDeadline({
        candidateApplicationId: 'candidate-leap-1',
        registryCode: 'BOIP',
        filingDate: '2025-10-01',
        publicationDate: '2025-12-31',
        ruleSet: BOIP_TWO_MONTH_RULE,
      });

      // 2026 is not a leap year -> +2 months from 31 Dec 2025 clamps to 28 Feb 2026.
      expect(deadline.deadlineDate).toBe('2026-02-28');
    });

    it('lands on 29 February when +2 months crosses into a leap year February', () => {
      const deadline = calculateOppositionDeadline({
        candidateApplicationId: 'candidate-leap-2',
        registryCode: 'BOIP',
        filingDate: '2023-10-01',
        publicationDate: '2023-12-29',
        ruleSet: BOIP_TWO_MONTH_RULE,
      });

      // 2024 is a leap year -> +2 months from 29 Dec 2023 = 29 Feb 2024.
      expect(deadline.deadlineDate).toBe('2024-02-29');
    });

    it('clamps 29 February of a leap year + 2 months to 30 April (no clamping needed, sanity check)', () => {
      const deadline = calculateOppositionDeadline({
        candidateApplicationId: 'candidate-leap-3',
        registryCode: 'BOIP',
        filingDate: '2023-12-01',
        publicationDate: '2024-02-29',
        ruleSet: BOIP_TWO_MONTH_RULE,
      });

      expect(deadline.deadlineDate).toBe('2024-04-29');
    });

    it('handles a 1-month rule from 29 February of a leap year by clamping to 28/29 the following month', () => {
      const deadline = calculateOppositionDeadline({
        candidateApplicationId: 'candidate-leap-4',
        registryCode: 'BOIP',
        filingDate: '2024-01-01',
        publicationDate: '2024-02-29',
        ruleSet: { kind: 'months', months: 1, startsFrom: 'publication_date' },
      });

      expect(deadline.deadlineDate).toBe('2024-03-29');
    });
  });

  describe('missing/invalid date handling', () => {
    it('throws a RangeError when publicationDate is an empty string', () => {
      expect(() =>
        calculateOppositionDeadline({
          candidateApplicationId: 'candidate-missing-1',
          registryCode: 'BOIP',
          filingDate: '2026-01-01',
          publicationDate: '',
          ruleSet: BOIP_TWO_MONTH_RULE,
        }),
      ).toThrow(RangeError);
    });

    it('throws a RangeError when filingDate is an empty string and the rule set starts from filing_date', () => {
      expect(() =>
        calculateOppositionDeadline({
          candidateApplicationId: 'candidate-missing-2',
          registryCode: 'BOIP',
          filingDate: '',
          publicationDate: '2026-01-01',
          ruleSet: { kind: 'months', months: 2, startsFrom: 'filing_date' },
        }),
      ).toThrow(RangeError);
    });

    it('does not throw for a missing filingDate when the rule set starts from publication_date', () => {
      expect(() =>
        calculateOppositionDeadline({
          candidateApplicationId: 'candidate-missing-3',
          registryCode: 'BOIP',
          filingDate: '',
          publicationDate: '2026-01-01',
          ruleSet: BOIP_TWO_MONTH_RULE,
        }),
      ).not.toThrow();
    });

    it('throws a RangeError for a malformed (non-ISO) date string', () => {
      expect(() =>
        calculateOppositionDeadline({
          candidateApplicationId: 'candidate-malformed',
          registryCode: 'BOIP',
          filingDate: '2026-01-01',
          publicationDate: 'not-a-date',
          ruleSet: BOIP_TWO_MONTH_RULE,
        }),
      ).toThrow(RangeError);
    });
  });

  it('sets calculatedAt to a valid ISO timestamp', () => {
    const deadline = calculateOppositionDeadline({
      candidateApplicationId: 'candidate-4',
      registryCode: 'BOIP',
      filingDate: '2026-01-01',
      publicationDate: '2026-01-01',
      ruleSet: BOIP_TWO_MONTH_RULE,
    });

    expect(() => new Date(deadline.calculatedAt).toISOString()).not.toThrow();
    expect(Number.isNaN(Date.parse(deadline.calculatedAt))).toBe(false);
  });
});
