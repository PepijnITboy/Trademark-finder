import { boipV1WatchEligibilityPolicy, type WatchedTrademark } from '@merkwacht/domain';
import { createJobStore } from '@merkwacht/database';
import { createLogger } from '@merkwacht/logging';
import {
  BOIP_FIXTURE_PUBLICATIONS,
  BOIP_FIXTURE_TRADEMARK_REGISTRATIONS,
  createBoipConnector,
  mapBoipTrademarkToSnapshot,
} from '@merkwacht/register-connectors';
import { createId } from '@merkwacht/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { runDailySyncPipeline } from './daily-sync-pipeline.js';
import type { PipelineContext } from './types.js';

const lumaroFixture = BOIP_FIXTURE_TRADEMARK_REGISTRATIONS[0];
if (lumaroFixture === undefined) {
  throw new Error('expected at least one BOIP fixture trademark registration');
}

function buildLumaroWatch(): WatchedTrademark {
  // `lumaroFixture` is a module-level `const` already checked for
  // `undefined` above; TS can't carry that narrowing into this closure, so
  // it's reasserted here.
  const snapshot = mapBoipTrademarkToSnapshot(lumaroFixture!);
  const now = new Date().toISOString();
  return {
    id: createId(),
    organizationId: 'test-org',
    label: 'LUMARO',
    status: 'active',
    eligibility: boipV1WatchEligibilityPolicy.evaluate(snapshot),
    snapshot,
    createdAt: now,
    updatedAt: now,
  };
}

function buildContext(): PipelineContext {
  const jobStore = createJobStore({ seed: false });
  jobStore.upsertWatchedTrademark(buildLumaroWatch());
  const boip = createBoipConnector({ useFixtures: true });
  return {
    jobStore,
    logger: createLogger({ service: 'test', level: 'error' }),
    connectors: new Map([[boip.registryCode, boip]]),
  };
}

describe('runDailySyncPipeline', () => {
  let context: PipelineContext;

  beforeEach(() => {
    context = buildContext();
  });

  it('ingests every fixture publication, deriving deadlines and creating matches end-to-end', async () => {
    const scanRun = await runDailySyncPipeline(context, { registryCode: 'BOIP' });

    expect(scanRun.status).toBe('succeeded');
    expect(scanRun.type).toBe('DAILY_SYNC');
    expect(scanRun.metadata['fetchedCount']).toBe(BOIP_FIXTURE_PUBLICATIONS.length);
    expect(scanRun.metadata['invalidCount']).toBe(0);
    expect(scanRun.metadata['changedCount']).toBe(BOIP_FIXTURE_PUBLICATIONS.length);

    const candidates = context.jobStore.listCandidateApplications();
    expect(candidates).toHaveLength(BOIP_FIXTURE_PUBLICATIONS.length);
    for (const candidate of candidates) {
      expect(candidate.application.oppositionDeadline).not.toBeNull();
    }

    // LUMAROO is a near-identical, same-Nice-class variant of the watched
    // LUMARO mark and must be scored as a strong match.
    const lumarooCandidate = candidates.find((c) => c.application.markText === 'LUMAROO');
    expect(lumarooCandidate).toBeDefined();

    const matches = context.jobStore.listTrademarkMatches();
    const lumarooMatch = matches.find((m) => m.candidateApplicationId === lumarooCandidate?.application.id);
    expect(lumarooMatch).toBeDefined();
    expect(lumarooMatch?.totalScore ?? 0).toBeGreaterThan(50);
  });

  it('is idempotent: re-running against unchanged fixture data creates no new candidates or match jobs', async () => {
    await runDailySyncPipeline(context, { registryCode: 'BOIP' });
    const candidatesAfterFirstRun = context.jobStore.listCandidateApplications().length;
    const matchesAfterFirstRun = context.jobStore.listTrademarkMatches().length;

    const secondRun = await runDailySyncPipeline(context, { registryCode: 'BOIP' });

    expect(secondRun.status).toBe('succeeded');
    expect(secondRun.metadata['changedCount']).toBe(0);
    expect(secondRun.metadata['enqueuedMatchJobs']).toBe(0);
    expect(context.jobStore.listCandidateApplications()).toHaveLength(candidatesAfterFirstRun);
    expect(context.jobStore.listTrademarkMatches()).toHaveLength(matchesAfterFirstRun);
  });

  it('fails gracefully (scan_run marked failed) for an unconfigured connector', async () => {
    const jobStore = createJobStore({ seed: false });
    const unconfigured = createBoipConnector({});
    const failingContext: PipelineContext = {
      jobStore,
      logger: createLogger({ service: 'test', level: 'error' }),
      connectors: new Map([[unconfigured.registryCode, unconfigured]]),
    };

    const scanRun = await runDailySyncPipeline(failingContext, { registryCode: 'BOIP' });

    expect(scanRun.status).toBe('failed');
    expect(scanRun.error).toBeTruthy();
  });
});
