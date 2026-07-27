import { describe, expect, it } from 'vitest';
import type { RegisteredTrademarkSnapshot } from '../watched-trademark.js';
import { boipV1WatchEligibilityPolicy, WATCH_ELIGIBILITY_REASON_LABELS_NL } from './boip-v1.policy.js';

function buildSnapshot(overrides: Partial<RegisteredTrademarkSnapshot> = {}): RegisteredTrademarkSnapshot {
  return {
    registryCode: 'BOIP',
    registrationNumber: 'BX-0001234567',
    markText: 'LUMARO',
    markType: 'word',
    niceClasses: [9, 42],
    applicantName: 'Lumaro Technologies B.V.',
    filingDate: '2022-03-10',
    registrationDate: '2022-09-14',
    registerStatus: 'registered',
    lastCheckedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('boipV1WatchEligibilityPolicy', () => {
  it('exposes its identity as version "boip-v1" for the "BOIP" register', () => {
    expect(boipV1WatchEligibilityPolicy.version).toBe('boip-v1');
    expect(boipV1WatchEligibilityPolicy.registerCode).toBe('BOIP');
  });

  it('marks a registered word mark as eligible with no warnings', () => {
    const decision = boipV1WatchEligibilityPolicy.evaluate(buildSnapshot());

    expect(decision.eligible).toBe(true);
    expect(decision.reasonCode).toBe('eligible');
    expect(decision.reasonLabelNl).toBe(WATCH_ELIGIBILITY_REASON_LABELS_NL.eligible);
    expect(decision.sourceStatus).toBe('registered');
    expect(decision.policyVersion).toBe('boip-v1');
    expect(decision.warnings).toEqual([]);
  });

  it('flags a registered word mark with no known registration date as eligible but with a warning', () => {
    const decision = boipV1WatchEligibilityPolicy.evaluate(buildSnapshot({ registrationDate: null }));

    expect(decision.eligible).toBe(true);
    expect(decision.reasonCode).toBe('eligible');
    expect(decision.warnings).toHaveLength(1);
    expect(decision.warnings[0]).toMatch(/registratiedatum/i);
  });

  it.each(['figurative', 'combined', 'other'] as const)(
    'rejects a %s mark as word_mark_required, even when registered',
    (markType) => {
      const decision = boipV1WatchEligibilityPolicy.evaluate(buildSnapshot({ markType }));

      expect(decision.eligible).toBe(false);
      expect(decision.reasonCode).toBe('word_mark_required');
      expect(decision.reasonLabelNl).toBe(WATCH_ELIGIBILITY_REASON_LABELS_NL.word_mark_required);
      expect(decision.warnings).toEqual([]);
    },
  );

  it.each(['pending', 'opposed', 'refused', 'withdrawn', 'expired'] as const)(
    'rejects a word mark with register status "%s" as active_registration_required',
    (registerStatus) => {
      const decision = boipV1WatchEligibilityPolicy.evaluate(buildSnapshot({ registerStatus }));

      expect(decision.eligible).toBe(false);
      expect(decision.reasonCode).toBe('active_registration_required');
      expect(decision.reasonLabelNl).toBe(WATCH_ELIGIBILITY_REASON_LABELS_NL.active_registration_required);
    },
  );

  it('rejects a snapshot with an unknown register status as registration_status_unknown, even for a word mark', () => {
    const decision = boipV1WatchEligibilityPolicy.evaluate(
      buildSnapshot({ registerStatus: 'unknown', markType: 'word' }),
    );

    expect(decision.eligible).toBe(false);
    expect(decision.reasonCode).toBe('registration_status_unknown');
    expect(decision.reasonLabelNl).toBe(WATCH_ELIGIBILITY_REASON_LABELS_NL.registration_status_unknown);
  });

  it('prioritizes registration_status_unknown over word_mark_required when both conditions hold', () => {
    const decision = boipV1WatchEligibilityPolicy.evaluate(
      buildSnapshot({ registerStatus: 'unknown', markType: 'figurative' }),
    );

    expect(decision.reasonCode).toBe('registration_status_unknown');
  });

  it('always sets sourceStatus to the snapshot\'s registerStatus verbatim, whatever the outcome', () => {
    const decision = boipV1WatchEligibilityPolicy.evaluate(buildSnapshot({ registerStatus: 'opposed' }));
    expect(decision.sourceStatus).toBe('opposed');
  });

  it('sets evaluatedAt to a valid, current-ish ISO timestamp', () => {
    const before = Date.now();
    const decision = boipV1WatchEligibilityPolicy.evaluate(buildSnapshot());
    const after = Date.now();

    const evaluatedAtMs = Date.parse(decision.evaluatedAt);
    expect(Number.isNaN(evaluatedAtMs)).toBe(false);
    expect(evaluatedAtMs).toBeGreaterThanOrEqual(before);
    expect(evaluatedAtMs).toBeLessThanOrEqual(after);
  });
});
