import { ENTITLEMENT_MESSAGES_NL, requireFeature } from '@merkwacht/domain';
import { AppError } from '@merkwacht/shared';
import { createChatMessageSchema, createChatThreadSchema } from '@merkwacht/validation';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getOrganizationId, resolveDemoRequestContext } from '../org/demo-request-context.js';

function assertChatFeature(app: FastifyInstance, organizationId: string): void {
  const entitlements = app.orgStore.getEntitlements(organizationId);
  const denial = requireFeature(entitlements, 'merkrechten_chat');
  if (denial) {
    throw new AppError({
      code: 'ENTITLEMENT_DENIED',
      messageNl: ENTITLEMENT_MESSAGES_NL[denial],
      category: 'AUTHORIZATION',
    });
  }
}

/**
 * `/api/v1/chat` — customer support threads (gated by `merkrechten_chat` entitlement).
 * Demo identity via `x-demo-role` / `x-demo-user-id`.
 */
export async function registerChatRoutes(app: FastifyInstance): Promise<void> {
  app.get('/threads', async (request) => {
    const organizationId = getOrganizationId(request);
    const threads = app.orgStore.listThreads(organizationId);
    return { threads };
  });

  app.post('/threads', async (request: FastifyRequest, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
    assertChatFeature(app, organizationId);
    const input = createChatThreadSchema.parse(request.body);
    const { actorUserId, actorDisplayName } = resolveDemoRequestContext(request);
    const result = app.orgStore.createThread(
      organizationId,
      {
        subject: input.subject,
        body: input.body,
        ...(input.trademarkMatchId !== undefined ? { trademarkMatchId: input.trademarkMatchId } : {}),
      },
      actorUserId,
      actorDisplayName,
    );
    return reply.status(201).send(result);
  });

  app.get('/threads/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
    const thread = app.orgStore.getThread(organizationId, request.params.id);
    if (!thread) {
      return reply.status(404).send({
        code: 'CHAT_THREAD_NOT_FOUND',
        messageNl: 'Dit gesprek bestaat niet.',
        referenceCode: request.params.id,
      });
    }
    return thread;
  });

  app.post('/threads/:id/messages', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const organizationId = getOrganizationId(request);
    assertChatFeature(app, organizationId);
    const input = createChatMessageSchema.parse(request.body);
    const { actorUserId, actorDisplayName } = resolveDemoRequestContext(request);
    const message = app.orgStore.addMessage(organizationId, request.params.id, input.body, actorUserId, actorDisplayName);
    if (!message) {
      return reply.status(404).send({
        code: 'CHAT_THREAD_NOT_FOUND',
        messageNl: 'Dit gesprek bestaat niet.',
        referenceCode: request.params.id,
      });
    }
    return reply.status(201).send({ message });
  });
}
