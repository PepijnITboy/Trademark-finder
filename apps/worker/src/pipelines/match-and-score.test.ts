import type { CandidateApplication, WatchedTrademark } from '@merkwacht/domain';
import { createJobStore } from '@merkwacht/database';
import { createLogger } from '@merkwacht/logging';
import { createId } from '@merkwacht/shared';
import { describe, expect, it } from 'vitest';
import { scoreAndUpsertMatch } from './match-and-score.js';
import type { PipelineContext } from './types.js';

function buildWatched(): WatchedTrademark {
  const now = new Date().toISOString();
  return {
    id: createId(),
    organizationId: 'org-1',
    label: 'LUMARO',
    status: 'active',
    eligibility: {
      eligible: true,
      reasonCode: 'eligible',
      reasonLabelNl: 'Dit merk komt in aanmerking voor bewaking.',
      sourceStatus: 'registered',
      evaluatedAt: now,
      policyVersion: 'boip-v1',
      warnings: [],
    },
    snapshot: {
      registryCode: 'BOIP',
      registrationNumber: 'BX-1',
      markText: 'LUMARO',
      markType: 'word',
      niceClasses: [9],
      applicantName: 'Test',
      filingDate: '2022-01-01',
      registrationDate: '2022-06-01',
      registerStatus: 'registered',
      lastCheckedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function buildCandidate(overrides: Partial<CandidateApplication> = {}): CandidateApplication {
  const id = createId();
  return {
    id,
    registryCode: 'BOIP',
    applicationNumber: 'BX-APP-1',
    markText: 'LUMAROO',
    markType: 'word',
    niceClasses: [9],
    applicantName: 'Cand',
    filingDate: '2026-06-01',
    publicationDate: '2026-06-15',
    proceduralStatus: 'opposition_period',
    oppositionDeadline: {
      candidateApplicationId: id,
      registryCode: 'BOIP',
      startDate: '2026-06-15',
      deadlineDate: '2026-08-15',
      ruleSet: { kind: 'months', months: 2, startsFrom: 'publication_date' },
      calculatedAt: new Date().toISOString(),
    },
    rawPayloadRef: null,
    fetchedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildContext(): PipelineContext {
  return {
    jobStore: createJobStore({ seed: false }),
    logger: createLogger({ service: 'test', level: 'error' }),
    connectors: new Map(),
  };
}

describe('scoreAndUpsertMatch opposition window gate', () => {
  it('does not create a match when the opposition window has closed', async () => {
    const context = buildContext();
    const watched = buildWatched();
    const candidate = buildCandidate({
      oppositionDeadline: {
        candidateApplicationId: 'x',
        registryCode: 'BOIP',
        startDate: '2025-01-01',
        deadlineDate: '2025-03-01',
        ruleSet: { kind: 'months', months: 2, startsFrom: 'publication_date' },
        calculatedAt: new Date().toISOString(),
      },
    });

    const result = await scoreAndUpsertMatch(context, watched, candidate, new Date('2026-07-27'));
    expect(result.match).toBeNull();
    expect(result.isNew).toBe(false);
    expect(result.dropReason).toBe('opposition_window');
    expect(context.jobStore.listTrademarkMatches()).toHaveLength(0);
  });

  it('does not create a match for withdrawn candidates even inside the window', async () => {
    const context = buildContext();
    const watched = buildWatched();
    const candidate = buildCandidate({ proceduralStatus: 'withdrawn' });

    const result = await scoreAndUpsertMatch(context, watched, candidate, new Date('2026-07-01'));
    expect(result.match).toBeNull();
  });

  it('creates a match when the opposition window is open and score clears the floor', async () => {
    const context = buildContext();
    const watched = buildWatched();
    const candidate = buildCandidate();

    const result = await scoreAndUpsertMatch(context, watched, candidate, new Date('2026-07-01'));
    expect(result.match).not.toBeNull();
    expect(result.isNew).toBe(true);
    expect(result.totalScore).toBeGreaterThanOrEqual(15);
  });
});
