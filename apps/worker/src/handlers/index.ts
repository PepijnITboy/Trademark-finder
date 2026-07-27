import { handleAiAssessMatch, type AiAssessMatchPayload } from './ai-assess-match';
import { handleArchiveExpiredMatches, type ArchiveExpiredMatchesPayload } from './archive-expired-matches';
import { handleGenerateExport, type GenerateExportPayload } from './generate-export';
import { handleInitialOppositionScan, type InitialOppositionScanPayload } from './initial-opposition-scan';
import { handleMatchCandidateBatch, type MatchCandidateBatchPayload } from './match-candidate-batch';
import { handleRefreshDeadlines, type RefreshDeadlinesPayload } from './refresh-deadlines';
import { handleRegisterSync, type JobContext, type RegisterSyncPayload } from './register-sync';
import { handleScoreMatch, type ScoreMatchPayload } from './score-match';

export const JOB_HANDLERS = {
  REGISTER_SYNC: handleRegisterSync,
  INITIAL_OPPOSITION_SCAN: handleInitialOppositionScan,
  MATCH_CANDIDATE_BATCH: handleMatchCandidateBatch,
  SCORE_MATCH: handleScoreMatch,
  REFRESH_DEADLINES: handleRefreshDeadlines,
  AI_ASSESS_MATCH: handleAiAssessMatch,
  ARCHIVE_EXPIRED_MATCHES: handleArchiveExpiredMatches,
  GENERATE_EXPORT: handleGenerateExport,
} as const;

export type JobType = keyof typeof JOB_HANDLERS;

export type {
  AiAssessMatchPayload,
  ArchiveExpiredMatchesPayload,
  GenerateExportPayload,
  InitialOppositionScanPayload,
  JobContext,
  MatchCandidateBatchPayload,
  RefreshDeadlinesPayload,
  RegisterSyncPayload,
  ScoreMatchPayload,
};
