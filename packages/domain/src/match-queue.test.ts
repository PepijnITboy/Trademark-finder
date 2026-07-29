import { describe, expect, it } from 'vitest';
import {
  acceptMatchStatus,
  archiveMatchStatus,
  canMarkRelevant,
  dismissAsNotRelevant,
  expireDeadlineMatchStatus,
  isDeadlineEligibleStatus,
  matchQueueForStatus,
  passesScoreThreshold,
  rejectMatchStatus,
  statusesForQueue,
} from './match-queue.js';

describe('matchQueueForStatus', () => {
  it('maps new to possible', () => {
    expect(matchQueueForStatus('new')).toBe('possible');
  });

  it('maps review states to active', () => {
    expect(matchQueueForStatus('under_review')).toBe('active');
    expect(matchQueueForStatus('confirmed_conflict')).toBe('active');
    expect(matchQueueForStatus('opposition_filed')).toBe('active');
  });

  it('maps dismissed to archived', () => {
    expect(matchQueueForStatus('dismissed')).toBe('archived');
    expect(matchQueueForStatus('opposition_deadline_passed')).toBe('archived');
  });
});

describe('triage transitions', () => {
  it('accepts only from new', () => {
    expect(acceptMatchStatus('new')).toBe('under_review');
    expect(acceptMatchStatus('under_review')).toBeNull();
  });

  it('rejects only from new', () => {
    expect(rejectMatchStatus('new')).toBe('dismissed');
    expect(rejectMatchStatus('confirmed_conflict')).toBeNull();
  });

  it('archives only from active', () => {
    expect(archiveMatchStatus('under_review')).toBe('dismissed');
    expect(archiveMatchStatus('new')).toBeNull();
    expect(archiveMatchStatus('dismissed')).toBeNull();
  });

  it('never allows a separate mark-relevant transition after accept', () => {
    expect(canMarkRelevant('new')).toBe(false);
    expect(canMarkRelevant('under_review')).toBe(false);
    expect(canMarkRelevant('confirmed_conflict')).toBe(false);
  });

  it('dismissAsNotRelevant works from possible or active', () => {
    expect(dismissAsNotRelevant('new')).toBe('dismissed');
    expect(dismissAsNotRelevant('under_review')).toBe('dismissed');
    expect(dismissAsNotRelevant('dismissed')).toBeNull();
  });
});

describe('deadlines and threshold', () => {
  it('includes possible (new) and active statuses as deadline-eligible', () => {
    expect(isDeadlineEligibleStatus('new')).toBe(true);
    expect(isDeadlineEligibleStatus('under_review')).toBe(true);
    expect(isDeadlineEligibleStatus('dismissed')).toBe(false);
  });

  it('expireDeadlineMatchStatus archives eligible matches', () => {
    expect(expireDeadlineMatchStatus('new')).toBe('opposition_deadline_passed');
    expect(expireDeadlineMatchStatus('under_review')).toBe('opposition_deadline_passed');
    expect(expireDeadlineMatchStatus('dismissed')).toBeNull();
  });

  it('passesScoreThreshold compares inclusive', () => {
    expect(passesScoreThreshold(70, 70)).toBe(true);
    expect(passesScoreThreshold(69, 70)).toBe(false);
  });

  it('statusesForQueue returns correct sets', () => {
    expect(statusesForQueue('possible')).toEqual(['new']);
    expect(statusesForQueue('active')).toContain('under_review');
  });
});
