import { describe, expect, it } from 'vitest';
import {
  assertRecipientThresholdCompatibleWithWatch,
  assertWatchThresholdCompatibleWithRecipients,
} from './notification-thresholds.js';

describe('notification thresholds', () => {
  it('rejects a watch threshold above the lowest recipient threshold', () => {
    const result = assertWatchThresholdCompatibleWithRecipients(60, [50, 70]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.maxAllowed).toBe(50);
  });

  it('allows a watch threshold at or below recipient floors', () => {
    expect(assertWatchThresholdCompatibleWithRecipients(40, [50, 70]).ok).toBe(true);
  });

  it('rejects recipient thresholds below the watch floor', () => {
    expect(assertRecipientThresholdCompatibleWithWatch(30, 40).ok).toBe(false);
    expect(assertRecipientThresholdCompatibleWithWatch(50, 40).ok).toBe(true);
  });
});
