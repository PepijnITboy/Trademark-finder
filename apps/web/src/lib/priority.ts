import type { BadgeTone } from '../components/StatusBadge.vue';

export type PriorityLevel = 'high' | 'medium' | 'low';

export interface PriorityMeta {
  readonly level: PriorityLevel;
  readonly labelNl: string;
  readonly tone: BadgeTone;
}

/** Derives a priority bucket from a match's `totalScore` (0-100). Thresholds mirror the score-bar coloring in `ScoreBar.vue`. */
export function priorityFromScore(totalScore: number): PriorityMeta {
  if (totalScore >= 70) return { level: 'high', labelNl: 'Hoog', tone: 'danger' };
  if (totalScore >= 40) return { level: 'medium', labelNl: 'Gemiddeld', tone: 'warning' };
  return { level: 'low', labelNl: 'Laag', tone: 'neutral' };
}

export interface DeadlineBucket {
  readonly key: string;
  readonly labelNl: string;
}

const DEADLINE_BUCKETS: readonly DeadlineBucket[] = [
  { key: 'passed', labelNl: 'Termijn verstreken' },
  { key: 'urgent', labelNl: 'Deze week' },
  { key: 'soon', labelNl: 'Komende 14 dagen' },
  { key: 'upcoming', labelNl: 'Komende 30 dagen' },
  { key: 'later', labelNl: 'Later' },
  { key: 'unknown', labelNl: 'Onbekende termijn' },
];

export function deadlineBucketKey(daysRemaining: number | null): string {
  if (daysRemaining === null) return 'unknown';
  if (daysRemaining < 0) return 'passed';
  if (daysRemaining <= 7) return 'urgent';
  if (daysRemaining <= 14) return 'soon';
  if (daysRemaining <= 30) return 'upcoming';
  return 'later';
}

export function deadlineBucketsInOrder(): readonly DeadlineBucket[] {
  return DEADLINE_BUCKETS;
}
