import type { CandidateApplication } from '@merkwacht/domain';
import type { CandidateApplicationInput, SourceCheckpoint, TrademarkRegisterConnector } from '@merkwacht/register-connectors';
import { candidateApplicationInputSchema } from '@merkwacht/validation';
import type { Logger } from '@merkwacht/logging';
import { computeOppositionDeadlineForCandidate, deriveEffectiveProceduralStatus } from './deadlines.js';
import { computeSourceHash } from './idempotency.js';
import type { PipelineContext } from './types.js';

export interface IngestConnectorBatchParams {
  readonly connector: TrademarkRegisterConnector;
  /** `null`/omitted fetches from the beginning (ignoring any saved checkpoint) - used by the initial opposition scan. */
  readonly since?: SourceCheckpoint | null;
  readonly pageSize?: number;
  readonly logger: Logger;
}

export interface IngestConnectorBatchResult {
  readonly fetchedCount: number;
  readonly invalidCount: number;
  /** Candidates that were newly created or whose content actually changed this run. */
  readonly changedCandidates: readonly CandidateApplication[];
  readonly nextCheckpoint: SourceCheckpoint | null;
  readonly hasMore: boolean;
}

/**
 * Shared fetch → validate → normalize → upsert step used by both
 * `daily-sync-pipeline.ts` and `initial-opposition-scan-pipeline.ts` (steps
 * 2-6 of the daily sync). Kept register-agnostic: `connector` supplies both
 * the raw data and the `OppositionRuleSet` used to compute each candidate's
 * deadline and effective procedural status.
 *
 * A single call fetches exactly one page from the connector - callers that
 * need every page (e.g. the initial opposition scan, which deliberately
 * ignores checkpoints) should loop while `hasMore` is `true`, passing the
 * previous call's `nextCheckpoint` back in as `since`.
 */
export async function ingestConnectorBatch(
  context: PipelineContext,
  params: IngestConnectorBatchParams,
): Promise<IngestConnectorBatchResult> {
  const { connector, logger } = params;
  const fetchResult = await connector.fetchPublications({
    since: params.since ?? null,
    ...(params.pageSize !== undefined ? { pageSize: params.pageSize } : {}),
  });

  const changedCandidates: CandidateApplication[] = [];
  let invalidCount = 0;
  const fetchedAt = new Date().toISOString();

  for (const rawInput of fetchResult.applications) {
    let validatedInput: CandidateApplicationInput;
    try {
      candidateApplicationInputSchema.parse(rawInput);
      validatedInput = rawInput;
    } catch (error) {
      invalidCount += 1;
      logger.warn('Ongeldige kandidaat-aanvraag overgeslagen bij validatie.', {
        registryCode: connector.registryCode,
        applicationNumber: rawInput.applicationNumber,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    // Strip transport metadata so re-fetches of identical register content
    // produce the same hash (idempotent daily sync). `fetchedAt` is set to
    // "now" by the connector mapper and must not invalidate the content hash.
    const stablePayload = { ...rawInput };
    delete (stablePayload as { fetchedAt?: string }).fetchedAt;
    const sourceHash = computeSourceHash(stablePayload);
    const rawRecord = context.jobStore.storeRawSourceRecord({
      registryCode: connector.registryCode,
      payload: rawInput,
      fetchedAt,
      sourceHash,
    });

    // `candidateApplicationId` isn't known until after `upsertCandidateApplication`
    // assigns/resolves the stored application's id, so the deadline is
    // computed once with a placeholder and re-stamped with the real id
    // below - `startDate`/`deadlineDate` (all `deriveEffectiveProceduralStatus`
    // actually needs) don't depend on it.
    const draftDeadline = computeOppositionDeadlineForCandidate(
      {
        id: 'pending',
        registryCode: validatedInput.registryCode,
        filingDate: validatedInput.filingDate,
        publicationDate: validatedInput.publicationDate,
      },
      connector,
    );
    const effectiveStatus = deriveEffectiveProceduralStatus(validatedInput.proceduralStatus, draftDeadline, new Date());

    const upsertResult = context.jobStore.upsertCandidateApplication(
      { ...validatedInput, proceduralStatus: effectiveStatus },
      sourceHash,
      rawRecord.id,
    );

    const deadline = { ...draftDeadline, candidateApplicationId: upsertResult.record.application.id };
    context.jobStore.setOppositionDeadline(upsertResult.record.application.id, deadline);

    if (upsertResult.changed) {
      changedCandidates.push({ ...upsertResult.record.application, oppositionDeadline: deadline });
    }
  }

  return {
    fetchedCount: fetchResult.applications.length,
    invalidCount,
    changedCandidates,
    nextCheckpoint: fetchResult.nextCheckpoint,
    hasMore: fetchResult.hasMore,
  };
}
