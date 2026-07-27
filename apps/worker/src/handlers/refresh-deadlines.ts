import { computeOppositionDeadlineForCandidate } from '../pipelines/deadlines.js';
import type { JobContext } from './register-sync.js';

export interface RefreshDeadlinesPayload {
  /** Recompute a single candidate's deadline; omit to refresh every candidate application. */
  readonly candidateApplicationId?: string;
}

/**
 * REFRESH_DEADLINES: recomputes `OppositionDeadline`s via
 * `@merkwacht/opposition-rules`'s `calculateOppositionDeadline`, scoped to
 * one candidate application when `candidateApplicationId` is given,
 * otherwise every stored candidate. Unlike the ingestion pipelines' "fill
 * in missing deadlines only" step, this handler always recomputes -
 * intended for on-demand use after a publication-date correction upstream
 * (see the handler's original stub doc / `docs/operations/daily-jobs.md`).
 */
export async function handleRefreshDeadlines(payload: RefreshDeadlinesPayload, context: JobContext): Promise<void> {
  const targets = payload.candidateApplicationId
    ? [context.jobStore.getCandidateApplication(payload.candidateApplicationId)].filter(
        (stored): stored is NonNullable<typeof stored> => stored !== null,
      )
    : context.jobStore.listCandidateApplications();

  let refreshed = 0;
  let skipped = 0;
  for (const stored of targets) {
    const connector = context.connectors.get(stored.application.registryCode);
    if (!connector) {
      skipped += 1;
      continue;
    }
    const deadline = computeOppositionDeadlineForCandidate(stored.application, connector);
    context.jobStore.setOppositionDeadline(stored.application.id, deadline);
    refreshed += 1;
  }

  context.logger.info('REFRESH_DEADLINES taak afgerond.', {
    candidateApplicationId: payload.candidateApplicationId ?? null,
    refreshed,
    skipped,
  });
}
