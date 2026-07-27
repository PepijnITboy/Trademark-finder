import { boipV1WatchEligibilityPolicy, type WatchedTrademark } from '@merkwacht/domain';
import { createJobStore } from '@merkwacht/database';
import { createLogger } from '@merkwacht/logging';
import { BOIP_FIXTURE_TRADEMARK_REGISTRATIONS, createBoipConnector, mapBoipTrademarkToSnapshot } from '@merkwacht/register-connectors';
import { createId } from '@merkwacht/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { runInitialOppositionScanPipeline } from './initial-opposition-scan-pipeline.js';
import type { PipelineContext } from './types.js';

const lumaroFixture = BOIP_FIXTURE_TRADEMARK_REGISTRATIONS[0];
if (lumaroFixture === undefined) {
  throw new Error('expected at least one BOIP fixture trademark registration');
}

function buildLumaroWatch(overrides: Partial<WatchedTrademark> = {}): WatchedTrademark {
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
    ...overrides,
  };
}

function buildContext(): PipelineContext {
  const jobStore = createJobStore({ seed: false });
  const boip = createBoipConnector({ useFixtures: true });
  return {
    jobStore,
    logger: createLogger({ service: 'test', level: 'error' }),
    connectors: new Map([[boip.registryCode, boip]]),
  };
}

describe('runInitialOppositionScanPipeline', () => {
  let context: PipelineContext;

  beforeEach(() => {
    context = buildContext();
  });

  it('is skipped for a watched trademark that does not exist', async () => {
    const scanRun = await runInitialOppositionScanPipeline(context, { watchedTrademarkId: 'missing' });
    expect(scanRun.status).toBe('skipped');
    expect(scanRun.type).toBe('INITIAL_OPPOSITION_SCAN');
  });

  it('is skipped for a watched trademark that is not active/eligible', async () => {
    const watched = buildLumaroWatch({ status: 'paused' });
    context.jobStore.upsertWatchedTrademark(watched);

    const scanRun = await runInitialOppositionScanPipeline(context, { watchedTrademarkId: watched.id });
    expect(scanRun.status).toBe('skipped');
  });

  it('ingests the full connector history and only matches currently-open opposition candidates against the target watch', async () => {
    const watched = buildLumaroWatch();
    context.jobStore.upsertWatchedTrademark(watched);

    const scanRun = await runInitialOppositionScanPipeline(context, { watchedTrademarkId: watched.id });

    expect(scanRun.status).toBe('succeeded');
    expect(typeof scanRun.metadata['fetchedCount']).toBe('number');
    expect(typeof scanRun.metadata['openOppositionCandidates']).toBe('number');

    // Every candidate was ingested regardless of whether its opposition
    // window happens to be open right now (rule-derived, not a blind
    // lookback) - matches are only created for the subset actually open.
    expect(context.jobStore.listCandidateApplications().length).toBeGreaterThan(0);

    for (const match of context.jobStore.listTrademarkMatches()) {
      expect(match.watchedTrademarkId).toBe(watched.id);
    }
  });
});
