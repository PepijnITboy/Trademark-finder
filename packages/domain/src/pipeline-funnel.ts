/**
 * Platform-visible pipeline funnel: scan sync, opposition scan, name research, or export.
 * Every stage must report entered/passed/dropped so operators see drop% and hang points.
 */

export type PipelineRunKind =
  | 'register_sync'
  | 'initial_opposition_scan'
  | 'name_research'
  | 'generate_export';

export type FunnelStageCode =
  | 'fetched'
  | 'validated'
  | 'changed'
  | 'opposition_window'
  | 'watch_eligible'
  | 'retrieval_union'
  | 'feature_scored'
  | 'above_persist_threshold'
  | 'match_upserted'
  | 'ai_reviewed'
  | 'notification_decided'
  | 'export_built'
  | 'export_stored'
  | 'failed'
  | 'truncated';

export interface FunnelStageStat {
  readonly code: FunnelStageCode;
  readonly entered: number;
  readonly passed: number;
  readonly dropped: number;
  /** dropped / entered, or 0 when entered is 0 */
  readonly dropRate: number;
  readonly reasonCodes: Readonly<Record<string, number>>;
  readonly durationMs?: number;
}

export interface PipelineFunnelSnapshot {
  readonly version: string;
  readonly runKind: PipelineRunKind;
  readonly registryCode?: string;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly stages: readonly FunnelStageStat[];
  readonly stuckStage?: FunnelStageCode;
  readonly lastError?: string;
}

export const FUNNEL_SNAPSHOT_VERSION = 'funnel-v1';

export function computeDropRate(entered: number, dropped: number): number {
  if (entered <= 0) return 0;
  return Math.round((dropped / entered) * 10_000) / 10_000;
}

export function makeFunnelStage(input: {
  code: FunnelStageCode;
  entered: number;
  passed: number;
  reasonCodes?: Readonly<Record<string, number>>;
  durationMs?: number;
}): FunnelStageStat {
  const dropped = Math.max(0, input.entered - input.passed);
  return {
    code: input.code,
    entered: input.entered,
    passed: input.passed,
    dropped,
    dropRate: computeDropRate(input.entered, dropped),
    reasonCodes: input.reasonCodes ?? {},
    ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
  };
}

/** Mutable accumulator used by worker pipelines (TDD-friendly). */
export class FunnelAccumulator {
  private readonly stages = new Map<
    FunnelStageCode,
    { entered: number; passed: number; reasonCodes: Record<string, number>; durationMs?: number }
  >();

  record(
    code: FunnelStageCode,
    counts: { entered: number; passed: number; reasonCodes?: Record<string, number>; durationMs?: number },
  ): void {
    const existing = this.stages.get(code);
    const reasonCodes = { ...(existing?.reasonCodes ?? {}), ...(counts.reasonCodes ?? {}) };
    const next: {
      entered: number;
      passed: number;
      reasonCodes: Record<string, number>;
      durationMs?: number;
    } = {
      entered: (existing?.entered ?? 0) + counts.entered,
      passed: (existing?.passed ?? 0) + counts.passed,
      reasonCodes,
    };
    const durationMs = counts.durationMs ?? existing?.durationMs;
    if (durationMs !== undefined) next.durationMs = durationMs;
    this.stages.set(code, next);
  }

  snapshot(input: {
    runKind: PipelineRunKind;
    registryCode?: string;
    startedAt: string;
    finishedAt?: string;
    stuckStage?: FunnelStageCode;
    lastError?: string;
  }): PipelineFunnelSnapshot {
    const stages = [...this.stages.entries()].map(([code, value]) => {
      const stageInput: {
        code: FunnelStageCode;
        entered: number;
        passed: number;
        reasonCodes: Record<string, number>;
        durationMs?: number;
      } = {
        code,
        entered: value.entered,
        passed: value.passed,
        reasonCodes: value.reasonCodes,
      };
      if (value.durationMs !== undefined) stageInput.durationMs = value.durationMs;
      return makeFunnelStage(stageInput);
    });
    return {
      version: FUNNEL_SNAPSHOT_VERSION,
      runKind: input.runKind,
      ...(input.registryCode !== undefined ? { registryCode: input.registryCode } : {}),
      startedAt: input.startedAt,
      ...(input.finishedAt !== undefined ? { finishedAt: input.finishedAt } : {}),
      stages,
      ...(input.stuckStage !== undefined ? { stuckStage: input.stuckStage } : {}),
      ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
    };
  }
}
