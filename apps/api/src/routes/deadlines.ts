import { isDeadlineEligibleStatus } from '@merkwacht/domain';
import type { FastifyInstance } from 'fastify';

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.ceil((to - from) / (1000 * 60 * 60 * 24));
}

/**
 * `/api/v1/deadlines` - upcoming opposition-filing deadlines for **actieve** matches only.
 */
export async function registerDeadlineRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async () => {
    const organizationId = app.identityProvider.getIdentity().organizationId;
    const matches = await app.store.listMatches(organizationId);
    const now = new Date().toISOString();

    const deadlines = matches
      .filter((match) => isDeadlineEligibleStatus(match.status) && match.candidate.oppositionDeadline !== null)
      .map((match) => {
        const deadline = match.candidate.oppositionDeadline;
        return {
          matchId: match.id,
          watchedTrademarkId: match.watchedTrademarkId,
          watchedTrademarkLabel: match.watchedTrademarkLabel,
          candidateMarkText: match.candidate.markText,
          registryCode: match.candidate.registryCode,
          deadline,
          daysRemaining: deadline ? daysBetween(now, deadline.deadlineDate) : null,
        };
      })
      .filter((entry) => entry.daysRemaining === null || entry.daysRemaining >= 0)
      .sort((a, b) => (a.deadline?.deadlineDate ?? '').localeCompare(b.deadline?.deadlineDate ?? ''));

    return { deadlines };
  });
}
