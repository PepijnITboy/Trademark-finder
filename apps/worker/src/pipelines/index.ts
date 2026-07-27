export type { PipelineContext } from './types.js';
export { getConnector } from './types.js';

export {
  buildCandidateIdempotencyKey,
  buildMatchJobIdempotencyKey,
  buildScanRunIdempotencyKey,
  computeSourceHash,
} from './idempotency.js';

export {
  computeOppositionDeadlineForCandidate,
  deriveEffectiveProceduralStatus,
  refreshMissingOppositionDeadlines,
} from './deadlines.js';

export { ingestConnectorBatch } from './ingest-candidates.js';
export type { IngestConnectorBatchParams, IngestConnectorBatchResult } from './ingest-candidates.js';

export { isWithinOppositionWindow, listOpenOppositionCandidates } from './opposition-candidates.js';

export {
  MATCH_CREATION_MIN_TOTAL_SCORE,
  runQueuedMatchJobs,
  scoreAndUpsertMatch,
} from './match-and-score.js';
export type { RunMatchJobsSummary, ScoreAndUpsertResult } from './match-and-score.js';

export { runDailySyncPipeline } from './daily-sync-pipeline.js';
export type { DailySyncPipelineOptions } from './daily-sync-pipeline.js';

export { runInitialOppositionScanPipeline } from './initial-opposition-scan-pipeline.js';
export type { InitialOppositionScanOptions } from './initial-opposition-scan-pipeline.js';
