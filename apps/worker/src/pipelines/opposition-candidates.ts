import type { CandidateApplication, ProceduralStatus } from '@merkwacht/domain';
import type { JobStore } from '@merkwacht/database';

/**
 * Procedural statuses that make a candidate application moot for
 * opposition purposes regardless of its deadline window - the application
 * itself no longer exists in a form that can be opposed.
 */
const NON_OPPOSABLE_STATUSES: readonly ProceduralStatus[] = ['withdrawn', 'refused'];

/**
 * Whether `now` falls within `candidate.oppositionDeadline`'s window. This
 * is the opposition-rules-driven check `initial-opposition-scan-pipeline.ts`
 * uses instead of a blind N-day lookback: it doesn't matter *when* the
 * candidate was published, only whether its register-specific opposition
 * window (computed by `@merkwacht/opposition-rules`) is currently open.
 */
export function isWithinOppositionWindow(
  candidate: Pick<CandidateApplication, 'proceduralStatus' | 'oppositionDeadline'>,
  now: Date = new Date(),
): boolean {
  if (!candidate.oppositionDeadline) return false;
  if (NON_OPPOSABLE_STATUSES.includes(candidate.proceduralStatus)) return false;
  const nowTime = now.getTime();
  return (
    nowTime >= new Date(candidate.oppositionDeadline.startDate).getTime() &&
    nowTime <= new Date(candidate.oppositionDeadline.deadlineDate).getTime()
  );
}

/**
 * Every currently-opposable candidate application for `registryCode`,
 * evaluated live against `now` rather than relying on whatever
 * `proceduralStatus` was stored at last ingestion time - a candidate whose
 * window opened since its last fetch (but which hasn't changed content
 * since, and so wasn't re-upserted) must still be found here.
 */
export function listOpenOppositionCandidates(
  jobStore: JobStore,
  registryCode: string,
  now: Date = new Date(),
): readonly CandidateApplication[] {
  return jobStore
    .listCandidateApplications()
    .map((stored) => stored.application)
    .filter((application) => application.registryCode === registryCode)
    .filter((application) => isWithinOppositionWindow(application, now));
}
