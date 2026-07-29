import type { ApiEnv } from '@merkwacht/config';
import { DEMO_BETA_IDS, DEV_SEED_IDS } from '@merkwacht/database';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';

const TEST_ENV: ApiEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'error',
  PORT: 4000,
  HOST: '0.0.0.0',
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  INTERNAL_JOB_SECRET: 'a-test-internal-job-secret-value',
  CORS_ORIGIN: 'http://localhost:5173',
  ALLOW_DEMO_STORE: true,
  DEV_DEMO_AUTH: true,
  BOIP_USE_FIXTURES: true,
  EUIPO_USE_FIXTURES: false,
  USPTO_USE_FIXTURES: false,
  WIPO_USE_FIXTURES: false,
};

const alphaHeaders = { 'x-demo-user-id': DEV_SEED_IDS.userId };
const betaHeaders = { 'x-demo-user-id': DEMO_BETA_IDS.userId };

describe('API tenancy isolation (OrgAlpha vs OrgBeta)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ env: TEST_ENV });
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it(
    'Alpha organization profile is Lumaro; Beta is Fictieve Retail',
    async () => {
      const alpha = await app.inject({ method: 'GET', url: '/api/v1/organization', headers: alphaHeaders });
      const beta = await app.inject({ method: 'GET', url: '/api/v1/organization', headers: betaHeaders });
      expect(alpha.statusCode).toBe(200);
      expect(beta.statusCode).toBe(200);
      expect(alpha.json().profile.legalName).toBe('Lumaro B.V.');
      expect(beta.json().profile.legalName).toBe('Fictieve Retail Groep B.V.');
    },
    15_000,
  );

  it('x-demo-organization-id cannot escalate Alpha user into Beta org', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/organization',
      headers: {
        ...alphaHeaders,
        'x-demo-organization-id': DEMO_BETA_IDS.organizationId,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().profile.legalName).toBe('Lumaro B.V.');
  });

  it('Beta cannot read Alpha watched-trademark by id (404)', async () => {
    const alphaList = await app.inject({
      method: 'GET',
      url: '/api/v1/watched-trademarks',
      headers: alphaHeaders,
    });
    expect(alphaList.statusCode).toBe(200);
    const items = alphaList.json().watchedTrademarks as Array<{ id: string; organizationId: string }>;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((w) => w.organizationId === DEV_SEED_IDS.organizationId)).toBe(true);

    const cross = await app.inject({
      method: 'GET',
      url: `/api/v1/watched-trademarks/${items[0]!.id}`,
      headers: betaHeaders,
    });
    expect(cross.statusCode).toBe(404);
  });

  it('Alpha list never includes Beta watched ids', async () => {
    const alphaList = await app.inject({
      method: 'GET',
      url: '/api/v1/watched-trademarks',
      headers: alphaHeaders,
    });
    const betaList = await app.inject({
      method: 'GET',
      url: '/api/v1/watched-trademarks',
      headers: betaHeaders,
    });
    const alphaIds = new Set((alphaList.json().watchedTrademarks as Array<{ id: string }>).map((w) => w.id));
    const betaIds = (betaList.json().watchedTrademarks as Array<{ id: string }>).map((w) => w.id);
    expect(betaIds.length).toBeGreaterThan(0);
    for (const id of betaIds) {
      expect(alphaIds.has(id)).toBe(false);
    }
  });

  it('Beta cannot read Alpha match by id (404)', async () => {
    const alphaMatches = await app.inject({ method: 'GET', url: '/api/v1/matches', headers: alphaHeaders });
    expect(alphaMatches.statusCode).toBe(200);
    const matches = alphaMatches.json().matches as Array<{ id: string }>;
    expect(matches.length).toBeGreaterThan(0);

    const cross = await app.inject({
      method: 'GET',
      url: `/api/v1/matches/${matches[0]!.id}`,
      headers: betaHeaders,
    });
    expect(cross.statusCode).toBe(404);
  });

  it('list invoices never cross orgs', async () => {
    const alphaInvoices = await app.inject({ method: 'GET', url: '/api/v1/invoices', headers: alphaHeaders });
    const betaInvoices = await app.inject({ method: 'GET', url: '/api/v1/invoices', headers: betaHeaders });
    expect(alphaInvoices.statusCode).toBe(200);
    expect(betaInvoices.statusCode).toBe(200);
    const alphaIds = new Set((alphaInvoices.json().invoices as Array<{ id: string }>).map((i) => i.id));
    const betaIds = (betaInvoices.json().invoices as Array<{ id: string }>).map((i) => i.id);
    for (const id of betaIds) {
      expect(alphaIds.has(id)).toBe(false);
    }
  });

  it('Beta cannot checkout Alpha invoice', async () => {
    const alphaInvoices = await app.inject({ method: 'GET', url: '/api/v1/invoices', headers: alphaHeaders });
    const invoices = alphaInvoices.json().invoices as Array<{ id: string }>;
    expect(invoices.length).toBeGreaterThan(0);
    const cross = await app.inject({
      method: 'POST',
      url: `/api/v1/invoices/${invoices[0]!.id}/checkout`,
      headers: betaHeaders,
    });
    expect(cross.statusCode).toBe(404);
  });

  it('platform operator (Alpha) can list both orgs; Beta user is denied platform', async () => {
    const ok = await app.inject({ method: 'GET', url: '/api/platform/organizations', headers: alphaHeaders });
    expect(ok.statusCode).toBe(200);
    const orgs = ok.json().organizations as Array<{ id: string; legalName: string }>;
    expect(orgs.length).toBeGreaterThanOrEqual(2);
    const names = orgs.map((o) => o.legalName).join(' ');
    expect(names).toMatch(/Lumaro/);
    expect(names).toMatch(/Fictieve|Retail/);

    const denied = await app.inject({
      method: 'GET',
      url: '/api/platform/organizations',
      headers: betaHeaders,
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().code).toBe('PLATFORM_ACCESS_DENIED');
  });

  it('subscription list is org-scoped', async () => {
    const alpha = await app.inject({ method: 'GET', url: '/api/v1/subscription', headers: alphaHeaders });
    const beta = await app.inject({ method: 'GET', url: '/api/v1/subscription', headers: betaHeaders });
    expect(alpha.json().subscription.plan).toBe('starter');
    expect(beta.json().subscription.plan).toBe('pro');
  });

  it('notifications are org-scoped', async () => {
    const alpha = await app.inject({ method: 'GET', url: '/api/v1/notifications', headers: alphaHeaders });
    const beta = await app.inject({ method: 'GET', url: '/api/v1/notifications', headers: betaHeaders });
    expect(alpha.statusCode).toBe(200);
    expect(beta.statusCode).toBe(200);
    const alphaIds = new Set(
      ((alpha.json().notifications ?? []) as Array<{ id: string }>).map((n) => n.id),
    );
    for (const n of (beta.json().notifications ?? []) as Array<{ id: string }>) {
      expect(alphaIds.has(n.id)).toBe(false);
    }
  });
});
