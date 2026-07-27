import cors from '@fastify/cors';
import type { ApiEnv } from '@merkwacht/config';
import { DevIdentityProvider, DEV_SEED_IDS } from '@merkwacht/database';
import { createLogger } from '@merkwacht/logging';
import { AppError, createCorrelationId } from '@merkwacht/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { createBillingProvider } from './billing/create-billing-provider.js';
import type { BillingProvider } from './billing/types.js';
import { createOrgBillingChatStore } from './org/org-store.js';
import { createPlatformStore } from './platform/platform-store.js';
import { NameResearchStore } from './research/name-research-store.js';
import { createBoipConnectorFromEnv } from './register-connectors.js';
import { registerArchiveRoutes } from './routes/archive.js';
import { registerBillingRoutes } from './routes/billing.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerDashboardRoutes } from './routes/dashboard.js';
import { registerDeadlineRoutes } from './routes/deadlines.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerInternalJobRoutes } from './routes/internal-jobs.js';
import { registerInvoiceRoutes } from './routes/invoices.js';
import { registerMatchRoutes } from './routes/matches.js';
import { registerNameResearchRoutes } from './routes/name-research.js';
import { registerNotificationRecipientRoutes } from './routes/notification-recipients.js';
import { registerNotificationRoutes } from './routes/notifications.js';
import { registerOrganizationRoutes } from './routes/organization.js';
import { registerPlatformOrgRoutes } from './routes/platform-org.js';
import { registerPlatformRoutes } from './routes/platform.js';
import { registerRegisterSourceRoutes } from './routes/register-sources.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerSubscriptionRoutes } from './routes/subscription.js';
import { registerWatchedTrademarkRoutes } from './routes/watched-trademarks.js';
import { createAppStore } from './store/create-store.js';

export interface BuildAppOptions {
  env: ApiEnv;
  billingProvider?: BillingProvider;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { env } = options;
  const logger = createLogger({ service: 'api', level: env.LOG_LEVEL });

  const app = Fastify({ logger: false, disableRequestLogging: true });

  const store = await createAppStore(env, logger);
  logger.info(`AppStore geïnitialiseerd (${store.kind}).`);

  const organizationSettings = await store.getOrganizationSettings(DEV_SEED_IDS.organizationId);

  app.decorate('appLogger', logger);
  app.decorate('appEnv', env);
  app.decorate('store', store);
  app.decorate('identityProvider', new DevIdentityProvider());
  app.decorate('boipConnector', createBoipConnectorFromEnv(env));
  app.decorate('platformStore', createPlatformStore(DEV_SEED_IDS.organizationId));
  app.decorate(
    'orgStore',
    createOrgBillingChatStore(DEV_SEED_IDS.organizationId, organizationSettings.notificationEmail),
  );
  app.decorate('billingProvider', options.billingProvider ?? createBillingProvider(env));
  app.decorate(
    'nameResearchStore',
    new NameResearchStore({ [DEV_SEED_IDS.organizationId]: 1 }),
  );

  await app.register(cors, {
    origin: env.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  app.addHook('onRequest', async (request) => {
    const headerValue = request.headers['x-correlation-id'];
    const provided = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    request.correlationId = provided ?? createCorrelationId();
  });

  app.addHook('onResponse', async (request, reply) => {
    logger.info('Verzoek afgehandeld.', {
      correlationId: request.correlationId,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const correlationId = request.correlationId ?? createCorrelationId();

    if (error instanceof AppError) {
      logger.warn('Aanvraag afgewezen met een applicatiefout.', {
        correlationId,
        code: error.code,
        url: request.url,
      });
      reply.status(error.httpStatus).send({
        code: error.code,
        messageNl: error.messageNl,
        referenceCode: error.referenceCode,
      });
      return;
    }

    logger.error('Onverwachte fout tijdens het verwerken van het verzoek.', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      url: request.url,
    });
    reply.status(500).send({
      code: 'INTERNAL_ERROR',
      messageNl: 'Er is een onverwachte fout opgetreden.',
      referenceCode: correlationId,
    });
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      code: 'ROUTE_NOT_FOUND',
      messageNl: 'De opgevraagde route bestaat niet.',
      referenceCode: request.correlationId ?? createCorrelationId(),
    });
  });

  await app.register(registerHealthRoutes, { prefix: '/api/v1' });
  await app.register(registerDashboardRoutes, { prefix: '/api/v1' });
  await app.register(registerWatchedTrademarkRoutes, { prefix: '/api/v1/watched-trademarks' });
  await app.register(registerMatchRoutes, { prefix: '/api/v1/matches' });
  await app.register(registerDeadlineRoutes, { prefix: '/api/v1/deadlines' });
  await app.register(registerArchiveRoutes, { prefix: '/api/v1/archive' });
  await app.register(registerRegisterSourceRoutes, { prefix: '/api/v1/register-sources' });
  await app.register(registerNotificationRoutes, { prefix: '/api/v1/notifications' });
  await app.register(registerSettingsRoutes, { prefix: '/api/v1/settings' });
  await app.register(registerOrganizationRoutes, { prefix: '/api/v1/organization' });
  await app.register(registerNotificationRecipientRoutes, { prefix: '/api/v1/notification-recipients' });
  await app.register(registerSubscriptionRoutes, { prefix: '/api/v1/subscription' });
  await app.register(registerInvoiceRoutes, { prefix: '/api/v1/invoices' });
  await app.register(registerBillingRoutes, { prefix: '/api/v1/billing' });
  await app.register(registerChatRoutes, { prefix: '/api/v1/chat' });
  await app.register(registerNameResearchRoutes, { prefix: '/api/v1/name-research' });
  await app.register(registerPlatformRoutes, { prefix: '/api/platform' });
  await app.register(registerPlatformOrgRoutes, { prefix: '/api/platform/org' });
  await app.register(registerInternalJobRoutes, { prefix: '/internal/jobs' });

  return app;
}
