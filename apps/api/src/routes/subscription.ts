import { changePlanSchema } from '@merkwacht/validation';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getOrganizationId } from '../org/demo-request-context.js';

/** `/api/v1/subscription` — current plan, catalog, and self-service plan changes. */
export async function registerSubscriptionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const organizationId = getOrganizationId(request);
    const subscription = app.orgStore.getSubscription(organizationId);
    const entitlements = app.orgStore.getEntitlements(organizationId);
    return { subscription, entitlements };
  });

  app.get('/plans', async () => {
    const plans = app.orgStore.listActivePlans();
    return { plans };
  });

  app.post('/change-plan', async (request: FastifyRequest) => {
    const organizationId = getOrganizationId(request);
    const input = changePlanSchema.parse(request.body);
    const watchedTrademarks = await app.store.listWatchedTrademarks(organizationId);
    const activeWatchedCount = watchedTrademarks.filter((w) => w.status === 'active').length;
    const recipientCount = app.orgStore.listRecipients(organizationId).length;
    const subscription = app.orgStore.changePlan(organizationId, input.plan, {
      activeWatchedCount,
      recipientCount,
    });
    const entitlements = app.orgStore.getEntitlements(organizationId);
    return { subscription, entitlements };
  });

  app.post('/cancel-at-period-end', async (request) => {
    const organizationId = getOrganizationId(request);
    const subscription = app.orgStore.requestCancelAtPeriodEnd(organizationId);
    return { subscription, entitlements: app.orgStore.getEntitlements(organizationId) };
  });

  app.post('/undo-cancel-at-period-end', async (request) => {
    const organizationId = getOrganizationId(request);
    const subscription = app.orgStore.undoCancelAtPeriodEnd(organizationId);
    return { subscription, entitlements: app.orgStore.getEntitlements(organizationId) };
  });
}
