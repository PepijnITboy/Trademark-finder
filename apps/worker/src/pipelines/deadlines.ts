import type { JobStore } from '@merkwacht/database';
import type { CandidateApplication, OppositionDeadline, ProceduralStatus } from '@merkwacht/domain';
import { calculateOppositionDeadline } from '@merkwacht/opposition-rules';
import type { TrademarkRegisterConnector } from '@merkwacht/register-connectors';

/**
 * Computes (or recomputes) the `OppositionDeadline` for `candidate` using
 * its register's `OppositionRuleSet`. Pure aside from reading the wall
 * clock via `calculateOppositionDeadline`'s `calculatedAt` stamp.
 */
export function computeOppositionDeadlineForCandidate(
  candidate: Pick<CandidateApplication, 'id' | 'registryCode' | 'filingDate' | 'publicationDate'>,
  connector: TrademarkRegisterConnector,
): OppositionDeadline {
  return calculateOppositionDeadline({
    candidateApplicationId: candidate.id,
    registryCode: candidate.registryCode,
    filingDate: candidate.filingDate,
    publicationDate: candidate.publicationDate,
    ruleSet: connector.getOppositionRuleSet(),
  });
}

/**
 * Step 6 of `daily-sync-pipeline.ts` ("derive procedural status"): some
 * registers (BOIP included, see `boip.status-map.ts`) only ever report a
 * candidate as `published` and never explicitly transition it to
 * `opposition_period`, even though it is legally within its opposition
 * window. This derives the *effective* procedural status Merkwacht should
 * act on by escalating `published` to `opposition_period` whenever `now`
 * falls within `[deadline.startDate, deadline.deadlineDate]` - it never
 * downgrades or overrides any other register-reported status (`opposed`,
 * `withdrawn`, `refused`, `registered`, `expired`, or an already-correct
 * `opposition_period`/`filed`), since those are authoritative facts from
 * the register itself.
 */
export function deriveEffectiveProceduralStatus(
  reportedStatus: ProceduralStatus,
  deadline: OppositionDeadline | null,
  now: Date = new Date(),
): ProceduralStatus {
  if (reportedStatus !== 'published' || !deadline) {
    return reportedStatus;
  }
  const nowTime = now.getTime();
  const withinWindow =
    nowTime >= new Date(deadline.startDate).getTime() && nowTime <= new Date(deadline.deadlineDate).getTime();
  return withinWindow ? 'opposition_period' : reportedStatus;
}

/**
 * Step 8 of `daily-sync-pipeline.ts` ("refresh deadlines"): computes and
 * persists an `OppositionDeadline` for every stored candidate application
 * in `registryCode` that doesn't have one yet. In normal operation
 * {@link ingestConnectorBatch} (from `ingest-candidates.ts`) already
 * assigns a deadline to everything it touches, so this only matters for
 * candidates that predate that logic or were imported through another
 * path. Shared by both pipelines rather than duplicated inline.
 */
export function refreshMissingOppositionDeadlines(
  jobStore: JobStore,
  registryCode: string,
  connector: TrademarkRegisterConnector,
): number {
  let refreshed = 0;
  for (const stored of jobStore.listCandidateApplications()) {
    if (stored.application.registryCode !== registryCode) continue;
    if (stored.application.oppositionDeadline) continue;
    const deadline = computeOppositionDeadlineForCandidate(stored.application, connector);
    jobStore.setOppositionDeadline(stored.application.id, deadline);
    refreshed += 1;
  }
  return refreshed;
}
