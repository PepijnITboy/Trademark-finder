export { createSupabaseAdminClient } from './admin-client';
export type { SupabaseAdminClientOptions } from './admin-client';

export { createSupabaseAnonClient } from './anon-client';
export type { SupabaseAnonClientOptions } from './anon-client';

export {
  DEMO_BETA_IDS,
  DEMO_SECONDARY_ORG_ID,
  DEV_PLATFORM_USER_IDS,
  DEV_SEED_IDS,
  DevIdentityProvider,
  RequestScopedIdentityProvider,
  isDevPlatformUser,
} from './dev-identity';
export type { DevIdentity, IdentityProvider, TenantContext } from './dev-identity';

export {
  TENANCY_TABLE_REGISTRY,
  expandTenancyMatrix,
  expectedAccess,
} from './tenancy/registry';
export type { TenancyActor, TenancyOperation, TenancyTableSpec, TableScope } from './tenancy/registry';

export type { Database } from './types';

export { JobStore, createJobStore } from './job-store';
export type {
  AiUsageLedgerEntry,
  CandidateStatusHistoryEntry,
  FinishScanRunInput,
  JobStoreOptions,
  MatchJobQueueEntry,
  RawSourceRecord,
  RecordAiUsageInput,
  ScanRunRecord,
  ScanRunType,
  StartScanRunInput,
  StoreRawSourceRecordInput,
  StoredCandidateApplication,
  UpsertCandidateApplicationResult,
} from './job-store';
