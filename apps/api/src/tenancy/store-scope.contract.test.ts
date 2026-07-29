import { DEMO_BETA_IDS, DEV_SEED_IDS } from '@merkwacht/database';
import { describe, expect, it } from 'vitest';
import { createDemoStore } from '../store/demo-store.js';

/**
 * Store helper contract: every AppStore read/write that accepts an id must
 * require organization scope and return null/empty across tenants.
 */
describe('DemoStore multi-org scope contract', () => {
  it('seeds Alpha and Beta independently with distinct ids', async () => {
    const store = createDemoStore();
    const alphaWatches = await store.listWatchedTrademarks(DEV_SEED_IDS.organizationId);
    const betaWatches = await store.listWatchedTrademarks(DEMO_BETA_IDS.organizationId);
    expect(alphaWatches.length).toBeGreaterThan(0);
    expect(betaWatches.length).toBeGreaterThan(0);
    const alphaIds = new Set(alphaWatches.map((w) => w.id));
    for (const w of betaWatches) {
      expect(alphaIds.has(w.id)).toBe(false);
      expect(w.organizationId).toBe(DEMO_BETA_IDS.organizationId);
    }
    for (const w of alphaWatches) {
      expect(w.organizationId).toBe(DEV_SEED_IDS.organizationId);
    }
  });

  it('getWatchedTrademark cross-tenant returns null', async () => {
    const store = createDemoStore();
    const alpha = await store.listWatchedTrademarks(DEV_SEED_IDS.organizationId);
    const cross = await store.getWatchedTrademark(DEMO_BETA_IDS.organizationId, alpha[0]!.id);
    expect(cross).toBeNull();
  });

  it('getMatch cross-tenant returns null', async () => {
    const store = createDemoStore();
    const alphaMatches = await store.listMatches(DEV_SEED_IDS.organizationId);
    expect(alphaMatches.length).toBeGreaterThan(0);
    const cross = await store.getMatch(DEMO_BETA_IDS.organizationId, alphaMatches[0]!.id);
    expect(cross).toBeNull();
  });

  it('updateMatchStatus cross-tenant returns null (no leak)', async () => {
    const store = createDemoStore();
    const alphaMatches = await store.listMatches(DEV_SEED_IDS.organizationId);
    const result = await store.updateMatchStatus(
      DEMO_BETA_IDS.organizationId,
      alphaMatches[0]!.id,
      'dismissed',
      DEMO_BETA_IDS.userId,
    );
    expect(result).toBeNull();
    const still = await store.getMatch(DEV_SEED_IDS.organizationId, alphaMatches[0]!.id);
    expect(still?.status).not.toBe('dismissed');
  });

  it('listNotifications filters by organizationId', async () => {
    const store = createDemoStore();
    const alpha = await store.listNotifications(DEV_SEED_IDS.organizationId);
    const beta = await store.listNotifications(DEMO_BETA_IDS.organizationId);
    const alphaIds = new Set(alpha.map((n) => n.id));
    for (const n of beta) {
      expect(alphaIds.has(n.id)).toBe(false);
      expect(n.organizationId).toBe(DEMO_BETA_IDS.organizationId);
    }
  });

  it('settings are per-organization', async () => {
    const store = createDemoStore();
    await store.updateOrganizationSettings(DEV_SEED_IDS.organizationId, {
      notificationEmail: 'alpha-only@example.test',
    });
    const beta = await store.getOrganizationSettings(DEMO_BETA_IDS.organizationId);
    expect(beta.notificationEmail).not.toBe('alpha-only@example.test');
  });
});

describe('store method signatures require organizationId', () => {
  const requiredOrgMethods = [
    'listWatchedTrademarks',
    'getWatchedTrademark',
    'createWatchedTrademark',
    'updateWatchedTrademarkSettings',
    'setWatchedTrademarkStatus',
    'listMatches',
    'getMatch',
    'updateMatchStatus',
    'addMatchNote',
    'requestAdvisorReview',
    'listNotifications',
    'getOrganizationSettings',
    'updateOrganizationSettings',
  ] as const;

  it.each(requiredOrgMethods)('%s first parameter is organizationId (arity ≥ 1)', (method) => {
    const store = createDemoStore();
    const fn = store[method];
    expect(typeof fn).toBe('function');
    expect(fn.length).toBeGreaterThanOrEqual(1);
  });
});
