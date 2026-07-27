import { isDevPlatformUser } from '@merkwacht/database';
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUSES, type FeatureFlag } from '@merkwacht/domain';
import { AppError } from '@merkwacht/shared';
import { createChatMessageSchema } from '@merkwacht/validation';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

const updatePlanCatalogSchema = z.object({
  displayNameNl: z.string().trim().min(1).max(120).optional(),
  priceMonthlyCents: z.number().int().min(0).optional(),
  maxWatchedTrademarks: z.number().int().min(0).optional(),
  maxNotificationEmails: z.number().int().min(0).optional(),
  supportTier: z.enum(['basis', 'standaard', 'prioriteit', 'dedicated']).optional(),
  features: z.record(z.enum(['ai_enrichment', 'pdf_export', 'csv_export', 'email_notifications', 'multi_register_watch', 'platform_access', 'merkrechten_chat']), z.boolean()).optional(),
});

const forceSubscriptionSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS).optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  pendingPlan: z.enum(SUBSCRIPTION_PLANS).nullable().optional(),
});

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

/** `/api/platform/org/*` — plan catalog, subscription overrides, and cross-org chat for operators. */
export async function registerPlatformOrgRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async () => {
    assertPlatformUser(app);
  });

  app.get('/plans', async () => ({
    plans: app.orgStore.listPlans(),
  }));

  app.patch('/plans/:code', async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
    const planCode = z.enum(SUBSCRIPTION_PLANS).parse(request.params.code);
    const patch = updatePlanCatalogSchema.parse(request.body);
    const updated = app.orgStore.updatePlanCatalog(planCode, {
      ...(patch.displayNameNl !== undefined ? { displayNameNl: patch.displayNameNl } : {}),
      ...(patch.priceMonthlyCents !== undefined ? { priceMonthlyCents: patch.priceMonthlyCents } : {}),
      ...(patch.maxWatchedTrademarks !== undefined ? { maxWatchedTrademarks: patch.maxWatchedTrademarks } : {}),
      ...(patch.maxNotificationEmails !== undefined ? { maxNotificationEmails: patch.maxNotificationEmails } : {}),
      ...(patch.supportTier !== undefined ? { supportTier: patch.supportTier } : {}),
      ...(patch.features !== undefined
        ? { features: patch.features as Partial<Record<FeatureFlag, boolean>> }
        : {}),
    });
    if (!updated) {
      return reply.status(404).send({
        code: 'PLAN_NOT_FOUND',
        messageNl: 'Dit abonnement bestaat niet in de catalogus.',
        referenceCode: request.params.code,
      });
    }

    app.platformStore.recordAuditLogEntry({
      actorUserId: app.identityProvider.getIdentity().userId,
      action: 'plan_catalog.updated',
      targetType: 'subscription_plan',
      targetId: planCode,
      metadata: patch,
    });

    return { plan: updated };
  });

  app.post(
    '/organizations/:organizationId/subscription/force',
    async (request: FastifyRequest<{ Params: { organizationId: string } }>, reply: FastifyReply) => {
      const patch = forceSubscriptionSchema.parse(request.body);
      try {
        const subscription = app.orgStore.forceSubscription(request.params.organizationId, {
          ...(patch.plan !== undefined ? { plan: patch.plan } : {}),
          ...(patch.status !== undefined ? { status: patch.status } : {}),
          ...(patch.pendingPlan !== undefined ? { pendingPlan: patch.pendingPlan } : {}),
        });
        app.platformStore.recordAuditLogEntry({
          actorUserId: app.identityProvider.getIdentity().userId,
          action: 'subscription.forced',
          targetType: 'organization',
          targetId: request.params.organizationId,
          metadata: patch,
        });
        return { subscription, entitlements: app.orgStore.getEntitlements(request.params.organizationId) };
      } catch (error) {
        if (error instanceof AppError && error.code === 'ORGANIZATION_NOT_FOUND') {
          return reply.status(404).send({
            code: error.code,
            messageNl: error.messageNl,
            referenceCode: request.params.organizationId,
          });
        }
        throw error;
      }
    },
  );

  app.get('/chat/threads', async () => ({
    threads: app.orgStore.listAllThreadsForPlatform(),
  }));

  app.post('/chat/threads/:id/messages', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const input = createChatMessageSchema.parse(request.body);
    const identity = app.identityProvider.getIdentity();
    const message = app.orgStore.addPlatformMessage(request.params.id, input.body, identity.userId, 'Merkwacht Support');
    if (!message) {
      return reply.status(404).send({
        code: 'CHAT_THREAD_NOT_FOUND',
        messageNl: 'Dit gesprek bestaat niet.',
        referenceCode: request.params.id,
      });
    }

    app.platformStore.recordAuditLogEntry({
      actorUserId: identity.userId,
      action: 'chat.platform_reply',
      targetType: 'support_thread',
      targetId: request.params.id,
    });

    return reply.status(201).send({ message });
  });

  app.get('/billing', async () => ({
    invoices: app.orgStore.listAllInvoices(),
  }));
}
