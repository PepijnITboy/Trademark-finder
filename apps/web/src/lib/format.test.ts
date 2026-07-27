import { describe, expect, it } from 'vitest';
import {
  formatDaysOverdue,
  formatDaysRemaining,
  formatMatchScorePercent,
  overdueSeverity,
} from './format';

describe('formatDaysRemaining', () => {
  it('never phrases approaching deadlines as verstreken', () => {
    expect(formatDaysRemaining(-5)).toBe('—');
    expect(formatDaysRemaining(0)).toBe('Vandaag verloopt de termijn');
    expect(formatDaysRemaining(1)).toBe('1 dag resterend');
    expect(formatDaysRemaining(12)).toBe('12 dagen resterend');
  });
});

describe('formatDaysOverdue / overdueSeverity', () => {
  it('describes how far past the deadline an archived match is', () => {
    expect(formatDaysOverdue(3)).toBe('3 dagen verstreken');
    expect(formatDaysOverdue(1)).toBe('1 dag verstreken');
    expect(overdueSeverity(3)).toBe('mild');
    expect(overdueSeverity(14)).toBe('moderate');
    expect(overdueSeverity(45)).toBe('severe');
  });
});

describe('formatMatchScorePercent', () => {
  it('renders totalScore as a percentage', () => {
    expect(formatMatchScorePercent(72.4)).toBe('72%');
    expect(formatMatchScorePercent(0)).toBe('0%');
  });
});
