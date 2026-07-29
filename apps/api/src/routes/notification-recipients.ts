import { normalizeRecipientNotifyConfig } from '@merkwacht/domain';
import { notificationRecipientSchema, updateNotificationRecipientSchema } from '@merkwacht/validation';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getOrganizationId } from '../org/demo-request-context.js';

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

/** `/api/v1/notification-recipients` — digest/threshold notification addresses. */
export async function registerNotificationRecipientRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const organizationId = getOrganizationId(request);
    const recipients = app.orgStore.listRecipients(organizationId);
    return { recipients };
  });

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
    const input = notificationRecipientSchema.parse(request.body);
    const normalized = resolveCreateConfig(input);
    if (!normalized.ok) {
      return reply.status(400).send({
        code: 'INVALID_RECIPIENT_CONFIG',
        messageNl: normalized.message,
      });
    }
    const watchedTrademarks = await app.store.listWatchedTrademarks(organizationId);
    const activeIds = watchedTrademarks.filter((w) => w.status === 'active').map((w) => w.id);
    const recipient = app.orgStore.createRecipient(
      organizationId,
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
    return reply.status(201).send({ recipient });
  });

  app.patch('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
    const patch = updateNotificationRecipientSchema.parse(request.body);
    const watchedTrademarks = await app.store.listWatchedTrademarks(organizationId);
    const activeIds = watchedTrademarks.filter((w) => w.status === 'active').map((w) => w.id);
    try {
      const recipient = app.orgStore.updateRecipient(
        organizationId,
        request.params.id,
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
          referenceCode: request.params.id,
        });
      }
      return { recipient };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ongeldige meldingsinstelling.';
      return reply.status(400).send({ code: 'INVALID_RECIPIENT_CONFIG', messageNl: message });
    }
  });

  app.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
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
