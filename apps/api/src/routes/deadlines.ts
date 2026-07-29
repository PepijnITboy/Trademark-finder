import { isDeadlineEligibleStatus } from '@merkwacht/domain';
import type { FastifyInstance } from 'fastify';

function daysBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.ceil((to - from) / (1000 * 60 * 60 * 24));
}

/**
 * `/api/v1/deadlines` - upcoming opposition-filing deadlines for possible + active matches.
 */
export async function registerDeadlineRoutes(app: FastifyInstance): Promise<void> {
  app.get('/', async (request) => {
    const organizationId = request.tenant!.organizationId;
    const matches = await app.store.listMatches(organizationId);
    const now = new Date().toISOString();

    // Persist expire→archive for past deadlines still in inbox queues.
    for (const match of matches) {
      const deadline = match.candidate.oppositionDeadline;
      if (!deadline || !isDeadlineEligibleStatus(match.status)) continue;
      if (daysBetween(now, deadline.deadlineDate) >= 0) continue;
      await app.store.updateMatchStatus(
        organizationId,
        match.id,
        'opposition_deadline_passed',
        'system:deadline-expire',
      );
    }

    const refreshed = await app.store.listMatches(organizationId);

    const deadlines = refreshed
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
