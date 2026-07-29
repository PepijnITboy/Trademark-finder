import {
  deriveImportDayStatuses,
  makeFunnelStage,
  type JobStatus,
  type JobType,
  type PipelineFunnelSnapshot,
  type PipelineRunKind,
  type ProcessingJob,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from '@merkwacht/domain';
import { createId } from '@merkwacht/shared';
import { DEMO_SECONDARY_ORG_ID } from '../org/org-store.js';

/**
 * In-memory store backing `/api/platform/*` (see `routes/platform.ts`),
 * mirroring `apps/api/src/store/demo-store.ts`'s approach: no external
 * dependency, always available, state resets on process restart. A real
 * implementation should be backed by the tables described in
 * `docs/database/schema.md` (`subscription`) and
 * `supabase/migrations/20260727121300_platform.sql`
 * (`platform_feature_flags`). Distinct from `AppStore`: `AppStore` is the
 * customer-facing surface, `PlatformStore` is the internal operator-only
 * surface - see `docs/security/security-model.md`'s `/app` vs `/platform`
 * boundary.
 */

export interface PlatformCustomerRecord {
  readonly id: string;
  readonly name: string;
  readonly plan: SubscriptionPlan;
  readonly status: SubscriptionStatus;
  readonly renewsAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UpdateCustomerSubscriptionInput {
  readonly plan?: SubscriptionPlan | undefined;
  readonly status?: SubscriptionStatus | undefined;
}

export interface PlatformAiUsageEntry {
  readonly id: string;
  readonly customerId: string;
  readonly occurredAt: string;
  readonly provider: string;
  readonly estimatedCostEur: number;
}

export interface PlatformAuditLogEntry {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorUserId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface RecordAuditLogInput {
  readonly actorUserId: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface PlatformFeatureFlagRecord {
  readonly key: string;
  readonly description: string;
  readonly isEnabled: boolean;
  /** 0-100. See `public.platform_feature_flags.rollout_percentage`. */
  readonly rolloutPercentage: number;
  readonly updatedAt: string;
}

export interface UpdateFeatureFlagInput {
  readonly isEnabled?: boolean | undefined;
  readonly rolloutPercentage?: number | undefined;
}

/**
 * Mirrors `docs/database/schema.md`'s `processing_job` table. Distinct from
 * `apps/worker`'s `JOB_HANDLERS` dispatch keys (`REGISTER_SYNC`, ...),
 * which name a worker-internal handler rather than the domain-level
 * `JobType` this audit trail uses.
 */
export interface PlatformJobRecord extends ProcessingJob {
  readonly triggeredBy: string;
}

export interface PlatformImportSyncRecord {
  readonly registryCode: string;
  readonly displayNameNl: string;
  readonly purpose: 'watch' | 'name_research';
  readonly lastSyncAt: string | null;
  readonly lastStatus: 'succeeded' | 'failed' | 'never';
  readonly lastFetchedCount: number | null;
  readonly affectedOrganizationIds: readonly string[];
  readonly yesterdayStatus: 'ok' | 'fail' | 'pending' | 'never';
  readonly todayStatus: 'ok' | 'fail' | 'pending' | 'never';
  readonly cadenceNl: string;
}

export interface PlatformPipelineRunRecord {
  readonly id: string;
  readonly runKind: PipelineRunKind;
  readonly registryCode: string | null;
  readonly status: JobStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly error: string | null;
  readonly funnel: PipelineFunnelSnapshot;
  readonly startVolume: number;
  readonly endMatches: number;
}

export interface TriggerJobInput {
  readonly type: JobType;
  readonly registryCode?: string | null;
  readonly triggeredBy: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Seed data is deliberately small and clearly fictitious (LUMARO-style
 * naming, matching `apps/api/src/store/demo-data.ts`) - never real
 * customer data.
 */
export class PlatformStore {
  private readonly customers = new Map<string, PlatformCustomerRecord>();
  private readonly aiUsage: PlatformAiUsageEntry[] = [];
  private readonly auditLog: PlatformAuditLogEntry[] = [];
  private readonly featureFlags = new Map<string, PlatformFeatureFlagRecord>();
  private readonly jobs = new Map<string, PlatformJobRecord>();
  private readonly importSyncs: PlatformImportSyncRecord[] = [];
  private readonly pipelineRuns: PlatformPipelineRunRecord[] = [];

  constructor(primaryCustomerId: string) {
    this.seedCustomers(primaryCustomerId);
    this.seedFeatureFlags();
    this.seedAiUsage(primaryCustomerId);
    this.seedJobs();
    this.seedImportSyncs(primaryCustomerId);
    this.seedPipelineRuns();
  }

  private seedCustomers(primaryCustomerId: string): void {
    const now = nowIso();
    const seed: PlatformCustomerRecord[] = [
      {
        id: primaryCustomerId,
        name: 'Lumaro B.V.',
        plan: 'starter',
        status: 'active',
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: DEMO_SECONDARY_ORG_ID,
        name: 'Fictieve Retail Groep B.V.',
        plan: 'pro',
        status: 'trialing',
        renewsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createId(),
        name: 'Voorbeeld Merkengemachtigden & Partners',
        plan: 'enterprise',
        status: 'past_due',
        renewsAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ];
    for (const customer of seed) this.customers.set(customer.id, customer);
  }

  private seedImportSyncs(primaryCustomerId: string): void {
    const now = Date.now();
    const rows: Omit<PlatformImportSyncRecord, 'yesterdayStatus' | 'todayStatus' | 'cadenceNl'>[] = [
      {
        registryCode: 'BOIP',
        displayNameNl: 'Benelux (BOIP)',
        purpose: 'watch',
        lastSyncAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        lastStatus: 'succeeded',
        lastFetchedCount: 128,
        affectedOrganizationIds: [primaryCustomerId, DEMO_SECONDARY_ORG_ID],
      },
      {
        registryCode: 'BOIP',
        displayNameNl: 'Benelux (BOIP)',
        purpose: 'name_research',
        lastSyncAt: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
        lastStatus: 'succeeded',
        lastFetchedCount: 42,
        affectedOrganizationIds: [primaryCustomerId],
      },
      {
        registryCode: 'EUIPO',
        displayNameNl: 'EUIPO',
        purpose: 'watch',
        lastSyncAt: null,
        lastStatus: 'never',
        lastFetchedCount: null,
        affectedOrganizationIds: [],
      },
      {
        registryCode: 'EUIPO',
        displayNameNl: 'EUIPO',
        purpose: 'name_research',
        lastSyncAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
        lastStatus: 'failed',
        lastFetchedCount: null,
        affectedOrganizationIds: [DEMO_SECONDARY_ORG_ID],
      },
    ];
    for (const row of rows) this.importSyncs.push(this.withDayStatuses(row));
  }

  private withDayStatuses(
    row: Omit<PlatformImportSyncRecord, 'yesterdayStatus' | 'todayStatus' | 'cadenceNl'>,
  ): PlatformImportSyncRecord {
    const days = deriveImportDayStatuses(row);
    return {
      ...row,
      ...days,
      cadenceNl: row.purpose === 'watch' ? 'Dagelijks' : 'Op aanvraag',
    };
  }

  private seedFeatureFlags(): void {
    const now = nowIso();
    const seed: PlatformFeatureFlagRecord[] = [
      {
        key: 'ai_enrichment_beta',
        description: 'Schakelt de AI-plausibiliteitslaag in voor scoring (zie docs/scoring/ai-layer.md).',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
      {
        key: 'multi_register_watch_preview',
        description: 'Preview van bewaking over meerdere registers (EUIPO/WIPO) - nog niet productierijp.',
        isEnabled: false,
        rolloutPercentage: 0,
        updatedAt: now,
      },
      {
        key: 'related_class_suggestions',
        description: '@merkwacht/classification gerelateerde Nice-klasse suggesties tonen bij het aanmaken van een watch.',
        isEnabled: false,
        rolloutPercentage: 0,
        updatedAt: now,
      },
      {
        key: 'shared_comparison_engine',
        description: 'Gedeelde feature/comparison-engine voor monitoring en merkonderzoek.',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
      {
        key: 'comparison_shadow_mode',
        description: 'Schrijft feature-vector + rules-risk naast legacy totalScore.',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
      {
        key: 'new_normalization_engine',
        description: 'Normalisatie v2 met tokenclassificatie (normalizeMarkNameV2).',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
      {
        key: 'multilingual_phonetics',
        description: 'Fonetiek-ensemble nl/en/de/fr/es/it.',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
      {
        key: 'weighted_edit_distance',
        description: 'Weighted edit distance in feature-extractie.',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
      {
        key: 'goods_services_engine',
        description: 'Goods/services overlap uit vrije tekst + Nice fallback.',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
      {
        key: 'new_name_research_engine',
        description: 'Merkonderzoek via shared comparison engine i.p.v. clearanceRiskScore.',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
      {
        key: 'ai_explanation_engine',
        description: 'AI verdict/uitleg i.p.v. vrije adjustment-score.',
        isEnabled: false,
        rolloutPercentage: 0,
        updatedAt: now,
      },
      {
        key: 'new_monitoring_retrieval',
        description: 'Multi-channel candidate retrieval (union).',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
      {
        key: 'pipeline_funnel_kpi',
        description: 'Platform funnel KPI’s per scan/export-run.',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
      {
        key: 'manual_weight_fallback',
        description: 'Handmatige weight-profiles alleen als noodfallback (niet primair).',
        isEnabled: true,
        rolloutPercentage: 100,
        updatedAt: now,
      },
    ];
    for (const flag of seed) this.featureFlags.set(flag.key, flag);
  }

  private seedAiUsage(primaryCustomerId: string): void {
    const now = Date.now();
    const entries: PlatformAiUsageEntry[] = [
      {
        id: createId(),
        customerId: primaryCustomerId,
        occurredAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        provider: 'openai',
        estimatedCostEur: 0.42,
      },
      {
        id: createId(),
        customerId: primaryCustomerId,
        occurredAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
        provider: 'openai',
        estimatedCostEur: 0.18,
      },
    ];
    this.aiUsage.push(...entries);
  }

  private seedJobs(): void {
    const startedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const finishedAt = new Date(Date.now() - 59 * 60 * 1000).toISOString();
    const seed: PlatformJobRecord[] = [
      {
        id: createId(),
        type: 'fetch_publications',
        status: 'succeeded',
        registryCode: 'BOIP',
        attempt: 1,
        startedAt,
        finishedAt,
        error: null,
        metadata: { fetchedCount: 5 },
        triggeredBy: 'schedule',
      },
      {
        id: createId(),
        type: 'send_notifications',
        status: 'failed',
        registryCode: null,
        attempt: 3,
        startedAt,
        finishedAt,
        error: 'SMTP-verbinding time-out.',
        metadata: {},
        triggeredBy: 'schedule',
      },
    ];
    for (const job of seed) this.jobs.set(job.id, job);
  }

  private seedPipelineRuns(): void {
    const startedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const finishedAt = new Date(Date.now() - 2 * 60 * 60 * 1000 + 45_000).toISOString();
    const stages = [
      makeFunnelStage({ code: 'fetched', entered: 60_000, passed: 58_800, reasonCodes: { invalid_payload: 1_200 } }),
      makeFunnelStage({ code: 'validated', entered: 60_000, passed: 58_800 }),
      makeFunnelStage({
        code: 'changed',
        entered: 58_800,
        passed: 18_800,
        reasonCodes: { unchanged: 40_000 },
      }),
      makeFunnelStage({
        code: 'opposition_window',
        entered: 18_800,
        passed: 15_700,
        reasonCodes: { out_of_window: 3_100 },
      }),
      makeFunnelStage({ code: 'feature_scored', entered: 120_000, passed: 120_000 }),
      makeFunnelStage({
        code: 'above_persist_threshold',
        entered: 120_000,
        passed: 2_400,
        reasonCodes: { below_threshold: 117_600 },
      }),
      makeFunnelStage({ code: 'match_upserted', entered: 2_400, passed: 2_400 }),
    ];
    this.pipelineRuns.push({
      id: createId(),
      runKind: 'register_sync',
      registryCode: 'BOIP',
      status: 'succeeded',
      startedAt,
      finishedAt,
      error: null,
      startVolume: 60_000,
      endMatches: 2_400,
      funnel: {
        version: 'funnel-v1',
        runKind: 'register_sync',
        registryCode: 'BOIP',
        startedAt,
        finishedAt,
        stages,
      },
    });
    this.pipelineRuns.push({
      id: createId(),
      runKind: 'generate_export',
      registryCode: null,
      status: 'failed',
      startedAt,
      finishedAt,
      error: 'Exportopslag nog niet gekoppeld',
      startVolume: 240,
      endMatches: 0,
      funnel: {
        version: 'funnel-v1',
        runKind: 'generate_export',
        startedAt,
        finishedAt,
        stuckStage: 'export_stored',
        lastError: 'Exportopslag nog niet gekoppeld',
        stages: [
          makeFunnelStage({ code: 'export_built', entered: 240, passed: 240 }),
          makeFunnelStage({
            code: 'export_stored',
            entered: 240,
            passed: 0,
            reasonCodes: { storage_unwired: 240 },
          }),
          makeFunnelStage({ code: 'failed', entered: 1, passed: 0 }),
        ],
      },
    });
  }

  // -- Customers / subscriptions -----------------------------------------

  listCustomers(): readonly PlatformCustomerRecord[] {
    return [...this.customers.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  getCustomer(id: string): PlatformCustomerRecord | null {
    return this.customers.get(id) ?? null;
  }

  updateCustomerSubscription(id: string, patch: UpdateCustomerSubscriptionInput): PlatformCustomerRecord | null {
    const existing = this.customers.get(id);
    if (!existing) return null;
    const updated: PlatformCustomerRecord = {
      ...existing,
      plan: patch.plan ?? existing.plan,
      status: patch.status ?? existing.status,
      updatedAt: nowIso(),
    };
    this.customers.set(id, updated);
    return updated;
  }

  // -- AI usage -------------------------------------------------------------

  listAiUsage(customerId?: string): readonly PlatformAiUsageEntry[] {
    const entries = customerId ? this.aiUsage.filter((entry) => entry.customerId === customerId) : this.aiUsage;
    return [...entries].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  recordAiUsage(entry: Omit<PlatformAiUsageEntry, 'id' | 'occurredAt'> & { occurredAt?: string }): PlatformAiUsageEntry {
    const record: PlatformAiUsageEntry = {
      id: createId(),
      occurredAt: entry.occurredAt ?? nowIso(),
      customerId: entry.customerId,
      provider: entry.provider,
      estimatedCostEur: entry.estimatedCostEur,
    };
    this.aiUsage.push(record);
    return record;
  }

  /** Sums `estimatedCostEur` for `customerId` within the same calendar month/year as `referenceDate`. */
  getMonthlyAiCostEur(customerId: string, referenceDate: Date = new Date()): number {
    return this.aiUsage
      .filter((entry) => entry.customerId === customerId)
      .filter((entry) => {
        const occurred = new Date(entry.occurredAt);
        return (
          occurred.getUTCFullYear() === referenceDate.getUTCFullYear() &&
          occurred.getUTCMonth() === referenceDate.getUTCMonth()
        );
      })
      .reduce((sum, entry) => sum + entry.estimatedCostEur, 0);
  }

  // -- Audit log --------------------------------------------------------------

  recordAuditLogEntry(input: RecordAuditLogInput): PlatformAuditLogEntry {
    const entry: PlatformAuditLogEntry = {
      id: createId(),
      occurredAt: nowIso(),
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
    };
    this.auditLog.unshift(entry);
    return entry;
  }

  listAuditLog(limit = 100): readonly PlatformAuditLogEntry[] {
    return this.auditLog.slice(0, limit);
  }

  // -- Feature flags ------------------------------------------------------

  listFeatureFlags(): readonly PlatformFeatureFlagRecord[] {
    return [...this.featureFlags.values()].sort((a, b) => a.key.localeCompare(b.key));
  }

  getFeatureFlag(key: string): PlatformFeatureFlagRecord | null {
    return this.featureFlags.get(key) ?? null;
  }

  updateFeatureFlag(key: string, patch: UpdateFeatureFlagInput): PlatformFeatureFlagRecord | null {
    const existing = this.featureFlags.get(key);
    if (!existing) return null;
    const updated: PlatformFeatureFlagRecord = {
      ...existing,
      isEnabled: patch.isEnabled ?? existing.isEnabled,
      rolloutPercentage: patch.rolloutPercentage ?? existing.rolloutPercentage,
      updatedAt: nowIso(),
    };
    this.featureFlags.set(key, updated);
    return updated;
  }

  // -- Jobs -----------------------------------------------------------------

  listJobs(filter: { status?: JobStatus } = {}): readonly PlatformJobRecord[] {
    const jobs = [...this.jobs.values()];
    const filtered = filter.status ? jobs.filter((job) => job.status === filter.status) : jobs;
    return filtered.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
  }

  listPipelineRuns(): readonly PlatformPipelineRunRecord[] {
    return [...this.pipelineRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  getPipelineRun(id: string): PlatformPipelineRunRecord | null {
    return this.pipelineRuns.find((run) => run.id === id) ?? null;
  }

  recordPipelineRun(input: Omit<PlatformPipelineRunRecord, 'id'>): PlatformPipelineRunRecord {
    const record: PlatformPipelineRunRecord = { id: createId(), ...input };
    this.pipelineRuns.unshift(record);
    return record;
  }

  listImportSyncs(): readonly PlatformImportSyncRecord[] {
    return this.importSyncs.map((row) => this.withDayStatuses(row));
  }

  recordImportSync(input: {
    registryCode: string;
    displayNameNl: string;
    purpose: 'watch' | 'name_research';
    status: 'succeeded' | 'failed';
    fetchedCount: number | null;
    affectedOrganizationIds?: readonly string[];
  }): PlatformImportSyncRecord {
    const idx = this.importSyncs.findIndex(
      (r) => r.registryCode === input.registryCode && r.purpose === input.purpose,
    );
    const next = this.withDayStatuses({
      registryCode: input.registryCode,
      displayNameNl: input.displayNameNl,
      purpose: input.purpose,
      lastSyncAt: nowIso(),
      lastStatus: input.status,
      lastFetchedCount: input.fetchedCount,
      affectedOrganizationIds: input.affectedOrganizationIds ?? [],
    });
    if (idx >= 0) this.importSyncs[idx] = next;
    else this.importSyncs.push(next);
    return next;
  }

  getJob(id: string): PlatformJobRecord | null {
    return this.jobs.get(id) ?? null;
  }

  triggerJob(input: TriggerJobInput): PlatformJobRecord {
    const job: PlatformJobRecord = {
      id: createId(),
      type: input.type,
      status: 'pending',
      registryCode: input.registryCode ?? null,
      attempt: 1,
      startedAt: nowIso(),
      finishedAt: null,
      error: null,
      metadata: {},
      triggeredBy: input.triggeredBy,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  /** Transitions a job to a terminal state, e.g. after the trigger/retry route actually runs it. */
  finishJob(
    id: string,
    outcome: { status: Extract<JobStatus, 'succeeded' | 'failed'>; error?: string | null; metadata?: Readonly<Record<string, unknown>> },
  ): PlatformJobRecord | null {
    const existing = this.jobs.get(id);
    if (!existing) return null;
    const updated: PlatformJobRecord = {
      ...existing,
      status: outcome.status,
      finishedAt: nowIso(),
      error: outcome.error ?? null,
      metadata: outcome.metadata ?? existing.metadata,
    };
    this.jobs.set(id, updated);
    return updated;
  }

  /** Resets a `failed` job back to `pending` with an incremented attempt count, ready to be re-run. Returns `null` if the job doesn't exist or isn't currently `failed`. */
  retryJob(id: string): PlatformJobRecord | null {
    const existing = this.jobs.get(id);
    if (!existing || existing.status !== 'failed') return null;
    const updated: PlatformJobRecord = {
      ...existing,
      status: 'pending',
      attempt: existing.attempt + 1,
      startedAt: nowIso(),
      finishedAt: null,
      error: null,
    };
    this.jobs.set(id, updated);
    return updated;
  }
}

export function createPlatformStore(primaryCustomerId: string): PlatformStore {
  return new PlatformStore(primaryCustomerId);
}
