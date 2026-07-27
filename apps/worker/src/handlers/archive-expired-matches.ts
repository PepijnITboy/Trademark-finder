import type { JobContext } from './register-sync.js';

export interface ArchiveExpiredMatchesPayload {
  readonly organizationId?: string;
}

/**
 * ARCHIVE_EXPIRED_MATCHES: moves every open match whose candidate's
 * opposition deadline has passed into `opposition_deadline_passed` via
 * `JobStore.archiveExpiredMatches`, optionally scoped to one
 * organization's watched trademarks. In normal operation the ingestion
 * pipelines already call this inline (step 9 of the daily sync); this
 * handler exists for the standalone on-demand case.
 */
export async function handleArchiveExpiredMatches(
  payload: ArchiveExpiredMatchesPayload,
  context: JobContext,
): Promise<void> {
  const archived = context.jobStore.archiveExpiredMatches();
  const scoped = payload.organizationId
    ? archived.filter(
        (match) => context.jobStore.getWatchedTrademark(match.watchedTrademarkId)?.organizationId === payload.organizationId,
      )
    : archived;

  context.logger.info('ARCHIVE_EXPIRED_MATCHES taak afgerond.', {
    organizationId: payload.organizationId ?? null,
    archivedCount: scoped.length,
  });
}
