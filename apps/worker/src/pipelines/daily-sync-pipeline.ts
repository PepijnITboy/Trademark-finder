import type { ScanRunRecord } from '@merkwacht/database';
import type { SourceCheckpoint } from '@merkwacht/register-connectors';
import { refreshMissingOppositionDeadlines } from './deadlines.js';
import { buildMatchJobIdempotencyKey } from './idempotency.js';
import { ingestConnectorBatch } from './ingest-candidates.js';
import { runQueuedMatchJobs } from './match-and-score.js';
import { getConnector, type PipelineContext } from './types.js';

export interface DailySyncPipelineOptions {
  readonly registryCode: string;
  readonly triggeredBy?: string;
  readonly pageSize?: number;
  /** Safety cap on fetch pages per run, in case a connector's `hasMore` never settles. */
  readonly maxPages?: number;
}

const DEFAULT_MAX_PAGES = 50;

/**
 * The full daily ingestion pipeline for a single register connector,
 * matching `docs/operations/daily-jobs.md`'s `fetch_publications` →
 * `match_candidates` → `score_matches` → `calculate_opposition_deadlines`
 * sequence end-to-end for one connector:
 *
 * 1. load the last `SourceCheckpoint`
 * 2. fetch changes from the connector (paging until `hasMore` is `false`)
 * 3. store raw source records
 * 4. validate + normalize each fetched application
 * 5. upsert candidates, deduped by `(registryCode, applicationNumber)` and content hash
 * 6. derive each candidate's effective procedural status
 * 7. enqueue match jobs for every active, eligible watched trademark in this register
 * 8. refresh opposition deadlines for any candidate still missing one
 * 9. archive matches whose opposition deadline has passed
 * 10. write the `scan_run` result
 *
 * Steps 3-6 are shared with `initial-opposition-scan-pipeline.ts` via
 * {@link ingestConnectorBatch}. Never throws: failures are caught and
 * recorded onto the `scan_run` as `failed` so one register's problem never
 * takes down the caller (see `docs/operations/daily-jobs.md`'s failure
 * policy - partial pipeline degradation is preferred).
 */
export async function runDailySyncPipeline(
  context: PipelineContext,
  options: DailySyncPipelineOptions,
): Promise<ScanRunRecord> {
  const connector = getConnector(context, options.registryCode);
  const logger = context.logger.child({ pipeline: 'daily-sync', registryCode: options.registryCode });
  const triggeredBy = options.triggeredBy ?? 'schedule';
  const scanRun = context.jobStore.startScanRun({
    type: 'DAILY_SYNC',
    registryCode: options.registryCode,
    triggeredBy,
  });

  try {
    // -- 1. load last checkpoint -----------------------------------------
    let checkpoint: SourceCheckpoint | null = context.jobStore.getSourceCheckpoint(options.registryCode);
    const initialCheckpoint = checkpoint;

    // -- 2-6. fetch + store + validate + normalize + upsert + derive status --
    let fetchedCount = 0;
    let invalidCount = 0;
    let changedCount = 0;
    const changedCandidateIds = new Set<string>();
    let hasMore = true;
    let pages = 0;
    const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

    while (hasMore && pages < maxPages) {
      const batch = await ingestConnectorBatch(context, {
        connector,
        since: checkpoint,
        logger,
        ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
      });
      fetchedCount += batch.fetchedCount;
      invalidCount += batch.invalidCount;
      changedCount += batch.changedCandidates.length;
      for (const candidate of batch.changedCandidates) {
        changedCandidateIds.add(candidate.id);
      }

      if (batch.nextCheckpoint) {
        checkpoint = batch.nextCheckpoint;
        context.jobStore.saveSourceCheckpoint(batch.nextCheckpoint);
      }
      hasMore = batch.hasMore;
      pages += 1;
    }

    // -- 7. enqueue match jobs -------------------------------------------
    const watchedTrademarks = context.jobStore
      .listActiveEligibleWatchedTrademarks()
      .filter((watched) => watched.snapshot.registryCode === options.registryCode);

    let enqueuedCount = 0;
    for (const candidateId of changedCandidateIds) {
      const stored = context.jobStore.getCandidateApplication(candidateId);
      if (!stored) continue;
      for (const watched of watchedTrademarks) {
        const idempotencyKey = buildMatchJobIdempotencyKey(watched.id, candidateId, stored.sourceHash);
        if (context.jobStore.enqueueMatchJob(watched.id, candidateId, idempotencyKey)) {
          enqueuedCount += 1;
        }
      }
    }

    const matchJobsSummary = await runQueuedMatchJobs(context);

    // -- 8. refresh deadlines for candidates still missing one ------------
    const deadlinesRefreshed = refreshMissingOppositionDeadlines(context.jobStore, options.registryCode, connector);

    // -- 9. archive expired matches -----------------------------------------
    const archived = context.jobStore.archiveExpiredMatches();

    // -- 10. write scan_run result -------------------------------------------
    const finished = context.jobStore.finishScanRun(scanRun.id, {
      status: 'succeeded',
      metadata: {
        fetchedCount,
        invalidCount,
        changedCount,
        enqueuedMatchJobs: enqueuedCount,
        matchJobsProcessed: matchJobsSummary.processed,
        matchesCreated: matchJobsSummary.matchesCreated,
        matchesUpdated: matchJobsSummary.matchesUpdated,
        deadlinesRefreshed,
        archivedMatches: archived.length,
        resumedFromCheckpoint: initialCheckpoint !== null,
        pagesFetched: pages,
      },
    });

    logger.info('Dagelijkse synchronisatie voltooid.', { scanRunId: scanRun.id, ...finished?.metadata });
    return finished ?? scanRun;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Dagelijkse synchronisatie mislukt.', { scanRunId: scanRun.id, error: message });
    return (
      context.jobStore.finishScanRun(scanRun.id, { status: 'failed', error: message }) ?? scanRun
    );
  }
}
