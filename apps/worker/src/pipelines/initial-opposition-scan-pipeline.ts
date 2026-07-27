import type { ScanRunRecord } from '@merkwacht/database';
import type { SourceCheckpoint } from '@merkwacht/register-connectors';
import { refreshMissingOppositionDeadlines } from './deadlines.js';
import { buildMatchJobIdempotencyKey } from './idempotency.js';
import { ingestConnectorBatch } from './ingest-candidates.js';
import { runQueuedMatchJobs } from './match-and-score.js';
import { listOpenOppositionCandidates } from './opposition-candidates.js';
import { getConnector, type PipelineContext } from './types.js';

export interface InitialOppositionScanOptions {
  readonly watchedTrademarkId: string;
  readonly triggeredBy?: string;
  readonly pageSize?: number;
  readonly maxPages?: number;
}

const DEFAULT_MAX_PAGES = 50;

/**
 * Runs once, right after a `WatchedTrademark` becomes `active` and
 * eligible: rather than a blind "look back N days" scan, it uses
 * `@merkwacht/opposition-rules` to find every candidate application in the
 * watched trademark's register whose opposition window is *currently
 * open* — regardless of how long ago it was published — and matches only
 * those against this one newly-activated watch. This guarantees no
 * pre-existing, still-opposable filing is missed just because it predates
 * the watch, without re-scoring the register's entire history against
 * every other watch.
 *
 * Steps:
 * 1. resolve the watched trademark and its connector
 * 2. ingest the connector's full publication history (ignoring any saved
 *    `daily-sync` checkpoint - a fresh, independent full pull), sharing
 *    step 3-6 of the daily sync via {@link ingestConnectorBatch}
 * 3. compute `fetchOppositionCandidates`: every stored candidate in this
 *    register whose opposition window is open right now
 * 4. enqueue + run match jobs against only this watched trademark
 * 5. refresh any still-missing opposition deadlines
 * 6. write an `INITIAL_OPPOSITION_SCAN` scan_run result
 */
export async function runInitialOppositionScanPipeline(
  context: PipelineContext,
  options: InitialOppositionScanOptions,
): Promise<ScanRunRecord> {
  const watched = context.jobStore.getWatchedTrademark(options.watchedTrademarkId);
  const registryCode = watched?.snapshot.registryCode ?? null;
  const triggeredBy = options.triggeredBy ?? 'watch_activated';
  const scanRun = context.jobStore.startScanRun({
    type: 'INITIAL_OPPOSITION_SCAN',
    registryCode,
    triggeredBy,
  });
  const logger = context.logger.child({
    pipeline: 'initial-opposition-scan',
    watchedTrademarkId: options.watchedTrademarkId,
  });

  if (!watched) {
    logger.warn('Initiële oppositiescan overgeslagen: bewaakt merk niet gevonden.');
    return (
      context.jobStore.finishScanRun(scanRun.id, {
        status: 'skipped',
        error: 'watched trademark not found',
      }) ?? scanRun
    );
  }
  if (watched.status !== 'active' || !watched.eligibility.eligible) {
    logger.info('Initiële oppositiescan overgeslagen: bewaakt merk is niet actief/gerechtigd.', {
      status: watched.status,
      eligible: watched.eligibility.eligible,
    });
    return (
      context.jobStore.finishScanRun(scanRun.id, {
        status: 'skipped',
        error: null,
        metadata: { reason: 'not active or not eligible' },
      }) ?? scanRun
    );
  }

  try {
    const connector = getConnector(context, watched.snapshot.registryCode);

    // -- 2. full ingest, independent of the daily-sync checkpoint ---------
    let fetchedCount = 0;
    let invalidCount = 0;
    let cursor: SourceCheckpoint | null = null;
    let hasMore = true;
    let pages = 0;
    const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

    while (hasMore && pages < maxPages) {
      const batch = await ingestConnectorBatch(context, {
        connector,
        since: cursor,
        logger,
        ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
      });
      fetchedCount += batch.fetchedCount;
      invalidCount += batch.invalidCount;
      cursor = batch.nextCheckpoint;
      hasMore = batch.hasMore;
      pages += 1;
    }

    // -- 3. fetchOppositionCandidates: rule-derived, not a lookback window --
    const openCandidates = listOpenOppositionCandidates(context.jobStore, watched.snapshot.registryCode);

    // -- 4. enqueue + run match jobs against only this watched trademark ---
    let enqueuedCount = 0;
    for (const candidate of openCandidates) {
      const stored = context.jobStore.getCandidateApplication(candidate.id);
      if (!stored) continue;
      const idempotencyKey = buildMatchJobIdempotencyKey(watched.id, candidate.id, stored.sourceHash);
      if (context.jobStore.enqueueMatchJob(watched.id, candidate.id, idempotencyKey)) {
        enqueuedCount += 1;
      }
    }
    const matchJobsSummary = await runQueuedMatchJobs(context);

    // -- 5. refresh any still-missing deadlines ----------------------------
    const deadlinesRefreshed = refreshMissingOppositionDeadlines(
      context.jobStore,
      watched.snapshot.registryCode,
      connector,
    );

    // -- 6. write scan_run result -------------------------------------------
    const finished = context.jobStore.finishScanRun(scanRun.id, {
      status: 'succeeded',
      metadata: {
        fetchedCount,
        invalidCount,
        openOppositionCandidates: openCandidates.length,
        enqueuedMatchJobs: enqueuedCount,
        matchJobsProcessed: matchJobsSummary.processed,
        matchesCreated: matchJobsSummary.matchesCreated,
        matchesUpdated: matchJobsSummary.matchesUpdated,
        deadlinesRefreshed,
        pagesFetched: pages,
      },
    });

    logger.info('Initiële oppositiescan voltooid.', { scanRunId: scanRun.id, ...finished?.metadata });
    return finished ?? scanRun;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Initiële oppositiescan mislukt.', { scanRunId: scanRun.id, error: message });
    return (
      context.jobStore.finishScanRun(scanRun.id, { status: 'failed', error: message }) ?? scanRun
    );
  }
}
