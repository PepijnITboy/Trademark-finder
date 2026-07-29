import type { MatchStatus } from './statuses.js';

/** Product queues for the customer match inbox / active / archive views. */
export const MATCH_QUEUES = ['possible', 'active', 'archived'] as const;
export type MatchQueue = (typeof MATCH_QUEUES)[number];

export const POSSIBLE_MATCH_STATUSES: readonly MatchStatus[] = ['new'];

export const ACTIVE_MATCH_STATUSES: readonly MatchStatus[] = [
  'under_review',
  'confirmed_conflict',
  'opposition_filed',
];

export const ARCHIVED_MATCH_STATUSES: readonly MatchStatus[] = [
  'dismissed',
  'opposition_deadline_passed',
];

export function matchQueueForStatus(status: MatchStatus): MatchQueue {
  if ((POSSIBLE_MATCH_STATUSES as readonly string[]).includes(status)) return 'possible';
  if ((ACTIVE_MATCH_STATUSES as readonly string[]).includes(status)) return 'active';
  return 'archived';
}

export function statusesForQueue(queue: MatchQueue): readonly MatchStatus[] {
  switch (queue) {
    case 'possible':
      return POSSIBLE_MATCH_STATUSES;
    case 'active':
      return ACTIVE_MATCH_STATUSES;
    case 'archived':
      return ARCHIVED_MATCH_STATUSES;
  }
}

export function isActiveMatchStatus(status: MatchStatus): boolean {
  return matchQueueForStatus(status) === 'active';
}

export function isDeadlineEligibleStatus(status: MatchStatus): boolean {
  // Possible (new) and active matches with an opposition window appear in deadlines.
  return status === 'new' || isActiveMatchStatus(status);
}

/** Past opposition deadline → archive status. */
export function expireDeadlineMatchStatus(from: MatchStatus): MatchStatus | null {
  if (!isDeadlineEligibleStatus(from)) return null;
  return 'opposition_deadline_passed';
}

/** Accept from possible inbox → under_review (actieve matches). Accepting IS marking relevant. */
export function acceptMatchStatus(from: MatchStatus): MatchStatus | null {
  if (from !== 'new') return null;
  return 'under_review';
}

/**
 * Product rule: once a match is active, there is no separate "mark relevant"
 * transition. Returns false for any attempt to promote an already-active match
 * to confirmed_conflict / similar "relevant" flip.
 */
export function canMarkRelevant(from: MatchStatus): boolean {
  return false;
}

/** Reject from possible → dismissed (archief). */
export function rejectMatchStatus(from: MatchStatus): MatchStatus | null {
  if (from !== 'new') return null;
  return 'dismissed';
}

/** Explicit archive / not-relevant from active queue (or dismiss already-new via reject). */
export function archiveMatchStatus(from: MatchStatus): MatchStatus | null {
  if (!isActiveMatchStatus(from)) return null;
  return 'dismissed';
}

/** Not-relevant from possible OR active → dismissed. */
export function dismissAsNotRelevant(from: MatchStatus): MatchStatus | null {
  if (from === 'new' || isActiveMatchStatus(from)) return 'dismissed';
  return null;
}

export function passesScoreThreshold(totalScore: number, threshold: number): boolean {
  return totalScore >= threshold;
}
