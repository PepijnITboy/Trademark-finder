import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getOrganizationId } from '../org/demo-request-context.js';

/** `/api/v1/notifications` - in-app notification feed for the current organization. */
export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const organizationId = getOrganizationId(request);
    const [legacy, inApp] = await Promise.all([
      app.store.listNotifications(organizationId),
      Promise.resolve(app.orgStore.listInAppNotifications(organizationId)),
    ]);
    return {
      notifications: legacy,
      inAppNotifications: inApp,
      unreadCount: inApp.filter((n) => !n.readAt).length,
    };
  });

  app.post(
    '/:id/read',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const organizationId = getOrganizationId(request);
      const notification = app.orgStore.markInAppNotificationRead(organizationId, request.params.id);
      if (!notification) {
        return reply.status(404).send({
          code: 'NOTIFICATION_NOT_FOUND',
          messageNl: 'Deze melding bestaat niet.',
          referenceCode: request.params.id,
        });
      }
      return { notification };
    },
  );
}
