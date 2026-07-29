import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async () => {
    const store = app.store;
    let database: 'ok' | 'demo' | 'error' = store.kind === 'demo' ? 'demo' : 'ok';
    let databaseError: string | undefined;

    if (store.kind === 'postgres' && typeof store.ping === 'function') {
      try {
        await store.ping();
        database = 'ok';
      } catch (error) {
        database = 'error';
        databaseError = error instanceof Error ? error.message : String(error);
      }
    }

    return {
      status: database === 'error' ? 'degraded' : 'ok',
      service: 'merkwacht-api',
      store: store.kind,
      database,
      ...(databaseError ? { databaseError } : {}),
      timestamp: new Date().toISOString(),
    };
  });
}
