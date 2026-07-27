import type { FastifyInstance } from 'fastify';

/** `/api/v1/notifications` - in-app notification feed for the current organization. */
export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const organizationId = app.identityProvider.getIdentity().organizationId;
    const notifications = await app.store.listNotifications(organizationId);
    return { notifications };
  });
}
