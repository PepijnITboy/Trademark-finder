import type { FastifyInstance } from 'fastify';

/**
 * `/api/v1/archive` - read-only overview of archived watched trademarks and
 * dismissed matches, for customers reviewing past decisions rather than
 * the active review queue (`/api/v1/matches`).
 */
export async function registerArchiveRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const organizationId = app.identityProvider.getIdentity().organizationId;

    const [watchedTrademarks, dismissedMatches] = await Promise.all([
      app.store.listWatchedTrademarks(organizationId),
      app.store.listMatches(organizationId, { status: 'dismissed' }),
    ]);

    return {
      watchedTrademarks: watchedTrademarks.filter((w) => w.status === 'archived'),
      matches: dismissedMatches,
    };
  });
}
