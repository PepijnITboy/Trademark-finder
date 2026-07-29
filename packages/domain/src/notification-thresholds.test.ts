import { describe, expect, it } from 'vitest';
import {
  assertRecipientThresholdCompatibleWithWatch,
  assertWatchThresholdCompatibleWithRecipients,
  formatRecipientNotifySummaryNl,
  normalizeRecipientNotifyConfig,
  thresholdFloorsForWatch,
} from './notification-thresholds.js';

describe('normalizeRecipientNotifyConfig', () => {
  it('requires threshold % for threshold mode and clears cadence', () => {
    const ok = normalizeRecipientNotifyConfig({
      mode: 'threshold',
      minScoreThreshold: 70,
      digestCadence: 'DAILY',
    });
    expect(ok).toEqual({
      ok: true,
      config: { mode: 'threshold', digestCadence: null, minScoreThreshold: 70 },
    });
    expect(normalizeRecipientNotifyConfig({ mode: 'threshold' }).ok).toBe(false);
  });

  it('requires cadence for digest mode and clears threshold', () => {
    const ok = normalizeRecipientNotifyConfig({
      mode: 'digest',
      digestCadence: 'MONTHLY',
      minScoreThreshold: 80,
    });
    expect(ok).toEqual({
      ok: true,
      config: { mode: 'digest', digestCadence: 'MONTHLY', minScoreThreshold: null },
    });
    expect(normalizeRecipientNotifyConfig({ mode: 'digest' }).ok).toBe(false);
  });
});

describe('watch ↔ recipient compatibility', () => {
  it('rejects a watch threshold above the lowest threshold-mode recipient', () => {
    const result = assertWatchThresholdCompatibleWithRecipients(60, [50, 70]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.maxAllowed).toBe(50);
  });

  it('allows a watch threshold when only digest recipients exist (empty floors)', () => {
    expect(assertWatchThresholdCompatibleWithRecipients(80, []).ok).toBe(true);
  });

  it('rejects recipient thresholds below the watch floor', () => {
    expect(assertRecipientThresholdCompatibleWithWatch(30, 40).ok).toBe(false);
    expect(assertRecipientThresholdCompatibleWithWatch(50, 40).ok).toBe(true);
  });

  it('thresholdFloorsForWatch ignores digest recipients and inactive addresses', () => {
    const floors = thresholdFloorsForWatch(
      [
        {
          mode: 'threshold',
          minScoreThreshold: 60,
          isActive: true,
          allWatches: true,
          watchedTrademarkIds: [],
        },
        {
          mode: 'digest',
          minScoreThreshold: null,
          isActive: true,
          allWatches: true,
          watchedTrademarkIds: [],
        },
        {
          mode: 'threshold',
          minScoreThreshold: 40,
          isActive: false,
          allWatches: true,
          watchedTrademarkIds: [],
        },
        {
          mode: 'threshold',
          minScoreThreshold: 55,
          isActive: true,
          allWatches: false,
          watchedTrademarkIds: ['watch-a'],
        },
      ],
      'watch-a',
    );
    expect(floors).toEqual([60, 55]);
  });
});

describe('formatRecipientNotifySummaryNl', () => {
  it('labels both modes', () => {
    expect(
      formatRecipientNotifySummaryNl({
        mode: 'threshold',
        digestCadence: null,
        minScoreThreshold: 70,
      }),
    ).toBe('Melding vanaf 70%');
    expect(
      formatRecipientNotifySummaryNl({
        mode: 'digest',
        digestCadence: 'WEEKLY',
        minScoreThreshold: null,
      }),
    ).toBe('Wekelijks rapport');
  });
});
