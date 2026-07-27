import { notificationRecipientSchema, updateNotificationRecipientSchema } from '@merkwacht/validation';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getOrganizationId } from '../org/demo-request-context.js';

/** `/api/v1/notification-recipients` — digest notification addresses (demo identity via `x-demo-role`). */
export async function registerNotificationRecipientRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const organizationId = getOrganizationId(app);
    const recipients = app.orgStore.listRecipients(organizationId);
    return { recipients };
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const input = notificationRecipientSchema.parse(request.body);
    const watchedTrademarks = await app.store.listWatchedTrademarks(organizationId);
    const activeIds = watchedTrademarks.filter((w) => w.status === 'active').map((w) => w.id);
    const recipient = app.orgStore.createRecipient(
      organizationId,
      {
        email: input.email,
        digestFrequency: input.digestFrequency,
        minScoreThreshold: input.minScoreThreshold,
        ...(input.allWatches !== undefined ? { allWatches: input.allWatches } : {}),
        ...(input.watchedTrademarkIds !== undefined ? { watchedTrademarkIds: input.watchedTrademarkIds } : {}),
      },
      activeIds,
    );
    return reply.status(201).send({ recipient });
  });

  app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const patch = updateNotificationRecipientSchema.parse(request.body);
    const watchedTrademarks = await app.store.listWatchedTrademarks(organizationId);
    const activeIds = watchedTrademarks.filter((w) => w.status === 'active').map((w) => w.id);
    const recipient = app.orgStore.updateRecipient(
      organizationId,
      request.params.id,
      {
        ...(patch.digestFrequency !== undefined ? { digestFrequency: patch.digestFrequency } : {}),
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
        referenceCode: request.params.id,
      });
    }
    return { recipient };
  });

  app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(app);
    const removed = app.orgStore.deleteRecipient(organizationId, request.params.id);
    if (!removed) {
      return reply.status(404).send({
        code: 'RECIPIENT_NOT_FOUND',
        messageNl: 'Dit meldingsadres bestaat niet.',
        referenceCode: request.params.id,
      });
    }
    return reply.status(204).send();
  });
}
