import { runInitialOppositionScanPipeline } from '../pipelines/initial-opposition-scan-pipeline.js';
import type { JobContext } from './register-sync.js';

export interface InitialOppositionScanPayload {
  readonly watchedTrademarkId: string;
  readonly triggeredBy?: string;
}

/**
 * INITIAL_OPPOSITION_SCAN: runs once when a `WatchedTrademark` becomes
 * active/eligible, via {@link runInitialOppositionScanPipeline}. See
 * `docs/domain/opposition-workflow.md`.
 */
export async function handleInitialOppositionScan(
  payload: InitialOppositionScanPayload,
  context: JobContext,
): Promise<void> {
  const scanRun = await runInitialOppositionScanPipeline(context, {
    watchedTrademarkId: payload.watchedTrademarkId,
    triggeredBy: payload.triggeredBy ?? 'watch_activated',
  });
  context.logger.info('INITIAL_OPPOSITION_SCAN taak afgerond.', {
    watchedTrademarkId: payload.watchedTrademarkId,
    scanRunId: scanRun.id,
    status: scanRun.status,
  });
}
