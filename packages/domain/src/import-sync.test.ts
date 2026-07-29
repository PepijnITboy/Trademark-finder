import { describe, expect, it } from 'vitest';
import {
  deriveImportDayStatuses,
  sortImportSyncsForDisplay,
  splitImportSyncsByPurpose,
} from './import-sync.js';

describe('import-sync', () => {
  it('marks today pending when last sync was yesterday ok', () => {
    const now = new Date('2026-07-28T12:00:00.000Z');
    const result = deriveImportDayStatuses(
      {
        lastSyncAt: '2026-07-27T10:00:00.000Z',
        lastStatus: 'succeeded',
      },
      now,
    );
    expect(result.yesterdayStatus).toBe('ok');
    expect(result.todayStatus).toBe('pending');
  });

  it('marks today fail when last sync failed today', () => {
    const now = new Date('2026-07-28T18:00:00.000Z');
    const result = deriveImportDayStatuses(
      {
        lastSyncAt: '2026-07-28T08:00:00.000Z',
        lastStatus: 'failed',
      },
      now,
    );
    expect(result.todayStatus).toBe('fail');
  });

  it('splits watch vs name research and sorts failures first', () => {
    const rows = [
      {
        purpose: 'watch' as const,
        lastSyncAt: null,
        lastStatus: 'never' as const,
        todayStatus: 'pending' as const,
        yesterdayStatus: 'never' as const,
      },
      {
        purpose: 'name_research' as const,
        lastSyncAt: '2026-07-28T01:00:00.000Z',
        lastStatus: 'failed' as const,
        todayStatus: 'fail' as const,
        yesterdayStatus: 'ok' as const,
      },
      {
        purpose: 'watch' as const,
        lastSyncAt: '2026-07-28T02:00:00.000Z',
        lastStatus: 'succeeded' as const,
        todayStatus: 'ok' as const,
        yesterdayStatus: 'ok' as const,
      },
    ];
    const sorted = sortImportSyncsForDisplay(rows);
    expect(sorted[0]?.lastStatus).toBe('failed');
    const split = splitImportSyncsByPurpose(rows);
    expect(split.watch).toHaveLength(2);
    expect(split.nameResearch).toHaveLength(1);
  });
});
