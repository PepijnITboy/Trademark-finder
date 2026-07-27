import {
  boipV1WatchEligibilityPolicy,
  type CandidateApplication,
  type JobStatus,
  type MatchStatus,
  type OppositionDeadline,
  type TrademarkMatch,
  type TrademarkMatchScores,
  type WatchedTrademark,
  type WatchedTrademarkStatus,
} from '@merkwacht/domain';
import {
  BOIP_FIXTURE_TRADEMARK_REGISTRATIONS,
  mapBoipTrademarkToSnapshot,
  type CandidateApplicationInput,
  type SourceCheckpoint,
} from '@merkwacht/register-connectors';
import { createId } from '@merkwacht/shared';

/**
 * In-memory, worker-side persistence layer mirroring `apps/api`'s
 * `DemoStore` (see `apps/api/src/store/demo-store.ts`): always available
 * (no external dependency), used as the default so `apps/worker`'s
 * ingestion pipelines (`apps/worker/src/pipelines`) run end-to-end locally
 * without a Supabase instance. A real implementation should satisfy the
 * same shape backed by the tables described in `docs/database/schema.md`
 * (`raw_source_records`, `candidate_applications`, `trademark_matches`,
 * `opposition_deadlines`, `scan_runs`, `ai_usage_records`, etc.) - state
 * here resets on process restart, which is intentional for local dev, not
 * a bug.
 *
 * `JobStore` is deliberately organization/workspace-agnostic in its
 * candidate/register-wide data (matching the real schema's non-tenant-scoped
 * tables) but does track a `organizationId` per watched trademark, same as
 * `@merkwacht/domain`'s `WatchedTrademark`.
 */

// ---------------------------------------------------------------------
// Raw source records
// ---------------------------------------------------------------------

export interface RawSourceRecord {
  readonly id: string;
  readonly registryCode: string;
  readonly sourceHash: string;
  readonly payload: unknown;
  readonly fetchedAt: string;
  readonly storedAt: string;
}

export interface StoreRawSourceRecordInput {
  readonly registryCode: string;
  readonly payload: unknown;
  readonly fetchedAt: string;
  /** Precomputed by `apps/worker/src/pipelines/idempotency.ts`'s `computeSourceHash`. */
  readonly sourceHash: string;
}

// ---------------------------------------------------------------------
// Candidate applications
// ---------------------------------------------------------------------

export interface CandidateStatusHistoryEntry {
  readonly status: CandidateApplication['proceduralStatus'];
  readonly observedAt: string;
}

export interface StoredCandidateApplication {
  readonly application: CandidateApplication;
  readonly sourceHash: string;
  readonly rawSourceRecordId: string | null;
  readonly statusHistory: readonly CandidateStatusHistoryEntry[];
}

export interface UpsertCandidateApplicationResult {
  readonly record: StoredCandidateApplication;
  /** `true` the first time this `(registryCode, applicationNumber)` pair is seen. */
  readonly isNew: boolean;
  /**
   * `true` when the stored record actually changed as a result of this
   * call (a new record, or an existing one whose `sourceHash` differed
   * from what was already stored). `false` means the upsert was a no-op
   * dedupe hit - see `docs/operations/daily-jobs.md`'s idempotency section.
   */
  readonly changed: boolean;
  readonly proceduralStatusChanged: boolean;
}

function candidateNaturalKey(registryCode: string, applicationNumber: string): string {
  return `${registryCode}::${applicationNumber}`;
}

// ---------------------------------------------------------------------
// Match job queue (stand-in for a real broker/queue table)
// ---------------------------------------------------------------------

export interface MatchJobQueueEntry {
  readonly idempotencyKey: string;
  readonly watchedTrademarkId: string;
  readonly candidateApplicationId: string;
  readonly enqueuedAt: string;
}

// ---------------------------------------------------------------------
// Scan runs
// ---------------------------------------------------------------------

/**
 * Top-level pipeline run type. Distinct from `@merkwacht/domain`'s
 * per-stage `JobType` (`fetch_publications`, `score_matches`, ...): a
 * `ScanRunType` represents one full orchestrated pipeline invocation (see
 * `apps/worker/src/pipelines`), which internally exercises several
 * `JobType` stages.
 */
export type ScanRunType = 'DAILY_SYNC' | 'INITIAL_OPPOSITION_SCAN';

export interface ScanRunRecord {
  readonly id: string;
  readonly type: ScanRunType;
  readonly status: JobStatus;
  readonly registryCode: string | null;
  readonly triggeredBy: string;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly error: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface StartScanRunInput {
  readonly type: ScanRunType;
  readonly registryCode?: string | null;
  readonly triggeredBy?: string;
}

export interface FinishScanRunInput {
  readonly status: Extract<JobStatus, 'succeeded' | 'failed' | 'skipped'>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly error?: string | null;
}

// ---------------------------------------------------------------------
// AI usage ledger
// ---------------------------------------------------------------------

export interface AiUsageLedgerEntry {
  readonly id: string;
  /** Budget scope: a workspace/organization id, or `'global'`. */
  readonly scope: string;
  readonly occurredAt: string;
  readonly provider: string;
  readonly estimatedCostEur: number;
  readonly trademarkMatchId: string | null;
}

export interface RecordAiUsageInput {
  readonly scope: string;
  readonly provider: string;
  readonly estimatedCostEur: number;
  readonly trademarkMatchId?: string | null;
  readonly occurredAt?: string;
}

function isSameCalendarMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

// ---------------------------------------------------------------------
// Watched trademark seeding
// ---------------------------------------------------------------------

/**
 * Fictitious BOIP fixture registrations (see
 * `packages/register-connectors/src/boip/boip.fixtures.ts`) seeded as
 * active, eligible watched trademarks so `apps/worker`'s pipelines have
 * something realistic to match against locally, mirroring
 * `apps/api/src/store/demo-data.ts`. Never real register data.
 */
function buildSeedWatchedTrademarks(organizationId: string): WatchedTrademark[] {
  const now = new Date().toISOString();
  return BOIP_FIXTURE_TRADEMARK_REGISTRATIONS.map((fixture) => {
    const snapshot = mapBoipTrademarkToSnapshot(fixture);
    return {
      id: createId(),
      organizationId,
      label: snapshot.markText,
      status: 'active' as WatchedTrademarkStatus,
      eligibility: boipV1WatchEligibilityPolicy.evaluate(snapshot),
      snapshot,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export interface JobStoreOptions {
  /** Organization id to seed fixture watched trademarks under. Defaults to `@merkwacht/database`'s `DEV_SEED_IDS.organizationId`. */
  readonly seedOrganizationId?: string;
  /** Skip seeding entirely (e.g. for isolated unit tests). */
  readonly seed?: boolean;
}

/**
 * Shared, in-memory worker-side store. A single instance should be
 * constructed once per `apps/worker` process (see
 * `apps/worker/src/context.ts`) and passed into every pipeline/handler, the
 * same way `apps/api`'s `AppStore` is constructed once in `app.ts`.
 */
export class JobStore {
  private readonly checkpoints = new Map<string, SourceCheckpoint>();
  private readonly rawSourceRecords = new Map<string, RawSourceRecord>();
  private readonly candidatesById = new Map<string, StoredCandidateApplication>();
  private readonly candidateIdsByNaturalKey = new Map<string, string>();
  private readonly watchedTrademarks = new Map<string, WatchedTrademark>();
  private readonly watchedTrademarkActivatedAt = new Map<string, string>();
  private readonly matchesByPairKey = new Map<string, TrademarkMatch>();
  private readonly matchJobQueue: MatchJobQueueEntry[] = [];
  private readonly enqueuedMatchJobKeys = new Set<string>();
  private readonly scanRuns = new Map<string, ScanRunRecord>();
  private readonly aiUsageLedger: AiUsageLedgerEntry[] = [];

  constructor(options: JobStoreOptions = {}) {
    if (options.seed === false) return;
    const organizationId = options.seedOrganizationId ?? DEFAULT_SEED_ORGANIZATION_ID;
    for (const watched of buildSeedWatchedTrademarks(organizationId)) {
      this.watchedTrademarks.set(watched.id, watched);
      this.watchedTrademarkActivatedAt.set(watched.id, watched.createdAt);
    }
  }

  // -- Source checkpoints -------------------------------------------------

  getSourceCheckpoint(registryCode: string): SourceCheckpoint | null {
    return this.checkpoints.get(registryCode) ?? null;
  }

  saveSourceCheckpoint(checkpoint: SourceCheckpoint): void {
    this.checkpoints.set(checkpoint.registryCode, checkpoint);
  }

  // -- Raw source records ---------------------------------------------------

  storeRawSourceRecord(input: StoreRawSourceRecordInput): RawSourceRecord {
    const record: RawSourceRecord = {
      id: createId(),
      registryCode: input.registryCode,
      sourceHash: input.sourceHash,
      payload: input.payload,
      fetchedAt: input.fetchedAt,
      storedAt: new Date().toISOString(),
    };
    this.rawSourceRecords.set(record.id, record);
    return record;
  }

  // -- Candidate applications ----------------------------------------------

  getCandidateApplication(id: string): StoredCandidateApplication | null {
    return this.candidatesById.get(id) ?? null;
  }

  findCandidateApplicationByNaturalKey(
    registryCode: string,
    applicationNumber: string,
  ): StoredCandidateApplication | null {
    const id = this.candidateIdsByNaturalKey.get(candidateNaturalKey(registryCode, applicationNumber));
    return id ? (this.candidatesById.get(id) ?? null) : null;
  }

  listCandidateApplications(): readonly StoredCandidateApplication[] {
    return [...this.candidatesById.values()];
  }

  /**
   * Upserts a single candidate application, deduping by
   * `(registryCode, applicationNumber)` and by `sourceHash` - a re-fetch of
   * unchanged upstream data is a no-op (`changed: false`), matching
   * `docs/operations/daily-jobs.md`'s "`fetch_publications` upserts on
   * `(registry_code, application_number)`" idempotency rule.
   */
  upsertCandidateApplication(
    input: CandidateApplicationInput,
    sourceHash: string,
    rawSourceRecordId: string | null,
  ): UpsertCandidateApplicationResult {
    const key = candidateNaturalKey(input.registryCode, input.applicationNumber);
    const existingId = this.candidateIdsByNaturalKey.get(key);
    const now = new Date().toISOString();

    if (!existingId) {
      const id = createId();
      const application: CandidateApplication = { id, ...input, oppositionDeadline: input.oppositionDeadline ?? null };
      const stored: StoredCandidateApplication = {
        application,
        sourceHash,
        rawSourceRecordId,
        statusHistory: [{ status: application.proceduralStatus, observedAt: now }],
      };
      this.candidateIdsByNaturalKey.set(key, id);
      this.candidatesById.set(id, stored);
      return { record: stored, isNew: true, changed: true, proceduralStatusChanged: true };
    }

    const existing = this.candidatesById.get(existingId);
    if (!existing) {
      throw new Error(`JobStore invariant violated: natural key "${key}" points at a missing candidate record`);
    }

    if (existing.sourceHash === sourceHash) {
      return { record: existing, isNew: false, changed: false, proceduralStatusChanged: false };
    }

    const proceduralStatusChanged = existing.application.proceduralStatus !== input.proceduralStatus;
    const application: CandidateApplication = {
      ...existing.application,
      ...input,
      id: existing.application.id,
      oppositionDeadline: input.oppositionDeadline ?? existing.application.oppositionDeadline,
    };
    const statusHistory = proceduralStatusChanged
      ? [...existing.statusHistory, { status: application.proceduralStatus, observedAt: now }]
      : existing.statusHistory;

    const updated: StoredCandidateApplication = {
      application,
      sourceHash,
      rawSourceRecordId: rawSourceRecordId ?? existing.rawSourceRecordId,
      statusHistory,
    };
    this.candidatesById.set(existingId, updated);
    return { record: updated, isNew: false, changed: true, proceduralStatusChanged };
  }

  /** Persists a recalculated `OppositionDeadline` onto its candidate application. */
  setOppositionDeadline(candidateApplicationId: string, deadline: OppositionDeadline): void {
    const existing = this.candidatesById.get(candidateApplicationId);
    if (!existing) return;
    this.candidatesById.set(candidateApplicationId, {
      ...existing,
      application: { ...existing.application, oppositionDeadline: deadline },
    });
  }

  // -- Watched trademarks ---------------------------------------------------

  listWatchedTrademarks(): readonly WatchedTrademark[] {
    return [...this.watchedTrademarks.values()];
  }

  listActiveEligibleWatchedTrademarks(): readonly WatchedTrademark[] {
    return this.listWatchedTrademarks().filter((w) => w.status === 'active' && w.eligibility.eligible);
  }

  getWatchedTrademark(id: string): WatchedTrademark | null {
    return this.watchedTrademarks.get(id) ?? null;
  }

  upsertWatchedTrademark(watched: WatchedTrademark): void {
    const previous = this.watchedTrademarks.get(watched.id);
    this.watchedTrademarks.set(watched.id, watched);
    if (watched.status === 'active' && previous?.status !== 'active') {
      this.watchedTrademarkActivatedAt.set(watched.id, watched.updatedAt);
    }
  }

  /** When a watched trademark most recently transitioned into `active` - drives `INITIAL_OPPOSITION_SCAN` triggering. */
  getWatchedTrademarkActivatedAt(id: string): string | null {
    return this.watchedTrademarkActivatedAt.get(id) ?? null;
  }

  // -- Trademark matches ----------------------------------------------------

  private matchPairKey(watchedTrademarkId: string, candidateApplicationId: string): string {
    return `${watchedTrademarkId}::${candidateApplicationId}`;
  }

  getTrademarkMatch(watchedTrademarkId: string, candidateApplicationId: string): TrademarkMatch | null {
    return this.matchesByPairKey.get(this.matchPairKey(watchedTrademarkId, candidateApplicationId)) ?? null;
  }

  getTrademarkMatchById(id: string): TrademarkMatch | null {
    for (const match of this.matchesByPairKey.values()) {
      if (match.id === id) return match;
    }
    return null;
  }

  listTrademarkMatches(): readonly TrademarkMatch[] {
    return [...this.matchesByPairKey.values()];
  }

  /**
   * Upserts a scored match, deduped by `(watchedTrademarkId,
   * candidateApplicationId)` per `docs/database/schema.md`'s unique
   * constraint. Preserves an existing match's workflow `status`/reviewer
   * fields across a re-score unless `status` is explicitly overridden -
   * a re-run of `score_matches` must never silently reset a customer's
   * review decision.
   */
  upsertTrademarkMatch(input: {
    watchedTrademarkId: string;
    candidateApplicationId: string;
    scores: TrademarkMatchScores;
    totalScore: number;
    weightProfileId: string;
    status?: MatchStatus;
  }): { record: TrademarkMatch; isNew: boolean } {
    const key = this.matchPairKey(input.watchedTrademarkId, input.candidateApplicationId);
    const existing = this.matchesByPairKey.get(key);
    const now = new Date().toISOString();

    if (!existing) {
      const record: TrademarkMatch = {
        id: createId(),
        watchedTrademarkId: input.watchedTrademarkId,
        candidateApplicationId: input.candidateApplicationId,
        status: input.status ?? 'new',
        scores: input.scores,
        totalScore: input.totalScore,
        weightProfileId: input.weightProfileId,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      this.matchesByPairKey.set(key, record);
      return { record, isNew: true };
    }

    const record: TrademarkMatch = {
      ...existing,
      scores: input.scores,
      totalScore: input.totalScore,
      weightProfileId: input.weightProfileId,
      status: input.status ?? existing.status,
      updatedAt: now,
    };
    this.matchesByPairKey.set(key, record);
    return { record, isNew: false };
  }

  setTrademarkMatchStatus(id: string, status: MatchStatus): TrademarkMatch | null {
    for (const [key, match] of this.matchesByPairKey) {
      if (match.id !== id) continue;
      const updated: TrademarkMatch = { ...match, status, updatedAt: new Date().toISOString() };
      this.matchesByPairKey.set(key, updated);
      return updated;
    }
    return null;
  }

  /**
   * Moves every open match whose candidate's opposition deadline has
   * passed into `opposition_deadline_passed`, skipping matches already in
   * a terminal state (`dismissed`, `opposition_filed`,
   * `opposition_deadline_passed`). Returns the matches that were
   * transitioned by this call.
   */
  archiveExpiredMatches(nowIso: string = new Date().toISOString()): readonly TrademarkMatch[] {
    const now = new Date(nowIso).getTime();
    const terminalStatuses: readonly MatchStatus[] = [
      'dismissed',
      'opposition_filed',
      'opposition_deadline_passed',
    ];
    const archived: TrademarkMatch[] = [];

    for (const [key, match] of this.matchesByPairKey) {
      if (terminalStatuses.includes(match.status)) continue;
      const candidate = this.candidatesById.get(match.candidateApplicationId);
      const deadline = candidate?.application.oppositionDeadline;
      if (!deadline) continue;
      if (new Date(deadline.deadlineDate).getTime() >= now) continue;

      const updated: TrademarkMatch = {
        ...match,
        status: 'opposition_deadline_passed',
        updatedAt: nowIso,
      };
      this.matchesByPairKey.set(key, updated);
      archived.push(updated);
    }

    return archived;
  }

  // -- Match job queue --------------------------------------------------

  /** Returns `true` if the job was newly enqueued, `false` if `idempotencyKey` was already queued/processed this run. */
  enqueueMatchJob(watchedTrademarkId: string, candidateApplicationId: string, idempotencyKey: string): boolean {
    if (this.enqueuedMatchJobKeys.has(idempotencyKey)) return false;
    this.enqueuedMatchJobKeys.add(idempotencyKey);
    this.matchJobQueue.push({
      idempotencyKey,
      watchedTrademarkId,
      candidateApplicationId,
      enqueuedAt: new Date().toISOString(),
    });
    return true;
  }

  /** Drains (removes and returns) every currently queued match job. */
  drainMatchJobQueue(): readonly MatchJobQueueEntry[] {
    return this.matchJobQueue.splice(0, this.matchJobQueue.length);
  }

  get matchJobQueueSize(): number {
    return this.matchJobQueue.length;
  }

  // -- Scan runs ----------------------------------------------------------

  startScanRun(input: StartScanRunInput): ScanRunRecord {
    const record: ScanRunRecord = {
      id: createId(),
      type: input.type,
      status: 'running',
      registryCode: input.registryCode ?? null,
      triggeredBy: input.triggeredBy ?? 'schedule',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      metadata: {},
    };
    this.scanRuns.set(record.id, record);
    return record;
  }

  finishScanRun(id: string, input: FinishScanRunInput): ScanRunRecord | null {
    const existing = this.scanRuns.get(id);
    if (!existing) return null;
    const updated: ScanRunRecord = {
      ...existing,
      status: input.status,
      finishedAt: new Date().toISOString(),
      error: input.error ?? null,
      metadata: input.metadata ?? existing.metadata,
    };
    this.scanRuns.set(id, updated);
    return updated;
  }

  getScanRun(id: string): ScanRunRecord | null {
    return this.scanRuns.get(id) ?? null;
  }

  listScanRuns(): readonly ScanRunRecord[] {
    return [...this.scanRuns.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  // -- AI usage ledger ------------------------------------------------------

  recordAiUsage(input: RecordAiUsageInput): AiUsageLedgerEntry {
    const entry: AiUsageLedgerEntry = {
      id: createId(),
      scope: input.scope,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      provider: input.provider,
      estimatedCostEur: input.estimatedCostEur,
      trademarkMatchId: input.trademarkMatchId ?? null,
    };
    this.aiUsageLedger.push(entry);
    return entry;
  }

  /** Sums `estimatedCostEur` for `scope` within the same calendar month/year as `referenceDate` (defaults to now). */
  getMonthlyUsageEur(scope: string, referenceDate: Date = new Date()): number {
    return this.aiUsageLedger
      .filter((entry) => entry.scope === scope && isSameCalendarMonth(new Date(entry.occurredAt), referenceDate))
      .reduce((sum, entry) => sum + entry.estimatedCostEur, 0);
  }

  listAiUsage(): readonly AiUsageLedgerEntry[] {
    return [...this.aiUsageLedger];
  }
}

/**
 * Mirrors `DEV_SEED_IDS.organizationId` from `dev-identity.ts` without a
 * hard import cycle risk - kept as a literal constant here since
 * `job-store.ts` must remain usable even before `DevIdentityProvider` is
 * wired into a given process.
 */
const DEFAULT_SEED_ORGANIZATION_ID = '00000000-0000-4000-8000-000000000001';

/** Convenience factory, mirroring `apps/api/src/store/demo-store.ts`'s `createDemoStore`. */
export function createJobStore(options?: JobStoreOptions): JobStore {
  return new JobStore(options);
}
