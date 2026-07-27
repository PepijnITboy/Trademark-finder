import { describe, expect, it } from 'vitest';
import {
  buildCandidateIdempotencyKey,
  buildMatchJobIdempotencyKey,
  buildScanRunIdempotencyKey,
  computeSourceHash,
} from './idempotency.js';

describe('computeSourceHash', () => {
  it('is stable for the same payload', () => {
    const payload = { a: 1, b: { c: 2, d: [1, 2, 3] } };
    expect(computeSourceHash(payload)).toBe(computeSourceHash(payload));
  });

  it('is stable regardless of object key order', () => {
    const first = { registryCode: 'BOIP', applicationNumber: '1', niceClasses: [9, 42] };
    const second = { applicationNumber: '1', niceClasses: [9, 42], registryCode: 'BOIP' };
    expect(computeSourceHash(first)).toBe(computeSourceHash(second));
  });

  it('changes when a value changes', () => {
    const a = { markText: 'LUMARO' };
    const b = { markText: 'LUMAROO' };
    expect(computeSourceHash(a)).not.toBe(computeSourceHash(b));
  });

  it('distinguishes array order (order-sensitive, unlike object keys)', () => {
    const a = { niceClasses: [9, 42] };
    const b = { niceClasses: [42, 9] };
    expect(computeSourceHash(a)).not.toBe(computeSourceHash(b));
  });
});

describe('buildCandidateIdempotencyKey', () => {
  it('is scoped by registry and application number', () => {
    expect(buildCandidateIdempotencyKey('BOIP', 'BX-1')).toBe(buildCandidateIdempotencyKey('BOIP', 'BX-1'));
    expect(buildCandidateIdempotencyKey('BOIP', 'BX-1')).not.toBe(buildCandidateIdempotencyKey('BOIP', 'BX-2'));
  });
});

describe('buildMatchJobIdempotencyKey', () => {
  it('changes when the source hash changes, so a re-changed candidate is re-queued', () => {
    const first = buildMatchJobIdempotencyKey('watched-1', 'candidate-1', 'hash-a');
    const second = buildMatchJobIdempotencyKey('watched-1', 'candidate-1', 'hash-b');
    expect(first).not.toBe(second);
  });
});

describe('buildScanRunIdempotencyKey', () => {
  it('is scoped to a calendar day', () => {
    const day1 = new Date('2026-05-01T08:00:00Z');
    const day1Later = new Date('2026-05-01T22:00:00Z');
    const day2 = new Date('2026-05-02T08:00:00Z');

    expect(buildScanRunIdempotencyKey('DAILY_SYNC', 'BOIP', day1)).toBe(
      buildScanRunIdempotencyKey('DAILY_SYNC', 'BOIP', day1Later),
    );
    expect(buildScanRunIdempotencyKey('DAILY_SYNC', 'BOIP', day1)).not.toBe(
      buildScanRunIdempotencyKey('DAILY_SYNC', 'BOIP', day2),
    );
  });
});
