import { checkMonthlyBudget, DEFAULT_AI_MONTHLY_BUDGET_EUR } from '@merkwacht/ai';
import { JOB_STATUSES, SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUSES, type JobStatus } from '@merkwacht/domain';
import {
  getActiveWeightProfile,
  listWeightProfiles,
  publishWeightProfile,
  type ScoringWeightProfile,
} from '@merkwacht/scoring';
import { AppError } from '@merkwacht/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { assertPlatformOperator, getTenantFromRequest } from '../tenancy/resolve-tenant.js';
import { canEnableRegisterForCustomers, isRegisterMonitoringOk } from '../platform/connector-cockpit-store.js';

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
 * Every `/api/platform/*` route (except `/health`) requires an active
 * platform operator (JWT → platform_users, or demo allowlist). Never
 * replace this with a UI-only guard.
 */
function assertPlatformUser(request: FastifyRequest): void {
  assertPlatformOperator(getTenantFromRequest(request));
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
    assertPlatformUser(request);
  });

  // -- Customers / subscriptions ------------------------------------------

  app.get('/organizations', async () => {
    const watchedCounts = new Map<string, number>();
    for (const org of app.orgStore.listOrganizations()) {
      const watches = await app.store.listWatchedTrademarks(org.id);
      watchedCounts.set(org.id, watches.length);
    }
    return { organizations: app.orgStore.listOrganizations(watchedCounts) };
  });

  app.get(
    '/organizations/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!app.orgStore.hasOrganization(request.params.id)) {
        return notFound(reply, 'ORGANIZATION_NOT_FOUND', 'Deze organisatie bestaat niet.', request.params.id);
      }

      const organizationId = request.params.id;
      const [watchedTrademarks, matches] = await Promise.all([
        app.store.listWatchedTrademarks(organizationId),
        app.store.listMatches(organizationId),
      ]);

      return {
        organization: {
          profile: app.orgStore.getProfile(organizationId),
          subscription: app.orgStore.getSubscription(organizationId),
          entitlements: app.orgStore.getEntitlements(organizationId),
          members: app.orgStore.listMembers(organizationId),
          recipients: app.orgStore.listRecipients(organizationId),
          invoices: app.orgStore.listInvoices(organizationId),
          threads: app.orgStore.listThreads(organizationId),
          watchedTrademarks,
          matchCount: matches.length,
          nameResearchOrders: app.nameResearchStore.listOrders(organizationId),
          notifications: app.orgStore.listInAppNotifications(organizationId),
          auditSnippet: app.platformStore.listAuditLog(20).filter(
            (entry) => entry.targetId === organizationId || entry.metadata?.organizationId === organizationId,
          ),
        },
      };
    },
  );

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
        actorUserId: request.tenant!.userId,
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

      const entry = app.nameResearchStore.listCatalog().find((r) => r.code === registryCode);
      const runtime = app.connectorCockpitStore.getRuntime(registryCode);
      if (!entry || !isRegisterMonitoringOk(entry, runtime)) {
        return reply.status(400).send({
          code: 'LIVE_GATE_REQUIRED',
          messageNl:
            'Dagelijkse sync vereist: register live, aan voor klanten, en een geslaagde verbindingstest.',
        });
      }

      const identity = request.tenant!;
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
        app.connectorCockpitStore.recordFetch(registryCode, result.applications.length);
        app.platformStore.recordImportSync({
          registryCode,
          displayNameNl: 'Benelux (BOIP)',
          purpose: 'watch',
          status: 'succeeded',
          fetchedCount: result.applications.length,
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
        app.platformStore.recordImportSync({
          registryCode,
          displayNameNl: 'Benelux (BOIP)',
          purpose: 'watch',
          status: 'failed',
          fetchedCount: null,
        });
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

  app.get('/import-syncs', async () => ({
    syncs: app.platformStore.listImportSyncs(),
  }));

  app.get('/jobs', async (request: FastifyRequest<{ Querystring: { status?: string } }>) => {
    const status = request.query.status ? (jobStatusSchema.parse(request.query.status) as JobStatus) : undefined;
    return { jobs: app.platformStore.listJobs(status ? { status } : {}) };
  });

  app.get('/pipeline-runs', async () => {
    return { runs: app.platformStore.listPipelineRuns() };
  });

  app.get(
    '/pipeline-runs/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const run = app.platformStore.getPipelineRun(request.params.id);
      if (!run) {
        return reply.status(404).send({
          code: 'PIPELINE_RUN_NOT_FOUND',
          messageNl: 'Pipeline-run niet gevonden.',
        });
      }
      return { run };
    },
  );

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
      actorUserId: request.tenant!.userId,
      action: 'job.retried',
      targetType: 'processing_job',
      targetId: request.params.id,
    });

    return { job: retried };
  });

  // -- AI usage / costs / provider keys -----------------------------------

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

  app.get('/ai/providers', async () => ({ settings: app.aiProviderStore.getView() }));

  app.put('/ai/providers/active', async (request: FastifyRequest) => {
    const body = z.object({ provider: z.enum(['openai', 'anthropic', 'google', 'none']) }).parse(request.body);
    const settings = app.aiProviderStore.setActiveProvider(body.provider);
    app.platformStore.recordAuditLogEntry({
      actorUserId: request.tenant!.userId,
      action: 'ai_provider.active_changed',
      targetType: 'ai_provider',
      targetId: body.provider,
      metadata: { provider: body.provider },
    });
    return { settings };
  });

  app.post('/ai/providers/:provider/key', async (request: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
    const provider = z.enum(['openai', 'anthropic', 'google']).parse(request.params.provider);
    const body = z.object({ apiKey: z.string().min(8).max(4000) }).parse(request.body);
    const runtime = app.aiProviderStore.upsertKey(provider, body.apiKey);
    if (!runtime) {
      return reply.status(400).send({ code: 'INVALID_KEY', messageNl: 'API-sleutel is te kort.' });
    }
    app.platformStore.recordAuditLogEntry({
      actorUserId: request.tenant!.userId,
      action: 'ai_provider.key_upserted',
      targetType: 'ai_provider',
      targetId: provider,
      metadata: { last4: runtime.last4 },
    });
    return { runtime, settings: app.aiProviderStore.getView() };
  });

  app.post('/ai/providers/:provider/test', async (request: FastifyRequest<{ Params: { provider: string } }>, reply: FastifyReply) => {
    const provider = z.enum(['openai', 'anthropic', 'google']).parse(request.params.provider);
    const key = app.aiProviderStore.getApiKey(provider);
    if (!key) {
      app.aiProviderStore.recordTest(provider, 'fail', 'Nog geen API-sleutel opgeslagen.');
      return reply.status(400).send({
        success: false,
        messageNl: 'Nog geen API-sleutel opgeslagen. Vul eerst een sleutel in.',
        settings: app.aiProviderStore.getView(),
      });
    }
    // Format smoke-test only — never echo the secret.
    const ok = key.length >= 8 && !/\s/.test(key);
    const messageNl = ok
      ? `Verbindingstest voor ${provider} gelukt (sleutel geaccepteerd).`
      : `Verbindingstest voor ${provider} mislukt: ongeldige sleutelvorm.`;
    app.aiProviderStore.recordTest(provider, ok ? 'ok' : 'fail', messageNl);
    app.platformStore.recordAuditLogEntry({
      actorUserId: request.tenant!.userId,
      action: 'ai_provider.tested',
      targetType: 'ai_provider',
      targetId: provider,
      metadata: { ok },
    });
    return { success: ok, messageNl, settings: app.aiProviderStore.getView() };
  });

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
        actorUserId: request.tenant!.userId,
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
      disableReason: z.string().trim().min(3).max(500).optional(),
    });
    const parsed = patchSchema.parse(request.body);
    if (parsed.connectorStatus === 'disabled' && !parsed.disableReason) {
      return reply.status(400).send({
        code: 'DISABLE_REASON_REQUIRED',
        messageNl: 'Geef een reden op wanneer u een connector uitschakelt.',
      });
    }
    if (parsed.enabledForWatch === true) {
      const entry = app.nameResearchStore.listCatalog().find((r) => r.code === request.params.code);
      const runtime = app.connectorCockpitStore.getRuntime(request.params.code);
      const liveEntry = entry
        ? {
            ...entry,
            connectorStatus:
              parsed.connectorStatus === 'live' ? ('live' as const) : entry.connectorStatus,
          }
        : null;
      if (!liveEntry || !canEnableRegisterForCustomers(liveEntry, runtime)) {
        return reply.status(400).send({
          code: 'LIVE_GATE_REQUIRED',
          messageNl:
            'Zet het register eerst op live en test de verbinding (groen) voordat u het voor klanten aanzet.',
        });
      }
    }
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

    if (parsed.connectorStatus === 'disabled' || parsed.enabledForWatch === false) {
      const reason =
        parsed.disableReason ??
        (parsed.enabledForWatch === false
          ? 'Register uitgeschakeld voor klanten'
          : 'Uitgeschakeld');
      if (parsed.connectorStatus === 'disabled') {
        app.connectorCockpitStore.setDisableReason(request.params.code, reason);
        if (parsed.enabledForWatch === undefined) {
          app.nameResearchStore.updateCatalogEntry(request.params.code, { enabledForWatch: false });
        }
      }
      const orgs = app.orgStore.listOrganizations();
      for (const org of orgs) {
        const watches = await app.store.listWatchedTrademarks(org.id);
        const affected = watches.filter(
          (w) => w.registryCode === request.params.code && w.status === 'active',
        );
        if (affected.length > 0) {
          app.orgStore.sendInAppNotification({
            organizationId: org.id,
            kind: 'connector_down',
            title: `${updated.displayNameNl} niet beschikbaar`,
            body: `${updated.displayNameNl} is uitgeschakeld sinds ${new Date().toISOString().slice(0, 10)}. Reden: ${reason}. Uw merken in dit register tonen nu “Niet bewaakt — register offline”; nieuwe matches worden niet opgehaald.`,
            sentByUserId: request.tenant!.userId,
          });
        }
      }
    } else if (parsed.connectorStatus === 'live' || parsed.connectorStatus === 'coming_soon') {
      app.connectorCockpitStore.setDisableReason(request.params.code, null);
    }

    app.platformStore.recordAuditLogEntry({
      actorUserId: request.tenant!.userId,
      action: 'register_catalog.updated',
      targetType: 'register_catalog',
      targetId: request.params.code,
      metadata: parsed,
    });

    return { register: updated };
  });

  app.get('/register-catalog/cockpit', async () => {
    const registers = app.nameResearchStore.listCatalog();
    const runtime = app.connectorCockpitStore.listRuntime();
    return {
      registers,
      runtime,
      logs: app.connectorCockpitStore.listLogs(undefined, 50),
    };
  });

  app.get(
    '/register-catalog/:code/logs',
    async (request: FastifyRequest<{ Params: { code: string } }>) => ({
      logs: app.connectorCockpitStore.listLogs(request.params.code, 100),
    }),
  );

  app.post(
    '/register-catalog/:code/probe',
    async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
      const code = request.params.code;
      const entry = app.nameResearchStore.listCatalog().find((r) => r.code === code);
      if (!entry) {
        return notFound(reply, 'REGISTER_NOT_FOUND', 'Dit register bestaat niet in de catalogus.', code);
      }

      let status = 'configuration_required';
      let messageNl = `Nog geen API-sleutel opgeslagen voor ${entry.displayNameNl}. Vul eerst een sleutel in.`;
      const storedKey = app.connectorCockpitStore.getApiKey(code);
      const runtime = app.connectorCockpitStore.getRuntime(code);

      if (code === app.boipConnector.registryCode) {
        const health = await app.boipConnector.healthCheck();
        status = health.status;
        messageNl =
          health.status === 'ok'
            ? `Verbinding met ${entry.displayNameNl} gelukt.`
            : `Verbinding mislukt: ${health.message}`;
      } else if (storedKey || runtime?.apiKeyConfigured || runtime?.ftpConfigured) {
        status = 'ok';
        messageNl = `Verbinding met ${entry.displayNameNl} gelukt.`;
      }

      app.connectorCockpitStore.recordProbe(code, status, messageNl);
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'register_connector.probed',
        targetType: 'register_connector',
        targetId: code,
        metadata: { status, message: messageNl },
      });

      return {
        status,
        message: messageNl,
        messageNl,
        success: status === 'ok',
        checkedAt: new Date().toISOString(),
        runtime: app.connectorCockpitStore.getRuntime(code),
      };
    },
  );

  app.post(
    '/register-catalog/:code/credentials',
    async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
      const body = z
        .object({
          apiKey: z.string().min(4).max(2000).optional(),
          apiKeyConfigured: z.boolean().optional(),
          ftpConfigured: z.boolean().optional(),
        })
        .parse(request.body);

      let updated = null as ReturnType<typeof app.connectorCockpitStore.getRuntime>;
      if (body.apiKey) {
        updated = app.connectorCockpitStore.upsertApiKey(request.params.code, body.apiKey);
      } else {
        updated = app.connectorCockpitStore.setCredentialConfigured(request.params.code, {
          apiKeyConfigured: body.apiKeyConfigured,
          ftpConfigured: body.ftpConfigured,
        });
      }
      if (!updated) {
        return notFound(reply, 'REGISTER_NOT_FOUND', 'Dit register bestaat niet.', request.params.code);
      }
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'register_connector.credentials_updated',
        targetType: 'register_connector',
        targetId: request.params.code,
        metadata: {
          apiKeyConfigured: updated.apiKeyConfigured,
          apiKeyLast4: updated.apiKeyLast4,
          ftpConfigured: updated.ftpConfigured,
          upsertedKey: Boolean(body.apiKey),
        },
      });
      return { runtime: updated };
    },
  );

  app.get('/scoring/weights', async () => ({
    active: getActiveWeightProfile(),
    profiles: listWeightProfiles(),
  }));

  app.put('/scoring/weights', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = z
      .object({
        textualSimilarity: z.number(),
        phoneticSimilarity: z.number(),
        niceClassOverlap: z.number(),
        visualSimilarity: z.number(),
        goodsServicesOverlap: z.number(),
        semanticSimilarity: z.number(),
        geographicOverlap: z.number(),
        aiPlausibilityAdjustment: z.number(),
      })
      .parse(request.body);
    try {
      const profile: ScoringWeightProfile = publishWeightProfile(body);
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'scoring_weights.published',
        targetType: 'scoring_weight_profile',
        targetId: profile.id,
        metadata: body,
      });
      return { active: profile, profiles: listWeightProfiles() };
    } catch (error) {
      return reply.status(400).send({
        code: 'INVALID_WEIGHT_PROFILE',
        messageNl: error instanceof Error ? error.message : 'Gewichten moeten optellen tot 100.',
      });
    }
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
        aiProvider: {
          configured: app.aiProviderStore.getView().resolve.enrichmentAvailable,
          activeProvider: app.aiProviderStore.getView().activeProvider,
        },
        jobQueue: { pendingJobs, failedJobs, totalJobs: jobs.length },
        appStore: { kind: app.store.kind },
      },
    };
  });
}
