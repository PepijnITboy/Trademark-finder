import {
  normalizeRecipientNotifyConfig,
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_STATUSES,
  type FeatureFlag,
} from '@merkwacht/domain';
import { AppError } from '@merkwacht/shared';
import {
  createChatMessageSchema,
  createMemberSchema,
  notificationRecipientSchema,
  organizationProfileSchema,
  updateMemberSchema,
  updateNotificationRecipientSchema,
} from '@merkwacht/validation';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { assertPlatformOperator, getTenantFromRequest } from '../tenancy/resolve-tenant.js';

const updatePlanCatalogSchema = z.object({
  displayNameNl: z.string().trim().min(1).max(120).optional(),
  priceMonthlyCents: z.number().int().min(0).optional(),
  maxWatchedTrademarks: z.number().int().min(0).optional(),
  maxNotificationEmails: z.number().int().min(0).optional(),
  supportTier: z.enum(['basis', 'standaard', 'prioriteit', 'dedicated']).optional(),
  features: z
    .record(
      z.enum([
        'ai_enrichment',
        'pdf_export',
        'csv_export',
        'email_notifications',
        'multi_register_watch',
        'platform_access',
        'merkrechten_chat',
      ]),
      z.boolean(),
    )
    .optional(),
  isActive: z.boolean().optional(),
});

const forceSubscriptionSchema = z.object({
  plan: z.enum(SUBSCRIPTION_PLANS).optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  pendingPlan: z.enum(SUBSCRIPTION_PLANS).nullable().optional(),
});

const markInvoicePaidSchema = z.object({
  internalNote: z.string().trim().min(1, 'Interne notitie is verplicht.').max(2000),
});

const sendNotificationSchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
});

const updateProfileSchema = organizationProfileSchema.partial();

const watchSettingsSchema = z.object({
  minScoreThreshold: z.number().min(0).max(100).optional(),
});

const watchStatusSchema = z.object({
  status: z.enum(['active', 'paused', 'archived']),
});

function assertPlatformUser(request: FastifyRequest): void {
  assertPlatformOperator(getTenantFromRequest(request));
}

function resolveCreateConfig(input: {
  mode?: 'threshold' | 'digest';
  digestCadence?: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null;
  digestFrequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  minScoreThreshold?: number | null;
}) {
  const mode = input.mode ?? (input.minScoreThreshold != null ? 'threshold' : 'digest');
  const digestCadence = input.digestCadence ?? input.digestFrequency ?? (mode === 'digest' ? 'DAILY' : null);
  return normalizeRecipientNotifyConfig({
    mode,
    digestCadence,
    minScoreThreshold: input.minScoreThreshold,
  });
}

function orgNotFound(reply: FastifyReply, organizationId: string) {
  return reply.status(404).send({
    code: 'ORGANIZATION_NOT_FOUND',
    messageNl: 'Deze organisatie bestaat niet.',
    referenceCode: organizationId,
  });
}

/** `/api/platform/org/*` — plan catalog, subscription overrides, and cross-org chat for operators. */
export async function registerPlatformOrgRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    assertPlatformUser(request);
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
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
    });
    if (!updated) {
      return reply.status(404).send({
        code: 'PLAN_NOT_FOUND',
        messageNl: 'Dit abonnement bestaat niet in de catalogus.',
        referenceCode: request.params.code,
      });
    }

    app.platformStore.recordAuditLogEntry({
      actorUserId: request.tenant!.userId,
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
          actorUserId: request.tenant!.userId,
          action: 'subscription.forced',
          targetType: 'organization',
          targetId: request.params.organizationId,
          metadata: patch,
        });
        return { subscription, entitlements: app.orgStore.getEntitlements(request.params.organizationId) };
      } catch (error) {
        if (error instanceof AppError && error.code === 'ORGANIZATION_NOT_FOUND') {
          return orgNotFound(reply, request.params.organizationId);
        }
        throw error;
      }
    },
  );

  app.patch(
    '/organizations/:organizationId/profile',
    async (request: FastifyRequest<{ Params: { organizationId: string } }>, reply: FastifyReply) => {
      if (!app.orgStore.hasOrganization(request.params.organizationId)) {
        return orgNotFound(reply, request.params.organizationId);
      }
      const patch = updateProfileSchema.parse(request.body);
      const profile = app.orgStore.updateProfile(request.params.organizationId, {
        ...(patch.legalName !== undefined ? { legalName: patch.legalName } : {}),
        ...(patch.addressLine !== undefined ? { addressLine: patch.addressLine } : {}),
        ...(patch.postalCode !== undefined ? { postalCode: patch.postalCode } : {}),
        ...(patch.city !== undefined ? { city: patch.city } : {}),
        ...(patch.country !== undefined ? { country: patch.country } : {}),
        ...(patch.kvkNumber !== undefined ? { kvkNumber: patch.kvkNumber } : {}),
        ...(patch.contactEmail !== undefined ? { contactEmail: patch.contactEmail } : {}),
        ...(patch.billingEmail !== undefined ? { billingEmail: patch.billingEmail } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
      });
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'organization.profile_updated',
        targetType: 'organization',
        targetId: request.params.organizationId,
        metadata: patch,
      });
      return { profile };
    },
  );

  app.post(
    '/organizations/:organizationId/members',
    async (request: FastifyRequest<{ Params: { organizationId: string } }>, reply: FastifyReply) => {
      if (!app.orgStore.hasOrganization(request.params.organizationId)) {
        return orgNotFound(reply, request.params.organizationId);
      }
      const input = createMemberSchema.parse(request.body);
      const member = app.orgStore.createMember(
        request.params.organizationId,
        {
          email: input.email,
          displayName: input.displayName,
          role: input.role,
          ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
        },
        'owner',
      );
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'organization.member_created',
        targetType: 'organization',
        targetId: request.params.organizationId,
        metadata: { memberId: member.id, email: member.email, role: member.role },
      });
      return reply.status(201).send({ member });
    },
  );

  app.patch(
    '/organizations/:organizationId/members/:memberId',
    async (
      request: FastifyRequest<{ Params: { organizationId: string; memberId: string } }>,
      reply: FastifyReply,
    ) => {
      if (!app.orgStore.hasOrganization(request.params.organizationId)) {
        return orgNotFound(reply, request.params.organizationId);
      }
      const patch = updateMemberSchema.parse(request.body);
      const member = app.orgStore.updateMember(
        request.params.organizationId,
        request.params.memberId,
        {
          ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
          ...(patch.role !== undefined ? { role: patch.role } : {}),
          ...(patch.jobTitle !== undefined ? { jobTitle: patch.jobTitle } : {}),
          ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
        },
        'owner',
        request.tenant!.userId,
      );
      if (!member) {
        return reply.status(404).send({
          code: 'MEMBER_NOT_FOUND',
          messageNl: 'Dit account bestaat niet.',
          referenceCode: request.params.memberId,
        });
      }
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'organization.member_updated',
        targetType: 'organization',
        targetId: request.params.organizationId,
        metadata: { memberId: member.id, patch },
      });
      return { member };
    },
  );

  app.delete(
    '/organizations/:organizationId/members/:memberId',
    async (
      request: FastifyRequest<{ Params: { organizationId: string; memberId: string } }>,
      reply: FastifyReply,
    ) => {
      if (!app.orgStore.hasOrganization(request.params.organizationId)) {
        return orgNotFound(reply, request.params.organizationId);
      }
      const removed = app.orgStore.removeMember(
        request.params.organizationId,
        request.params.memberId,
        'owner',
        request.tenant!.userId,
      );
      if (!removed) {
        return reply.status(404).send({
          code: 'MEMBER_NOT_FOUND',
          messageNl: 'Dit account bestaat niet.',
          referenceCode: request.params.memberId,
        });
      }
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'organization.member_removed',
        targetType: 'organization',
        targetId: request.params.organizationId,
        metadata: { memberId: request.params.memberId },
      });
      return reply.status(204).send();
    },
  );

  app.post(
    '/organizations/:organizationId/recipients',
    async (request: FastifyRequest<{ Params: { organizationId: string } }>, reply: FastifyReply) => {
      if (!app.orgStore.hasOrganization(request.params.organizationId)) {
        return orgNotFound(reply, request.params.organizationId);
      }
      const input = notificationRecipientSchema.parse(request.body);
      const normalized = resolveCreateConfig(input);
      if (!normalized.ok) {
        return reply.status(400).send({ code: 'INVALID_RECIPIENT_CONFIG', messageNl: normalized.message });
      }
      const watches = await app.store.listWatchedTrademarks(request.params.organizationId);
      const activeIds = watches.filter((w) => w.status === 'active').map((w) => w.id);
      const recipient = app.orgStore.createRecipient(
        request.params.organizationId,
        {
          email: input.email,
          mode: normalized.config.mode,
          digestCadence: normalized.config.digestCadence,
          minScoreThreshold: normalized.config.minScoreThreshold,
          ...(input.allWatches !== undefined ? { allWatches: input.allWatches } : {}),
          ...(input.watchedTrademarkIds !== undefined ? { watchedTrademarkIds: input.watchedTrademarkIds } : {}),
        },
        activeIds,
      );
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'organization.recipient_created',
        targetType: 'organization',
        targetId: request.params.organizationId,
        metadata: { recipientId: recipient.id, email: recipient.email },
      });
      return reply.status(201).send({ recipient });
    },
  );

  app.patch(
    '/organizations/:organizationId/recipients/:recipientId',
    async (
      request: FastifyRequest<{ Params: { organizationId: string; recipientId: string } }>,
      reply: FastifyReply,
    ) => {
      if (!app.orgStore.hasOrganization(request.params.organizationId)) {
        return orgNotFound(reply, request.params.organizationId);
      }
      const patch = updateNotificationRecipientSchema.parse(request.body);
      const watches = await app.store.listWatchedTrademarks(request.params.organizationId);
      const activeIds = watches.filter((w) => w.status === 'active').map((w) => w.id);
      try {
        const recipient = app.orgStore.updateRecipient(
          request.params.organizationId,
          request.params.recipientId,
          {
            ...(patch.mode !== undefined ? { mode: patch.mode } : {}),
            ...(patch.digestCadence !== undefined
              ? { digestCadence: patch.digestCadence }
              : patch.digestFrequency !== undefined
                ? { digestCadence: patch.digestFrequency }
                : {}),
            ...(patch.minScoreThreshold !== undefined ? { minScoreThreshold: patch.minScoreThreshold } : {}),
            ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
            ...(patch.allWatches !== undefined ? { allWatches: patch.allWatches } : {}),
            ...(patch.watchedTrademarkIds !== undefined ? { watchedTrademarkIds: patch.watchedTrademarkIds } : {}),
          },
          activeIds,
        );
        if (!recipient) {
          return reply.status(404).send({
            code: 'RECIPIENT_NOT_FOUND',
            messageNl: 'Dit meldingsadres bestaat niet.',
            referenceCode: request.params.recipientId,
          });
        }
        app.platformStore.recordAuditLogEntry({
          actorUserId: request.tenant!.userId,
          action: 'organization.recipient_updated',
          targetType: 'organization',
          targetId: request.params.organizationId,
          metadata: { recipientId: recipient.id, patch },
        });
        return { recipient };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Ongeldige meldingsinstelling.';
        return reply.status(400).send({ code: 'INVALID_RECIPIENT_CONFIG', messageNl: message });
      }
    },
  );

  app.delete(
    '/organizations/:organizationId/recipients/:recipientId',
    async (
      request: FastifyRequest<{ Params: { organizationId: string; recipientId: string } }>,
      reply: FastifyReply,
    ) => {
      if (!app.orgStore.hasOrganization(request.params.organizationId)) {
        return orgNotFound(reply, request.params.organizationId);
      }
      const removed = app.orgStore.deleteRecipient(request.params.organizationId, request.params.recipientId);
      if (!removed) {
        return reply.status(404).send({
          code: 'RECIPIENT_NOT_FOUND',
          messageNl: 'Dit meldingsadres bestaat niet.',
          referenceCode: request.params.recipientId,
        });
      }
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'organization.recipient_deleted',
        targetType: 'organization',
        targetId: request.params.organizationId,
        metadata: { recipientId: request.params.recipientId },
      });
      return reply.status(204).send();
    },
  );

  app.patch(
    '/organizations/:organizationId/watches/:watchId/settings',
    async (
      request: FastifyRequest<{ Params: { organizationId: string; watchId: string } }>,
      reply: FastifyReply,
    ) => {
      if (!app.orgStore.hasOrganization(request.params.organizationId)) {
        return orgNotFound(reply, request.params.organizationId);
      }
      const patch = watchSettingsSchema.parse(request.body);
      const updated = await app.store.updateWatchedTrademarkSettings(
        request.params.organizationId,
        request.params.watchId,
        patch,
      );
      if (!updated) {
        return reply.status(404).send({
          code: 'WATCH_NOT_FOUND',
          messageNl: 'Dit bewaakte merk bestaat niet.',
          referenceCode: request.params.watchId,
        });
      }
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'organization.watch_settings_updated',
        targetType: 'watched_trademark',
        targetId: request.params.watchId,
        metadata: { organizationId: request.params.organizationId, patch },
      });
      return { watchedTrademark: updated };
    },
  );

  app.post(
    '/organizations/:organizationId/watches/:watchId/status',
    async (
      request: FastifyRequest<{ Params: { organizationId: string; watchId: string } }>,
      reply: FastifyReply,
    ) => {
      if (!app.orgStore.hasOrganization(request.params.organizationId)) {
        return orgNotFound(reply, request.params.organizationId);
      }
      const body = watchStatusSchema.parse(request.body);
      const updated = await app.store.setWatchedTrademarkStatus(
        request.params.organizationId,
        request.params.watchId,
        body.status,
      );
      if (!updated) {
        return reply.status(404).send({
          code: 'WATCH_NOT_FOUND',
          messageNl: 'Dit bewaakte merk bestaat niet.',
          referenceCode: request.params.watchId,
        });
      }
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'organization.watch_status_updated',
        targetType: 'watched_trademark',
        targetId: request.params.watchId,
        metadata: { organizationId: request.params.organizationId, status: body.status },
      });
      return { watchedTrademark: updated };
    },
  );

  app.get('/chat/threads', async () => ({
    threads: app.orgStore.listAllThreadsForPlatform(),
  }));

  app.get(
    '/organizations/:organizationId/chat/threads/:threadId',
    async (
      request: FastifyRequest<{ Params: { organizationId: string; threadId: string } }>,
      reply: FastifyReply,
    ) => {
      const thread = app.orgStore.getThread(request.params.organizationId, request.params.threadId);
      if (!thread) {
        return reply.status(404).send({
          code: 'CHAT_THREAD_NOT_FOUND',
          messageNl: 'Dit gesprek bestaat niet.',
          referenceCode: request.params.threadId,
        });
      }
      return { thread };
    },
  );

  app.post('/chat/threads/:id/messages', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const input = createChatMessageSchema.parse(request.body);
    const identity = request.tenant!;
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

  app.post(
    '/billing/:organizationId/invoices/:invoiceId/mark-paid',
    async (request: FastifyRequest<{ Params: { organizationId: string; invoiceId: string } }>, reply: FastifyReply) => {
      const body = markInvoicePaidSchema.parse(request.body);
      try {
        const invoice = app.orgStore.markInvoicePaid(request.params.organizationId, request.params.invoiceId, {
          internalNote: body.internalNote,
        });
        if (!invoice) {
          return reply.status(404).send({
            code: 'INVOICE_NOT_FOUND',
            messageNl: 'Deze factuur bestaat niet.',
            referenceCode: request.params.invoiceId,
          });
        }
        app.platformStore.recordAuditLogEntry({
          actorUserId: request.tenant!.userId,
          action: 'invoice.marked_paid',
          targetType: 'invoice',
          targetId: request.params.invoiceId,
          metadata: { organizationId: request.params.organizationId, internalNote: body.internalNote },
        });
        return { invoice };
      } catch (error) {
        if (error instanceof AppError && error.code === 'ORGANIZATION_NOT_FOUND') {
          return orgNotFound(reply, request.params.organizationId);
        }
        throw error;
      }
    },
  );

  app.get('/notifications', async () => ({
    notifications: app.orgStore.listInAppNotifications(),
  }));

  app.post('/notifications', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = sendNotificationSchema.parse(request.body);
    try {
      const notification = app.orgStore.sendInAppNotification({
        organizationId: body.organizationId,
        title: body.title,
        body: body.body,
        sentByUserId: request.tenant!.userId,
      });
      app.platformStore.recordAuditLogEntry({
        actorUserId: request.tenant!.userId,
        action: 'in_app_notification.sent',
        targetType: 'organization',
        targetId: body.organizationId,
        metadata: { notificationId: notification.id, title: body.title },
      });
      return reply.status(201).send({ notification });
    } catch (error) {
      if (error instanceof AppError && error.code === 'ORGANIZATION_NOT_FOUND') {
        return orgNotFound(reply, body.organizationId);
      }
      throw error;
    }
  });
}
