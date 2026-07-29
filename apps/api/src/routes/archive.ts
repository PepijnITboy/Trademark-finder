import { statusesForQueue } from '@merkwacht/domain';
import type { FastifyInstance } from 'fastify';

/**
 * `/api/v1/archive` - read-only overview of archived watched trademarks and
 * archived matches (dismissed + opposition deadline passed).
 */
export async function registerArchiveRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const organizationId = request.tenant!.organizationId;

    const [watchedTrademarks, allMatches] = await Promise.all([
      app.store.listWatchedTrademarks(organizationId),
      app.store.listMatches(organizationId),
    ]);

    const archivedStatuses = new Set(statusesForQueue('archived'));
    const matches = allMatches.filter((m) => archivedStatuses.has(m.status));

    return {
      watchedTrademarks: watchedTrademarks.filter((w) => w.status === 'archived'),
      matches,
    };
  });
}
