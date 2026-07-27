import type { JobStatus, JobType, ProcessingJob, SubscriptionPlan, SubscriptionStatus } from '@merkwacht/domain';
import { createId } from '@merkwacht/shared';

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

  constructor(primaryCustomerId: string) {
    this.seedCustomers(primaryCustomerId);
    this.seedFeatureFlags();
    this.seedAiUsage(primaryCustomerId);
    this.seedJobs();
  }

  private seedCustomers(primaryCustomerId: string): void {
    const now = nowIso();
    const seed: PlatformCustomerRecord[] = [
      {
        id: primaryCustomerId,
        name: 'Voorbeeld Merkenbureau B.V.',
        plan: 'pro',
        status: 'active',
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: now,
        updatedAt: now,
      },
      {
        id: createId(),
        name: 'Fictieve Retail Groep B.V.',
        plan: 'starter',
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
