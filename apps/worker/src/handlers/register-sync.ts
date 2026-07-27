import { runDailySyncPipeline } from '../pipelines/daily-sync-pipeline.js';
import type { PipelineContext } from '../pipelines/types.js';

/**
 * Every worker job handler receives the shared `PipelineContext` (store,
 * connectors, logger, optional AI port) built once per process by
 * `apps/worker/src/context.ts`.
 */
export type JobContext = PipelineContext;

export interface RegisterSyncPayload {
  /** Sync only this register; omit to sync every configured connector. */
  readonly registryCode?: string;
  readonly triggeredBy?: string;
}

/**
 * REGISTER_SYNC: runs {@link runDailySyncPipeline} for `payload.registryCode`,
 * or every configured connector when omitted (e.g. the nightly full run).
 * See `docs/operations/daily-jobs.md`.
 */
export async function handleRegisterSync(payload: RegisterSyncPayload, context: JobContext): Promise<void> {
  const registryCodes = payload.registryCode ? [payload.registryCode] : [...context.connectors.keys()];

  if (registryCodes.length === 0) {
    context.logger.warn('REGISTER_SYNC overgeslagen: geen registerkoppelingen geconfigureerd.');
    return;
  }

  for (const registryCode of registryCodes) {
    const scanRun = await runDailySyncPipeline(context, {
      registryCode,
      triggeredBy: payload.triggeredBy ?? 'schedule',
    });
    context.logger.info('REGISTER_SYNC taak afgerond.', {
      registryCode,
      scanRunId: scanRun.id,
      status: scanRun.status,
    });
  }
}
