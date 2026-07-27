import type { ApiEnv } from '@merkwacht/config';
import type { FastifyInstance } from 'fastify';

export async function startServer(app: FastifyInstance, env: ApiEnv): Promise<void> {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.appLogger.info(`API luistert op http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.appLogger.error('Kon de server niet starten.', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}
