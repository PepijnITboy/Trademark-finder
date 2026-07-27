import { checkMonthlyBudget, DEFAULT_AI_MONTHLY_BUDGET_EUR } from '@merkwacht/ai';
import { isDevPlatformUser } from '@merkwacht/database';
import { JOB_STATUSES, SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUSES, type JobStatus } from '@merkwacht/domain';
import { AppError } from '@merkwacht/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const NOT_YET_SUPPORTED_REGISTERS: ReadonlyArray<{ registryCode: string; displayName: string }> = [
  { registryCode: 'EUIPO', displayName: 'EUIPO (Europese Unie)' },
  { registryCode: 'WIPO', displayName: 'WIPO (internationaal, Madrid-systeem)' },
  { registryCode: 'USPTO', displayName: 'USPTO (Verenigde Staten)' },
];

const updateSubscriptionSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS).optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
});

const updateFeatureFlagSchema = z.object({
  isEnabled: z.boolean().optional(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
});

const jobStatusSchema = z.enum(JOB_STATUSES);

function notFound(reply: FastifyReply, code: string, messageNl: string, referenceCode: string): FastifyReply {
  return reply.status(404).send({ code, messageNl, referenceCode });
}

/**
 * Every `/api/platform/*` route (except `/health`) requires the current
 * `DevIdentity` to be a known platform operator - see
 * `packages/database/src/dev-identity.ts`'s `isDevPlatformUser` and
 * `docs/security/security-model.md`'s `/platform` boundary. This is the
 * server-side check that doc says must never be replaced by a UI guard
 * alone.
 */
function assertPlatformUser(app: FastifyInstance): void {
  const identity = app.identityProvider.getIdentity();
  if (!isDevPlatformUser(identity.userId)) {
    throw new AppError({
      code: 'PLATFORM_ACCESS_DENIED',
      messageNl: 'Deze gebruiker heeft geen toegang tot het platformbeheer.',
      category: 'AUTHORIZATION',
    });
  }
}

/**
 * `/api/platform/*` - internal, operator-only tooling: customers &
 * subscriptions, register connector health/sync, the worker job audit
 * trail, AI usage/cost tracking, the platform audit log, operational
 * feature flags, and an aggregate system health view. Every route (besides
 * `/health`) is gated by {@link assertPlatformUser}. See
 * `docs/security/security-model.md` and
 * `supabase/migrations/20260727121300_platform.sql`.
 */
export async function registerPlatformRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => ({
    status: 'ok',
    service: 'merkwacht-platform',
    timestamp: new Date().toISOString(),
  }));

  app.addHook('onRequest', async (request: FastifyRequest) => {
    if (request.url.endsWith('/health')) return;
    assertPlatformUser(app);
  });

  // -- Customers / subscriptions ------------------------------------------

  app.get('/customers', async () => {
    const customers = await Promise.all(
      app.platformStore.listCustomers().map(async (customer) => {
        const watchedTrademarks = await app.store.listWatchedTrademarks(customer.id);
        const matches = await app.store.listMatches(customer.id);
        return { ...customer, watchedTrademarkCount: watchedTrademarks.length, matchCount: matches.length };
      }),
    );
    return { customers };
  });

  app.get('/customers/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const customer = app.platformStore.getCustomer(request.params.id);
    if (!customer) return notFound(reply, 'CUSTOMER_NOT_FOUND', 'Deze klant bestaat niet.', request.params.id);

    const [watchedTrademarks, matches, settings] = await Promise.all([
      app.store.listWatchedTrademarks(customer.id),
      app.store.listMatches(customer.id),
      app.store.getOrganizationSettings(customer.id),
    ]);

    return {
      customer,
      watchedTrademarks,
      matchCount: matches.length,
      settings,
      aiUsage: app.platformStore.listAiUsage(customer.id),
    };
  });

  app.patch(
    '/customers/:id/subscription',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const patch = updateSubscriptionSchema.parse(request.body);
      const updated = app.platformStore.updateCustomerSubscription(request.params.id, patch);
      if (!updated) return notFound(reply, 'CUSTOMER_NOT_FOUND', 'Deze klant bestaat niet.', request.params.id);

      app.platformStore.recordAuditLogEntry({
        actorUserId: app.identityProvider.getIdentity().userId,
        action: 'subscription.updated',
        targetType: 'customer',
        targetId: request.params.id,
        metadata: patch,
      });

      return { customer: updated };
    },
  );

  app.get('/subscriptions', async () => ({
    subscriptions: app.platformStore.listCustomers().map((customer) => ({
      customerId: customer.id,
      customerName: customer.name,
      plan: customer.plan,
      status: customer.status,
      renewsAt: customer.renewsAt,
    })),
  }));

  // -- Register connectors -------------------------------------------------

  app.get('/register-connectors', async () => {
    const boipHealth = await app.boipConnector.healthCheck();
    return {
      connectors: [
        {
          registryCode: app.boipConnector.registryCode,
          displayName: 'BOIP (Benelux)',
          status: boipHealth.status,
          message: boipHealth.message,
          checkedAt: boipHealth.checkedAt,
          capabilities: app.boipConnector.capabilities,
        },
        ...NOT_YET_SUPPORTED_REGISTERS.map((source) => ({
          ...source,
          status: 'not_yet_supported' as const,
          message: `${source.displayName} wordt nog niet ondersteund door Merkwacht.`,
          checkedAt: new Date().toISOString(),
          capabilities: null,
        })),
      ],
    };
  });

  app.post(
    '/register-connectors/:registryCode/sync',
    async (request: FastifyRequest<{ Params: { registryCode: string } }>, reply: FastifyReply) => {
      const { registryCode } = request.params;
      if (registryCode !== app.boipConnector.registryCode) {
        return notFound(
          reply,
          'REGISTER_CONNECTOR_NOT_FOUND',
          `Geen registerkoppeling geconfigureerd voor "${registryCode}".`,
          registryCode,
        );
      }

      const identity = app.identityProvider.getIdentity();
      const job = app.platformStore.triggerJob({
        type: 'fetch_publications',
        registryCode,
        triggeredBy: identity.userId,
      });

      // The full ingestion pipeline runs in `apps/worker` (see
      // `apps/worker/src/pipelines/daily-sync-pipeline.ts`) - per
      // `docs/architecture/module-boundaries.md`, `apps/api` may not import
      // `apps/worker`'s source directly. This performs a live
      // `fetchPublications` call against the same connector so an operator
      // gets immediate, honest feedback (a real count, not a fabricated
      // one) rather than a fire-and-forget 202, while the actual ingest +
      // persistence happens on the worker's own next poll/schedule.
      try {
        const result = await app.boipConnector.fetchPublications({});
        const finished = app.platformStore.finishJob(job.id, {
          status: 'succeeded',
          metadata: { fetchedCount: result.applications.length, hasMore: result.hasMore },
        });
        app.platformStore.recordAuditLogEntry({
          actorUserId: identity.userId,
          action: 'register_connector.sync_triggered',
          targetType: 'register_connector',
          targetId: registryCode,
          metadata: { jobId: job.id, fetchedCount: result.applications.length },
        });
        return reply.status(202).send({ job: finished ?? job });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const finished = app.platformStore.finishJob(job.id, { status: 'failed', error: message });
        app.platformStore.recordAuditLogEntry({
          actorUserId: identity.userId,
          action: 'register_connector.sync_failed',
          targetType: 'register_connector',
          targetId: registryCode,
          metadata: { jobId: job.id, error: message },
        });
        return reply.status(202).send({ job: finished ?? job });
      }
    },
  );

  // -- Jobs -------------------------------------------------------------------

  app.get('/jobs', async (request: FastifyRequest<{ Querystring: { status?: string } }>) => {
    const status = request.query.status ? (jobStatusSchema.parse(request.query.status) as JobStatus) : undefined;
    return { jobs: app.platformStore.listJobs(status ? { status } : {}) };
  });

  app.post('/jobs/:id/retry', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const retried = app.platformStore.retryJob(request.params.id);
    if (!retried) {
      const existing = app.platformStore.getJob(request.params.id);
      if (!existing) {
        return notFound(reply, 'JOB_NOT_FOUND', 'Deze taak bestaat niet.', request.params.id);
      }
      throw new AppError({
        code: 'JOB_NOT_RETRYABLE',
        messageNl: `Taak "${request.params.id}" heeft status "${existing.status}" en kan niet opnieuw worden uitgevoerd (alleen mislukte taken zijn herstartbaar).`,
        category: 'CONFLICT',
      });
    }

    app.platformStore.recordAuditLogEntry({
      actorUserId: app.identityProvider.getIdentity().userId,
      action: 'job.retried',
      targetType: 'processing_job',
      targetId: request.params.id,
    });

    return { job: retried };
  });

  // -- AI usage / costs ---------------------------------------------------

  app.get('/ai/usage', async (request: FastifyRequest<{ Querystring: { customerId?: string } }>) => ({
    usage: app.platformStore.listAiUsage(request.query.customerId),
  }));

  app.get('/ai/costs', async () => ({
    monthlyBudgetEur: DEFAULT_AI_MONTHLY_BUDGET_EUR,
    customers: app.platformStore.listCustomers().map((customer) => {
      const usedEur = app.platformStore.getMonthlyAiCostEur(customer.id);
      return { customerId: customer.id, customerName: customer.name, budget: checkMonthlyBudget(customer.id, usedEur) };
    }),
  }));

  // -- Audit log ------------------------------------------------------------

  app.get('/audit-log', async (request: FastifyRequest<{ Querystring: { limit?: string } }>) => {
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;
    return { entries: app.platformStore.listAuditLog(limit && Number.isFinite(limit) ? limit : undefined) };
  });

  // -- Feature flags --------------------------------------------------------

  app.get('/feature-flags', async () => ({ featureFlags: app.platformStore.listFeatureFlags() }));

  app.patch(
    '/feature-flags/:key',
    async (request: FastifyRequest<{ Params: { key: string } }>, reply: FastifyReply) => {
      const patch = updateFeatureFlagSchema.parse(request.body);
      const updated = app.platformStore.updateFeatureFlag(request.params.key, patch);
      if (!updated) {
        return notFound(reply, 'FEATURE_FLAG_NOT_FOUND', 'Deze feature flag bestaat niet.', request.params.key);
      }

      app.platformStore.recordAuditLogEntry({
        actorUserId: app.identityProvider.getIdentity().userId,
        action: 'feature_flag.updated',
        targetType: 'feature_flag',
        targetId: request.params.key,
        metadata: patch,
      });

      return { featureFlag: updated };
    },
  );

  // -- Merkonderzoek register catalog + orders -----------------------------

  app.get('/register-catalog', async () => {
    return { registers: app.nameResearchStore.listCatalog() };
  });

  app.patch('/register-catalog/:code', async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
    const patchSchema = z.object({
      displayNameNl: z.string().min(1).optional(),
      connectorStatus: z.enum(['live', 'coming_soon', 'disabled']).optional(),
      basePriceCents: z.number().int().min(0).optional(),
      enabledForWatch: z.boolean().optional(),
      enabledForNameResearch: z.boolean().optional(),
    });
    const parsed = patchSchema.parse(request.body);
    const patch: Partial<{
      displayNameNl: string;
      connectorStatus: 'live' | 'coming_soon' | 'disabled';
      basePriceCents: number;
      enabledForWatch: boolean;
      enabledForNameResearch: boolean;
    }> = {};
    if (parsed.displayNameNl !== undefined) patch.displayNameNl = parsed.displayNameNl;
    if (parsed.connectorStatus !== undefined) patch.connectorStatus = parsed.connectorStatus;
    if (parsed.basePriceCents !== undefined) patch.basePriceCents = parsed.basePriceCents;
    if (parsed.enabledForWatch !== undefined) patch.enabledForWatch = parsed.enabledForWatch;
    if (parsed.enabledForNameResearch !== undefined) patch.enabledForNameResearch = parsed.enabledForNameResearch;
    const updated = app.nameResearchStore.updateCatalogEntry(request.params.code, patch);
    if (!updated) {
      return notFound(reply, 'REGISTER_NOT_FOUND', 'Dit register bestaat niet in de catalogus.', request.params.code);
    }
    return { register: updated };
  });

  app.get('/name-research', async () => {
    return { orders: app.nameResearchStore.listAllOrders() };
  });

  // -- System health --------------------------------------------------------

  app.get('/system-health', async () => {
    const boipHealth = await app.boipConnector.healthCheck();
    const jobs = app.platformStore.listJobs();
    const failedJobs = jobs.filter((job) => job.status === 'failed').length;
    const pendingJobs = jobs.filter((job) => job.status === 'pending' || job.status === 'running').length;

    const overall: 'ok' | 'degraded' | 'unavailable' =
      boipHealth.status === 'unavailable' || failedJobs > 0
        ? 'degraded'
        : boipHealth.status === 'configuration_required'
          ? 'degraded'
          : 'ok';

    return {
      overall,
      checkedAt: new Date().toISOString(),
      components: {
        registerConnectors: [{ registryCode: app.boipConnector.registryCode, status: boipHealth.status, message: boipHealth.message }],
        aiProvider: { configured: Boolean(app.appEnv.OPENAI_API_KEY) },
        jobQueue: { pendingJobs, failedJobs, totalJobs: jobs.length },
        appStore: { kind: app.store.kind },
      },
    };
  });
}
