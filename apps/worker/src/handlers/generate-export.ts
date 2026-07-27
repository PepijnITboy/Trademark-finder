import type { JobContext } from './register-sync';

export interface GenerateExportPayload {
  readonly organizationId: string;
  readonly format: 'csv' | 'html';
  readonly scope: 'matches' | 'archive';
}

/**
 * Stub handler for GENERATE_EXPORT. Should build a dossier/export using
 * `@merkwacht/exports` (`toCsv`/`renderDossierHtml`) for the requested scope
 * and persist/deliver it (e.g. via a signed storage URL and a notification),
 * for exports too large to generate synchronously in the API request path.
 * Not yet wired to the store or a file/storage backend.
 */
export async function handleGenerateExport(payload: GenerateExportPayload, context: JobContext): Promise<void> {
  context.logger.info('GENERATE_EXPORT taak gestart (stub, nog geen opslagkoppeling actief).', { payload });
}
