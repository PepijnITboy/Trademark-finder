import { FunnelAccumulator } from '@merkwacht/domain';
import type { JobContext } from './register-sync';

export interface GenerateExportPayload {
  readonly organizationId: string;
  readonly format: 'csv' | 'html';
  readonly scope: 'matches' | 'archive';
}

/**
 * GENERATE_EXPORT handler with funnel instrumentation.
 * Storage wiring remains incomplete — funnel records where the run gets stuck.
 */
export async function handleGenerateExport(payload: GenerateExportPayload, context: JobContext): Promise<void> {
  const startedAt = new Date().toISOString();
  const funnel = new FunnelAccumulator();
  // Placeholder volume until store query is wired.
  const startVolume = 0;
  funnel.record('export_built', { entered: Math.max(startVolume, 1), passed: Math.max(startVolume, 1) });
  funnel.record('export_stored', {
    entered: Math.max(startVolume, 1),
    passed: 0,
    reasonCodes: { storage_unwired: Math.max(startVolume, 1) },
  });
  funnel.record('failed', { entered: 1, passed: 0 });

  const snapshot = funnel.snapshot({
    runKind: 'generate_export',
    startedAt,
    finishedAt: new Date().toISOString(),
    stuckStage: 'export_stored',
    lastError: 'Exportopslag nog niet gekoppeld',
  });

  context.logger.info('GENERATE_EXPORT taak gestart (stub, nog geen opslagkoppeling actief).', {
    payload,
    funnel: snapshot,
  });
}
