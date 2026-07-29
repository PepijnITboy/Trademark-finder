import { describe, expect, it } from 'vitest';
import { FunnelAccumulator, computeDropRate, makeFunnelStage } from './pipeline-funnel.js';

describe('pipeline funnel helpers', () => {
  it('computes drop rate', () => {
    expect(computeDropRate(0, 0)).toBe(0);
    expect(computeDropRate(100, 25)).toBe(0.25);
  });

  it('makeFunnelStage derives dropped and dropRate', () => {
    const stage = makeFunnelStage({
      code: 'fetched',
      entered: 60_000,
      passed: 58_800,
      reasonCodes: { invalid_payload: 1_200 },
    });
    expect(stage.dropped).toBe(1_200);
    expect(stage.dropRate).toBe(0.02);
  });

  it('FunnelAccumulator builds a complete snapshot', () => {
    const acc = new FunnelAccumulator();
    acc.record('fetched', { entered: 100, passed: 100 });
    acc.record('validated', { entered: 100, passed: 90, reasonCodes: { invalid: 10 } });
    acc.record('above_persist_threshold', { entered: 90, passed: 12 });
    const snap = acc.snapshot({
      runKind: 'register_sync',
      registryCode: 'BOIP',
      startedAt: '2026-07-29T00:00:00.000Z',
      finishedAt: '2026-07-29T00:01:00.000Z',
    });
    expect(snap.version).toBe('funnel-v1');
    expect(snap.stages).toHaveLength(3);
    const validated = snap.stages.find((s) => s.code === 'validated');
    expect(validated?.dropped).toBe(10);
    expect(validated?.dropRate).toBe(0.1);
  });
});
