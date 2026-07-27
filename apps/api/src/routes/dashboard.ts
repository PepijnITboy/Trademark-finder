import type { FastifyInstance } from 'fastify';

/**
 * Seed-shaped, empty dashboard payload. The shape mirrors what the real
 * aggregation query will eventually return so `@merkwacht/web` can be
 * built against a stable contract before the underlying tables exist.
 */
export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/dashboard', async () => ({
    kpis: {
      watchedTrademarks: 0,
      newMatches: 0,
      matchesInReview: 0,
      upcomingDeadlines: 0,
    },
    recentMatches: [] as unknown[],
    upcomingDeadlines: [] as unknown[],
  }));
}
