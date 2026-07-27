import { AppError } from '@merkwacht/shared';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

function assertInternalJobSecret(app: FastifyInstance, request: FastifyRequest): void {
  const provided = request.headers['x-internal-job-secret'];
  if (!provided || provided !== app.appEnv.INTERNAL_JOB_SECRET) {
    throw new AppError({
      code: 'INTERNAL_JOB_UNAUTHORIZED',
      messageNl: 'Ongeldig of ontbrekend intern taakgeheim.',
      category: 'AUTHORIZATION',
    });
  }
}

/**
 * Internal-only endpoints called by the worker/scheduler, never exposed to
 * end users. Protected by a shared secret rather than end-user auth.
 */
export async function registerInternalJobRoutes(app: FastifyInstance): Promise<void> {
  app.post('/register-sync', async (request: FastifyRequest, reply: FastifyReply) => {
    assertInternalJobSecret(app, request);
    app.appLogger.info('Register-sync taak ontvangen.', { correlationId: request.correlationId });
    return reply.status(202).send({ accepted: true, job: 'REGISTER_SYNC' });
  });
}
